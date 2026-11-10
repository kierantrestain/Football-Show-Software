import type { Scene } from './domain'
import { storage } from './storage'
import type { Playout } from './playback'
import type { SessionCredentials } from './session-types'
import { MAX_FRAME_BYTES, MAX_FRAME_EDGE, MAX_SESSION_FRAMES, sceneFrameTime, validStagedFrame, type StagedFrame } from './media-reference'

export function decodeImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The image could not be decoded.'))
    image.src = url
  })
}

function videoEvent(video: HTMLVideoElement, name: 'loadeddata' | 'seeked') {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer)
      video.removeEventListener(name, ready)
      video.removeEventListener('error', failed)
      if (error) reject(error)
      else resolve()
    }
    const ready = () => finish()
    const failed = () => finish(new Error('The video could not be decoded.'))
    const timer = setTimeout(() => finish(new Error('The browser could not read the requested video frame.')), 6000)
    video.addEventListener(name, ready, { once: true })
    video.addEventListener('error', failed, { once: true })
  })
}

export function mediaDimensions(media: HTMLImageElement | HTMLVideoElement) {
  return media instanceof HTMLVideoElement ? [media.videoWidth, media.videoHeight] as const : [media.naturalWidth, media.naturalHeight] as const
}

export async function seekFrame(video: HTMLVideoElement, time: number) {
  const end = Number.isFinite(video.duration) ? video.duration : video.seekable.length ? video.seekable.end(video.seekable.length - 1) : time
  const target = Math.max(0, Math.min(time, Math.max(0, end - .002)))
  if (Math.abs(video.currentTime - target) < .001) return
  const seeked = videoEvent(video, 'seeked')
  video.currentTime = target
  await seeked
}

export async function loadSceneMedia(asset?: Scene['media']) {
  if (!asset) return undefined
  const entry = await storage.asset(asset.assetId)
  if (!entry) return undefined
  const url = URL.createObjectURL(entry.blob)
  const dispose = () => URL.revokeObjectURL(url)
  try {
    if (asset.type === 'image') return { media: await decodeImage(url), dispose }
    const video = Object.assign(document.createElement('video'), { muted: true, preload: 'auto', playsInline: true })
    const loaded = videoEvent(video, 'loadeddata')
    video.src = url
    await loaded
    await seekFrame(video, asset.frame ?? 0)
    return { media: video, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}

const canvasBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode this frame.')), 'image/jpeg', quality)
})

async function prepareFrame(asset: NonNullable<Scene['media']>) {
  const loaded = await loadSceneMedia(asset)
  if (!loaded) throw new Error('The source file is missing on this device.')
  try {
    const [width, height] = mediaDimensions(loaded.media)
    if (!width || !height) throw new Error('The source image has no readable dimensions.')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('The browser could not prepare this frame.')
    let scale = Math.min(1, MAX_FRAME_EDGE / Math.max(width, height))
    for (const quality of [.94, .86, .74, .66]) {
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      context.fillStyle = '#09130f'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(loaded.media, 0, 0, canvas.width, canvas.height)
      const blob = await canvasBlob(canvas, quality)
      if (blob.size <= MAX_FRAME_BYTES) {
        const url = URL.createObjectURL(blob)
        try { await decodeImage(url) } finally { URL.revokeObjectURL(url) }
        return blob
      }
      scale *= .86
    }
    throw new Error('The prepared frame exceeds the 4 MiB playout limit.')
  } finally { loaded.dispose() }
}

export function frameEndpoint(id: string, key?: string) {
  return `/api/session-asset?${new URLSearchParams(key ? { id, key } : { id })}`
}

export async function stageSessionAssets(credentials: SessionCredentials, content: Playout): Promise<Playout> {
  const scenes = content.project.scenes.filter(scene => scene.media)
  if (scenes.length > MAX_SESSION_FRAMES) throw new Error(`A shared rundown can stage up to ${MAX_SESSION_FRAMES} media scenes.`)
  const frames = new Map<string, StagedFrame>()
  const entries: [string, StagedFrame][] = []
  for (const scene of scenes) {
    const media = scene.media!
    const frame = sceneFrameTime(media)
    const identity = JSON.stringify([media.assetId, frame])
    try {
      let prepared = frames.get(identity)
      if (!prepared) {
        const blob = await prepareFrame(media)
        const response = await fetch(frameEndpoint(credentials.id), {
          method: 'POST', headers: { authorization: `Bearer ${credentials.token}`, 'content-type': 'image/jpeg' },
          body: blob, signal: AbortSignal.timeout(30_000),
        })
        const uploaded = await response.json().catch(() => ({})) as Partial<StagedFrame> & { error?: string }
        if (!response.ok) throw new Error(uploaded.error ?? 'The frame upload failed.')
        const ref = { ...uploaded, assetId: media.assetId, frame }
        if (!validStagedFrame(ref)) throw new Error('The studio did not return a valid prepared frame.')
        prepared = ref
        frames.set(identity, prepared)
      }
      entries.push([scene.id, prepared])
    } catch (error) {
      throw new Error(`Cannot stage “${scene.name}”. ${error instanceof Error ? error.message : 'The source could not be prepared.'}`, { cause: error })
    }
  }
  return { ...content, sharedImage: undefined, mediaManifest: Object.fromEntries(entries) }
}

import type { Scene } from './domain'
import { storage } from './storage'

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

export async function sharedFrame(asset?: Scene['media']) {
  const loaded = await loadSceneMedia(asset)
  if (!asset || !loaded) return undefined
  try {
    const [width, height] = mediaDimensions(loaded.media)
    const scale = Math.min(1, 1000 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    canvas.getContext('2d')!.drawImage(loaded.media, 0, 0, canvas.width, canvas.height)
    return { assetId: asset.assetId, url: canvas.toDataURL('image/jpeg', .78) }
  } finally { loaded.dispose() }
}

import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Pitch } from './Pitch'
import type { Scene } from './domain'
import { activeSceneMedia } from './media-reference'
import { download } from './storage'
import { decodeImage, loadSceneMedia, mediaDimensions, seekFrame } from './mediaDecode'

export type ExportOptions = {
  size: '1080p' | '4K'
  orientation: '16:9' | '9:16'
  transparent: boolean
  format: 'png' | 'webm' | 'mp4'
}
export const webmType = () => typeof MediaRecorder !== 'undefined' && ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type))
export const mp4Type = () => typeof MediaRecorder !== 'undefined' && ['video/mp4;codecs=avc1.42001f', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type))

function fitMedia(source: HTMLImageElement | HTMLVideoElement, boxW: number, boxH: number) {
  const [width, height] = mediaDimensions(source)
  const scale = Math.min(boxW / width, boxH / height)
  return [(boxW - width * scale) / 2, (boxH - height * scale) / 2, width * scale, height * scale] as const
}

export async function exportScene(scene: Scene, time: number, cue: number, options: ExportOptions, progress: (value: number) => void) {
  const host = document.createElement('div')
  const root = createRoot(host)
  const canvas = document.createElement('canvas')
  const scale = options.size === '4K' ? 2 : 1
  canvas.width = (options.orientation === '16:9' ? 1920 : 1080) * scale
  canvas.height = (options.orientation === '16:9' ? 1080 : 1920) * scale
  const ctx = canvas.getContext('2d')!
  const source = activeSceneMedia(scene)
  let loaded: Awaited<ReturnType<typeof loadSceneMedia>>
  let media: HTMLImageElement | HTMLVideoElement | undefined
  const draw = async (timestamp: number) => {
    const frame = source?.frame ?? 0
    if (media instanceof HTMLVideoElement && options.format !== 'png') await seekFrame(media, frame + timestamp)
    const mediaTime = media instanceof HTMLVideoElement ? media.currentTime : frame
    flushSync(() => root.render(<Pitch scene={scene} time={timestamp} cueIndex={cue} clean transparent={options.transparent || !!media} media={!!source} mediaTime={mediaTime} />))
    const svg = host.querySelector('svg')
    if (!svg) throw new Error('The scene did not render.')
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const box = media ? fitMedia(media, canvas.width, canvas.height) : [0, 0, canvas.width, canvas.height] as const
    clone.setAttribute('width', String(Math.round(box[2])))
    clone.setAttribute('height', String(Math.round(box[3])))
    clone.style.width = ''
    clone.style.height = ''
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }))
    try {
      const image = await decodeImage(url)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!options.transparent) {
        ctx.fillStyle = '#09130f'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      if (media && !options.transparent) ctx.drawImage(media, ...box)
      ctx.drawImage(image, ...box)
    } finally { URL.revokeObjectURL(url) }
  }
  const filename = scene.name.replace(/[^\w-]+/g, '-').toLowerCase()
  try {
    loaded = await loadSceneMedia(source)
    media = loaded?.media
    if (source && !media) throw new Error('Restore the source file before exporting this still.')
    await draw(options.format === 'png' ? time : 0)
    if (options.format === 'png') {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('PNG encoding failed.')
      download(blob, filename + '.png')
      progress(1)
      return
    }
    const mimeType = options.format === 'webm' ? webmType() : mp4Type()
    if (!mimeType || typeof canvas.captureStream !== 'function') throw new Error('This browser does not offer the selected encoder.')
    const stream = canvas.captureStream(24)
    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks: Blob[] = []
    const result = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => reject(new Error('Video recording failed.'))
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
    })
    recorder.start()
    try {
      const start = performance.now()
      for (let frame = 0; frame <= Math.ceil(scene.duration * 24); frame++) {
        const t = Math.min(scene.duration, frame / 24)
        await draw(t)
        progress(t / scene.duration)
        const delay = start + (frame + 1) * 1000 / 24 - performance.now()
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay))
      }
      recorder.stop()
      const blob = await result
      if (!blob.size) throw new Error('The encoder returned an empty video.')
      download(blob, filename + '.' + options.format)
    } finally {
      if (recorder.state !== 'inactive') recorder.stop()
      stream.getTracks().forEach(track => track.stop())
    }
  } finally {
    root.unmount()
    loaded?.dispose()
  }
}

import { useEffect, useRef, useState } from 'react'
import { decodeImage, frameEndpoint } from './mediaDecode'
import { activeSceneMedia, MAX_FRAME_BYTES, sceneFrameMatches } from './media-reference'
import { currentScene, type Playout } from './playback'
import type { SessionCredentials } from './session-types'
import { cachedProgrammeFrame, cacheProgrammeFrame } from './stagedFrameCache'

type DecodedFrame = { url: string; ratio: number }
type FrameState = { scope: string; frames: Record<string, DecodedFrame>; failed: string[] }

export function displayedFrameKey(content: Playout | null | undefined) {
  if (!content || (content.graphic && !content.pip) || content.format === 'Overlay') return undefined
  const scene = currentScene(content)
  const media = activeSceneMedia(scene)
  const frame = content.mediaManifest?.[scene.id]
  return media && sceneFrameMatches(media, frame) ? frame?.key : undefined
}

export function useStagedFrames(credentials: SessionCredentials | null, ...contents: (Playout | null | undefined)[]) {
  const id = credentials?.id
  const token = credentials?.token
  const scope = id && token ? `${id}:${token}` : ''
  const activeKeys = contents.flatMap(content => displayedFrameKey(content) ?? [])
  const allKeys = contents.flatMap(content => Object.values(content?.mediaManifest ?? {}).map(frame => frame.key))
  const keys = Array.from(new Set([...activeKeys, ...allKeys])).join(',')
  const map = useRef(new Map<string, DecodedFrame>())
  const [state, setState] = useState<FrameState>({ scope: '', frames: {}, failed: [] })

  useEffect(() => {
    const current = map.current
    return () => {
      for (const frame of current.values()) URL.revokeObjectURL(frame.url)
      current.clear()
    }
  }, [scope])

  useEffect(() => {
    if (!id || !token) return
    const current = map.current
    const targets = new Set(keys ? keys.split(',') : [])
    const controller = new AbortController()
    const failed = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | undefined

    async function getFrame(key: string) {
      // Scope cache lookup to this invite. The suffix identifies the invite
      // without persisting a usable bearer credential in the asset store.
      const cacheId = `studio-frame:${id}:${token!.slice(-24)}:${key}`
      let blob = await cachedProgrammeFrame(cacheId).catch(() => undefined)
      const cached = !!blob
      if (!blob) {
        const request = new AbortController()
        const abort = () => request.abort()
        controller.signal.addEventListener('abort', abort, { once: true })
        const timeout = setTimeout(abort, 15_000)
        try {
          if (controller.signal.aborted) abort()
          const response = await fetch(frameEndpoint(id!, key), {
            headers: { authorization: `Bearer ${token}` }, signal: request.signal, cache: 'no-store',
          })
          if (!response.ok || response.headers.get('content-type') !== 'image/jpeg') throw new Error('The staged frame is unavailable.')
          blob = await response.blob()
          if (!blob.size || blob.size > MAX_FRAME_BYTES) throw new Error('The staged frame is unreadable.')
        } finally {
          clearTimeout(timeout)
          controller.signal.removeEventListener('abort', abort)
        }
      }
      const url = URL.createObjectURL(blob)
      try {
        const image = await decodeImage(url)
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('The staged frame has no dimensions.')
        if (controller.signal.aborted) throw new Error('Frame request superseded.')
        current.set(key, { url, ratio: image.naturalWidth / image.naturalHeight })
        if (!cached) void cacheProgrammeFrame(cacheId, blob).catch(() => {})
      } catch (error) {
        URL.revokeObjectURL(url)
        throw error
      }
    }

    function publish() {
      if (!controller.signal.aborted) setState({ scope, frames: Object.fromEntries(current), failed: [...failed] })
    }
    async function load() {
      for (const key of targets) {
        if (controller.signal.aborted) return
        if (current.has(key)) continue
        try { await getFrame(key); failed.delete(key) }
        catch { failed.add(key) }
        publish()
      }
      if (failed.size && !controller.signal.aborted) timer = setTimeout(() => void load(), 2200)
    }
    for (const [key, frame] of current) {
      if (targets.has(key)) continue
      URL.revokeObjectURL(frame.url)
      current.delete(key)
    }
    publish()
    void load()
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [id, token, scope, keys])

  return state.scope === scope ? state : { scope, frames: {} as FrameState['frames'], failed: [] }
}

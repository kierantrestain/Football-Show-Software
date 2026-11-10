import { useEffect, useState } from 'react'
import type { Project, Scene } from './domain'
import type { GraphicSpec } from './data'

export type OutputFormat = '16:9' | '9:16' | 'Overlay'
export type Playout = {
  project: Project
  sceneId: string
  cue: number
  time: number
  startedAt?: number
  speed: number
  loop: boolean
  graphic?: GraphicSpec
  graphics?: GraphicSpec[]
  pip?: boolean
  format: OutputFormat
  sharedImage?: { assetId: string; url: string }
}

export const initialPlayout = (project: Project, sceneId = project.scenes[0].id): Playout =>
  ({ project, sceneId, cue: 0, time: 0, speed: 1, loop: false, format: '16:9' })

export function timeAt(playout: Playout, duration: number, now = Date.now()) {
  const time = playout.time + (playout.startedAt === undefined ? 0 : Math.max(0, now - playout.startedAt) * playout.speed / 1000)
  return playout.loop && duration > 0 ? time % duration : Math.min(time, duration)
}

export function usePlayoutTime(playout: Playout, duration: number, heldAt?: number | null) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!playout.startedAt || heldAt != null) return
    let frame: number
    const tick = () => {
      const current = Date.now()
      setNow(current)
      if (timeAt(playout, duration, current) < duration || playout.loop) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playout, duration, heldAt])
  return timeAt(playout, duration, heldAt ?? Math.max(now, playout.startedAt ?? 0))
}

export function currentScene(playout: Playout) {
  return playout.project.scenes.find(scene => scene.id === playout.sceneId) ?? playout.project.scenes[0]
}

export function withScene(playout: Playout, scene: Scene): Playout {
  return { ...playout, project: { ...playout.project, scenes: playout.project.scenes.map(item => item.id === scene.id ? scene : item) } }
}

export function switchScene(playout: Playout, sceneId: string): Playout {
  return { ...playout, sceneId, time: 0, cue: 0, startedAt: undefined, graphic: undefined }
}

export function switchCue(playout: Playout, delta: number): Playout {
  const scene = currentScene(playout)
  const cue = Math.max(0, Math.min(scene.cues.length - 1, playout.cue + delta))
  return { ...playout, cue, time: scene.cues[cue]?.time ?? 0, startedAt: undefined }
}

export function togglePlay(playout: Playout): Playout {
  const duration = currentScene(playout).duration
  const time = timeAt(playout, duration)
  return playout.startedAt && (time < duration || playout.loop)
    ? { ...playout, time, startedAt: undefined }
    : { ...playout, time: time >= duration ? 0 : time, startedAt: Date.now() }
}

const localPreviewKey = 'touchline-local-output'
export function setLocalPreview(value: Playout) {
  try { localStorage.setItem(localPreviewKey, JSON.stringify(value)) } catch { /* storage limit */ }
  window.dispatchEvent(new Event(localPreviewKey))
}
export function useLocalPreview(fallback: Playout) {
  const read = () => {
    try { return (JSON.parse(localStorage.getItem(localPreviewKey) ?? 'null') as Playout | null) ?? fallback }
    catch { return fallback }
  }
  const [value, setValue] = useState(read)
  useEffect(() => {
    const sync = () => setValue(read())
    window.addEventListener('storage', sync)
    window.addEventListener(localPreviewKey, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(localPreviewKey, sync)
    }
    // The fallback applies when the local preview has yet to be set.
  }, [])
  return value
}

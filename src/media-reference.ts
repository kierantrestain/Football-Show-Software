import type { Scene } from './domain'

export const MAX_FRAME_BYTES = 4 * 1024 * 1024
export const MAX_FRAME_EDGE = 3840
export const MAX_SESSION_FRAMES = 32
export const frameKeyPattern = /^[a-f0-9]{64}$/

export type StagedFrame = {
  key: string
  assetId: string
  frame: number
  width: number
  height: number
}
export type MediaManifest = Record<string, StagedFrame>

export function activeSceneMedia(scene: Pick<Scene, 'media' | 'surface'>) {
  return scene.surface === 'pitch' ? undefined : scene.media
}

export function sceneFrameTime(media: NonNullable<Scene['media']>) {
  return media.type === 'video' ? media.frame ?? 0 : 0
}

export function sceneFrameMatches(media: NonNullable<Scene['media']>, frame: StagedFrame | undefined) {
  return frame?.assetId === media.assetId && frame.frame === sceneFrameTime(media)
}

export function validStagedFrame(value: unknown): value is StagedFrame {
  if (!value || typeof value !== 'object') return false
  const frame = value as StagedFrame
  return typeof frame.key === 'string' && frameKeyPattern.test(frame.key)
    && typeof frame.assetId === 'string' && frame.assetId.length > 0 && frame.assetId.length <= 128
    && Number.isFinite(frame.frame) && frame.frame >= 0
    && [frame.width, frame.height].every(side => Number.isInteger(side) && side > 0 && side <= MAX_FRAME_EDGE)
}

export function validMediaManifest(value: unknown): value is MediaManifest {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length <= MAX_SESSION_FRAMES && Object.values(value).every(validStagedFrame)
}

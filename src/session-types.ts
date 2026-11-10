export type PresenterRole = 'presenter-a' | 'presenter-b'
export type InviteRole = PresenterRole | 'viewer'
export type SessionRole = 'producer' | InviteRole
export type SessionMode = 'preview' | 'live' | 'hold'

export interface SessionCredentials {
  id: string
  token: string
}

export interface SessionLock {
  owner: Exclude<SessionRole, 'viewer'>
  expiresAt: number
}

export interface SessionState<T> {
  id: string
  revision: number
  role: SessionRole
  preview: T
  live: T | null
  mode: SessionMode
  lock: SessionLock | null
  access: Record<PresenterRole, boolean>
  invites?: Record<InviteRole, string>
  updatedAt: number
  previewUpdatedAt: number
  liveUpdatedAt: number | null
  heldAt: number | null
  serverTime: number
}

export type SessionAction<T> =
  | { type: 'update' | 'stage'; content: T }
  | { type: 'take' | 'hold' | 'clear' | 'preview' | 'claim' | 'release' }
  | { type: 'access'; role: PresenterRole; enabled: boolean }

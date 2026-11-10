import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionAction, SessionCredentials, SessionState } from './session-types'

export type { InviteRole, PresenterRole, SessionAction, SessionCredentials, SessionLock, SessionMode, SessionRole, SessionState } from './session-types'

type Connection = 'idle' | 'connecting' | 'connected' | 'offline' | 'error'
const apiPath = '/api/session'

function sessionRequest(credentials: SessionCredentials, since?: SessionState<unknown>) {
  const params = new URLSearchParams({ id: credentials.id })
  if (since) {
    params.set('since', String(since.revision))
    if (since.lock) params.set('lockUntil', String(since.lock.expiresAt))
  }
  return `${apiPath}?${params}`
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` }
}

export function sessionUrl(path: string, token: string) {
  const url = new URL(path, window.location.origin)
  url.hash = token
  return url.href
}

export function credentialsFromUrl(id: string): SessionCredentials | null {
  const token = window.location.hash.slice(1).replace(/^token=/, '')
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? { id, token } : null
}

async function studioFetch(path: string, options: RequestInit, timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timeout = setTimeout(abort, timeoutMs)
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  try {
    return await fetch(path, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

async function sessionError(response: Response) {
  const problem = await response.json().catch(() => null) as { error?: string } | null
  return new Error(problem?.error ?? `The studio service returned HTTP ${response.status}.`)
}

export async function createSession<T>(preview: T): Promise<{ credentials: SessionCredentials; state: SessionState<T> }> {
  const response = await studioFetch(apiPath, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'create', preview }),
  }, 12_000)
  if (!response.ok) throw await sessionError(response)
  return await response.json()
}

interface Snapshot<T> {
  key: string
  state: SessionState<T> | null
  connection: Connection
  error: string | null
}

interface Transport<T> {
  key: string
  latest: SessionState<T> | null
  controller: AbortController
  sending: boolean
  accept(next: SessionState<T>): void
  report(connection: Connection, error: string | null): void
}

type OnAirCache<T> = Pick<SessionState<T>, 'id' | 'revision' | 'mode' | 'heldAt' | 'liveUpdatedAt' | 'updatedAt' | 'serverTime'> & { live: T }

const outputCacheKey = (id: string) => `touchline-last-on-air/${id}`

function loadOnAir<T>(id: string): SessionState<T> | null {
  try {
    const raw = sessionStorage.getItem(outputCacheKey(id))
    if (!raw) return null
    const cached = JSON.parse(raw) as OnAirCache<T>
    if (cached.id !== id || cached.live == null || !Number.isSafeInteger(cached.revision)) return null
    return { ...cached, preview: cached.live, previewUpdatedAt: cached.liveUpdatedAt ?? cached.updatedAt,
      role: 'viewer', lock: null, access: { 'presenter-a': false, 'presenter-b': false } }
  } catch {
    return null
  }
}

function rememberOnAir<T>(next: SessionState<T>) {
  if (next.role !== 'viewer') return
  try {
    if (next.live == null) {
      sessionStorage.removeItem(outputCacheKey(next.id))
    } else {
      const { id, revision, live, mode, heldAt, liveUpdatedAt, updatedAt, serverTime } = next
      sessionStorage.setItem(outputCacheKey(next.id), JSON.stringify({ id, revision, live, mode, heldAt, liveUpdatedAt, updatedAt, serverTime }))
    }
  } catch { /* a private or restricted browser may disable storage */ }
}

export function useSession<T>(credentials: SessionCredentials | null, { retainOnAir = false } = {}) {
  const id = credentials?.id ?? ''
  const token = credentials?.token ?? ''
  const key = id && token ? `${id}:${token}` : ''
  const [view, setView] = useState<Snapshot<T>>({ key: '', state: null, connection: 'idle', error: null })
  const transport = useRef<Transport<T> | null>(null)

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let confirmed: SessionState<T> | null = null
    const retained = retainOnAir ? loadOnAir<T>(id) : null
    const client: Transport<T> = {
      key,
      latest: retained,
      controller,
      sending: false,
      accept(next) {
        if (controller.signal.aborted || next.id !== id) return
        const current = confirmed
        if (current && (next.revision < current.revision ||
          (next.revision === current.revision && next.serverTime < current.serverTime))) return
        confirmed = next
        client.latest = next
        if (retainOnAir) rememberOnAir(next)
        setView(previous => ({
          key, state: next, connection: 'connected',
          error: previous.key === key && previous.connection === 'connected' ? previous.error : null,
        }))
      },
      report(connection, error) {
        if (!controller.signal.aborted) setView({ key, state: client.latest, connection, error })
      },
    }
    transport.current = client
    if (retained) client.report('connecting', null)

    async function poll() {
      timer = undefined
      let interval = 1800
      try {
        const response = await studioFetch(sessionRequest({ id, token }, confirmed ?? undefined), {
          cache: 'no-store',
          headers: authHeaders(token),
        }, 24_000, controller.signal)
        const serverInterval = Number(response.headers.get('x-studio-poll-after') ?? NaN)
        if (Number.isFinite(serverInterval)) interval = Math.max(80, Math.min(5000, serverInterval))
        if (!response.ok) {
          const problem = await sessionError(response)
          if (!confirmed && retained && (response.status === 401 || response.status === 403)) client.latest = null
          client.report(response.status >= 500 && client.latest ? 'offline' : 'error', problem.message)
          failures++
        } else {
          failures = 0
          if (response.status === 204) {
            setView(previous => {
              if (controller.signal.aborted || (previous.key === key && previous.connection === 'connected')) return previous
              return { key, state: client.latest, connection: 'connected', error: null }
            })
          } else {
            client.accept(await response.json() as SessionState<T>)
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          client.report('offline', 'Connection lost. The last studio state remains visible while reconnecting.')
          failures++
        }
      } finally {
        if (!controller.signal.aborted) {
          const delay = failures ? Math.min(12_000, Math.max(700, interval) * 2 ** Math.min(failures, 4)) : interval
          timer = setTimeout(poll, delay)
        }
      }
    }

    function reconnect() {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
        void poll()
      }
    }

    const disconnect = () => client.report('offline', 'Connection lost. The last studio state remains visible while reconnecting.')
    window.addEventListener('online', reconnect)
    window.addEventListener('offline', disconnect)
    void poll()
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
      window.removeEventListener('online', reconnect)
      window.removeEventListener('offline', disconnect)
      if (transport.current === client) transport.current = null
    }
  }, [key, id, token, retainOnAir])

  const send = useCallback(async (action: SessionAction<T>) => {
    const client = transport.current
    if (!client || client.key !== key || !client.latest || client.sending) return false
    client.sending = true
    try {
      const response = await studioFetch(sessionRequest({ id, token }), {
        method: 'POST',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
        body: JSON.stringify({ action, expectedRevision: client.latest.revision }),
      }, 12_000, client.controller.signal)
      if (response.ok) {
        client.accept(await response.json() as SessionState<T>)
        client.report('connected', null)
        return true
      }
      const problem = await response.json().catch(() => null) as { error?: string; state?: SessionState<T> } | null
      if (problem?.state) client.accept(problem.state)
      client.report(response.status >= 500 ? 'offline' : 'connected', problem?.error ?? 'The studio could not apply that command.')
      return false
    } catch {
      client.report('offline', 'Connection lost. The last studio state remains visible while reconnecting.')
      return false
    } finally {
      client.sending = false
    }
  }, [id, key, token])

  return {
    state: view.key === key ? view.state : null,
    connection: key ? (view.key === key ? view.connection : 'connecting' as const) : 'idle' as const,
    error: view.key === key ? view.error : null,
    send,
  }
}

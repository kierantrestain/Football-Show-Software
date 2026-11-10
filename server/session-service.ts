import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { SessionAction, SessionRole, SessionState } from '../src/session-types'
import type { SessionRecord, SessionStore } from './session-store'

export const MAX_SESSION_BODY_BYTES = 1_048_576
const LEASE_MS = 30_000
const sessionIdPattern = /^[A-Za-z0-9_-]{16}$/
const tokenPattern = /^[A-Za-z0-9_-]{43}$/
const roles = ['producer', 'presenter-a', 'presenter-b', 'viewer'] as const

type Content = Record<string, unknown>
type Waiter = () => void

class SessionProblem extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

function asObject(value: unknown): Content {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SessionProblem(400, 'Expected a studio state object.')
  }
  return value as Content
}

async function readBody(request: Request): Promise<Content> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new SessionProblem(415, 'Send a JSON studio request.')
  }
  if (Number(request.headers.get('content-length')) > MAX_SESSION_BODY_BYTES) {
    throw new SessionProblem(413, 'Studio state exceeds the 1 MiB session limit.')
  }
  const reader = request.body?.getReader()
  if (!reader) throw new SessionProblem(400, 'The studio request is empty.')
  const decoder = new TextDecoder()
  let text = ''
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_SESSION_BODY_BYTES) {
        void reader.cancel().catch(() => undefined)
        throw new SessionProblem(413, 'Studio state exceeds the 1 MiB session limit.')
      }
      text += decoder.decode(value, { stream: true })
    }
    return asObject(JSON.parse(text + decoder.decode()))
  } catch (error) {
    if (error instanceof SessionProblem) throw error
    throw new SessionProblem(400, 'The studio request is not valid JSON.')
  } finally {
    reader.releaseLock()
  }
}

function authorize(record: SessionRecord, token: string): SessionRole {
  if (tokenPattern.test(token)) {
    const candidate = Buffer.from(token)
    for (const role of roles) {
      if (timingSafeEqual(candidate, Buffer.from(record.tokens[role]))) return role
    }
  }
  throw new SessionProblem(401, 'This session link is missing or invalid.')
}

function activeLock(record: SessionRecord, now: number) {
  return record.lock && record.lock.expiresAt > now ? record.lock : null
}

function state(record: SessionRecord, role: SessionRole, now: number): SessionState<Content> {
  const { id, revision, preview, live, mode, access, updatedAt, previewUpdatedAt, liveUpdatedAt, heldAt, tokens } = record
  return {
    id, revision, role, preview, live, mode, access, updatedAt, previewUpdatedAt, liveUpdatedAt, heldAt,
    serverTime: now,
    lock: activeLock(record, now),
    ...(role === 'producer' ? { invites: {
      'presenter-a': tokens['presenter-a'], 'presenter-b': tokens['presenter-b'], viewer: tokens.viewer,
    } } : {}),
  }
}

function parseAction(value: unknown): SessionAction<Content> {
  const action = asObject(value)
  switch (action.type) {
    case 'update':
    case 'stage':
      return { type: action.type, content: asObject(action.content) }
    case 'take':
    case 'hold':
    case 'clear':
    case 'preview':
    case 'claim':
    case 'release':
      return { type: action.type }
    case 'access':
      if ((action.role === 'presenter-a' || action.role === 'presenter-b') && typeof action.enabled === 'boolean') {
        return { type: action.type, role: action.role, enabled: action.enabled }
      }
      break
  }
  throw new SessionProblem(400, 'This studio command is not recognised.')
}

function apply(record: SessionRecord, role: SessionRole, action: SessionAction<Content>, now: number): SessionRecord {
  if (role === 'viewer' || (role !== 'producer' && !record.access[role])) {
    throw new SessionProblem(403, 'The producer has not granted control to this device.')
  }
  const lock = activeLock(record, now)
  const producer = role === 'producer'
  if (!producer && action.type !== 'update' && action.type !== 'claim' && action.type !== 'release') {
    throw new SessionProblem(403, 'Only the producer can use this command.')
  }
  if (!producer && lock && lock.owner !== role) {
    throw new SessionProblem(423, 'Another presenter has control. Release it or wait for the lease to end.')
  }

  const next = { ...record, revision: record.revision + 1, updatedAt: now, lock }
  switch (action.type) {
    case 'update':
    case 'stage':
      next.preview = action.content
      next.previewUpdatedAt = now
      if (action.type === 'stage') {
        next.mode = 'preview'
      } else if (record.mode === 'live') {
        next.live = action.content
        next.liveUpdatedAt = now
      }
      if (lock?.owner === role) next.lock = { owner: role, expiresAt: now + LEASE_MS }
      break
    case 'claim':
      next.lock = { owner: role, expiresAt: now + LEASE_MS }
      break
    case 'release':
      next.lock = null
      break
    case 'access':
      next.access = { ...record.access, [action.role]: action.enabled }
      if (!action.enabled && next.lock?.owner === action.role) next.lock = null
      break
    case 'preview':
      next.mode = 'preview'
      break
    case 'take':
      next.mode = 'live'
      next.live = record.preview
      next.liveUpdatedAt = record.previewUpdatedAt
      next.heldAt = null
      break
    case 'hold':
      next.mode = 'hold'
      next.heldAt = record.heldAt ?? now
      break
    case 'clear':
      next.mode = 'preview'
      next.live = null
      next.liveUpdatedAt = null
      next.heldAt = null
      break
  }
  return next
}

interface ServiceOptions {
  longPollMs?: number
  pollAfterMs?: number
  now?: () => number
  validateContent?: (value: Content) => boolean
}

export function sessionService(store: SessionStore, options: ServiceOptions = {}) {
  const { longPollMs = 0, pollAfterMs = 1800, now = Date.now } = options
  const waiters = new Map<string, Set<Waiter>>()

  function checkContent(content: Content) {
    if (options.validateContent && !options.validateContent(content)) {
      throw new SessionProblem(422, 'This board, cue or graphic is invalid and was withheld from the studio.')
    }
  }

  function waitForUpdate(id: string, timeout: number, signal: AbortSignal) {
    const listeners = waiters.get(id) ?? new Set<Waiter>()
    waiters.set(id, listeners)
    return new Promise<void>(resolve => {
      const timer = setTimeout(done, timeout)
      function done() {
        clearTimeout(timer)
        signal.removeEventListener('abort', done)
        listeners.delete(done)
        if (!listeners.size) waiters.delete(id)
        resolve()
      }
      listeners.add(done)
      signal.addEventListener('abort', done, { once: true })
      if (signal.aborted) done()
    })
  }

  function reply(data: object | null, status = 200) {
    return new Response(data ? JSON.stringify(data) : null, {
      status,
      headers: {
        'cache-control': 'private, no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
        'x-studio-poll-after': String(pollAfterMs),
        'x-studio-server-time': String(now()),
      },
    })
  }

  async function create(preview: Content) {
    checkContent(preview)
    const id = randomBytes(12).toString('base64url')
    const tokens = Object.fromEntries(roles.map(role => [role, randomBytes(32).toString('base64url')])) as SessionRecord['tokens']
    const timestamp = now()
    const record: SessionRecord = {
      schema: 1, id, revision: 0, tokens, preview, live: null, mode: 'preview', lock: null,
      access: { 'presenter-a': true, 'presenter-b': true },
      updatedAt: timestamp, previewUpdatedAt: timestamp, liveUpdatedAt: null, heldAt: null,
    }
    if (!await store.write(record)) throw new SessionProblem(503, 'Session creation collided. Please try again.')
    return reply({ credentials: { id, token: tokens.producer }, state: state(record, 'producer', timestamp) }, 201)
  }

  return async function handleSession(request: Request): Promise<Response> {
    try {
      if (request.method !== 'GET' && request.method !== 'POST') {
        return reply({ error: 'Only GET and POST are supported.' }, 405)
      }
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      const body = request.method === 'POST' ? await readBody(request) : null
      if (!id && body?.type === 'create') return await create(asObject(body.preview))
      if (!id || !sessionIdPattern.test(id)) throw new SessionProblem(400, 'A valid studio session ID is required.')
      const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1] ?? ''
      if (!tokenPattern.test(token)) throw new SessionProblem(401, 'This session link is missing or invalid.')

      let stored = await store.read(id, body ? 'write' : 'read')
      if (!stored) throw new SessionProblem(404, 'This studio session could not be found.')
      let { record } = stored
      const role = authorize(record, token)
      if (!body) {
        const since = url.searchParams.get('since')
        const knownLock = url.searchParams.get('lockUntil') ?? ''
        const unchanged = () => since === String(record.revision) &&
          knownLock === String(activeLock(record, now())?.expiresAt ?? '')
        if (unchanged() && longPollMs > 0) {
          const expiryDelay = Math.max(10, (activeLock(record, now())?.expiresAt ?? (now() + longPollMs)) - now())
          const waiting = new AbortController()
          const abort = () => waiting.abort()
          request.signal.addEventListener('abort', abort, { once: true })
          if (request.signal.aborted) abort()
          try {
            const update = waitForUpdate(id, Math.min(longPollMs, expiryDelay), waiting.signal)
            // Check after registration to catch a write between the first read and subscription.
            stored = await store.read(id)
            if (!stored) throw new SessionProblem(404, 'This studio session could not be found.')
            record = stored.record
            if (unchanged()) await update
          } finally {
            waiting.abort()
            request.signal.removeEventListener('abort', abort)
          }
          stored = await store.read(id)
          if (!stored) throw new SessionProblem(404, 'This studio session could not be found.')
          record = stored.record
        }
        return unchanged() ? reply(null, 204) : reply(state(record, role, now()))
      }

      const action = parseAction(body.action)
      const priority = role === 'producer' && (action.type === 'hold' || action.type === 'clear' ||
        (action.type === 'access' && !action.enabled))
      const conflict = () => reply({
        error: 'Another device changed the studio. Review the latest state and retry.',
        state: state(record, role, now()),
      }, 409)
      if (!priority && body.expectedRevision !== record.revision) return conflict()

      // Emergency commands act on the latest state and retry a bounded number
      // of times if a different client writes between the read and the CAS.
      const attempts = priority ? 3 : 1
      for (let attempt = 0; attempt < attempts; attempt++) {
        const next = apply(record, role, action, now())
        if (action.type === 'update' || action.type === 'stage') checkContent(action.content)
        if (await store.write(next, stored.version)) {
          waiters.get(id)?.forEach(notify => notify())
          return reply(state(next, role, now()))
        }
        stored = await store.read(id, attempt + 1 < attempts ? 'write' : 'read')
        if (!stored) throw new SessionProblem(404, 'This studio session could not be found.')
        record = stored.record
      }
      return conflict()
    } catch (error) {
      if (error instanceof SessionProblem) return reply({ error: error.message }, error.status)
      console.error('Studio session service failed.', error instanceof Error ? error.name : 'UnknownError')
      return reply({ error: 'Shared studio storage is temporarily unavailable.' }, 503)
    }
  }
}

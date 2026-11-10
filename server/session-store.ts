import { randomUUID } from 'node:crypto'
import { link, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PresenterRole, SessionLock, SessionMode, SessionRole } from '../src/session-types'

export interface SessionRecord {
  schema: 1
  id: string
  revision: number
  tokens: Record<SessionRole, string>
  preview: Record<string, unknown>
  live: Record<string, unknown> | null
  mode: SessionMode
  lock: SessionLock | null
  access: Record<PresenterRole, boolean>
  updatedAt: number
  previewUpdatedAt: number
  liveUpdatedAt: number | null
  heldAt: number | null
}

export interface StoredSession {
  record: SessionRecord
  version: string
}

export interface SessionStore {
  read(id: string): Promise<StoredSession | null>
  write(record: SessionRecord, expectedVersion?: string): Promise<boolean>
}

function code(error: unknown) {
  return (error as NodeJS.ErrnoException).code
}

export function diskSessionStore(directory: string): SessionStore {
  const pending = new Map<string, Promise<boolean>>()
  const sessionFile = (id: string) => join(directory, `${id}.json`)

  async function read(id: string): Promise<StoredSession | null> {
    try {
      const record = JSON.parse(await readFile(sessionFile(id), 'utf8')) as SessionRecord
      return { record, version: String(record.revision) }
    } catch (error) {
      if (code(error) === 'ENOENT') return null
      throw error
    }
  }

  async function save(record: SessionRecord, expectedVersion?: string): Promise<boolean> {
    const current = await read(record.id)
    if (current?.version !== expectedVersion) return false
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const target = sessionFile(record.id)
    const scratch = `${target}.${randomUUID()}.tmp`
    try {
      await writeFile(scratch, JSON.stringify(record), { mode: 0o600 })
      if (expectedVersion === undefined) {
        await link(scratch, target)
      } else {
        await rename(scratch, target)
      }
      return true
    } catch (error) {
      if (code(error) === 'EEXIST') return false
      throw error
    } finally {
      await rm(scratch, { force: true })
    }
  }

  return {
    read,
    async write(record, expectedVersion) {
      const before = pending.get(record.id)
      const task = (before ? before.catch(() => false) : Promise.resolve()).then(() => save(record, expectedVersion))
      pending.set(record.id, task)
      try {
        return await task
      } finally {
        if (pending.get(record.id) === task) pending.delete(record.id)
      }
    },
  }
}

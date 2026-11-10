import { beforeEach, expect, test, vi } from 'vitest'
import { BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob'
import { blobSessionStore } from '../server/blob-session-store'
import type { SessionRecord } from '../server/session-store'

const blob = vi.hoisted(() => ({
  get: vi.fn(), head: vi.fn(), put: vi.fn(),
}))

vi.mock('@vercel/blob', async importOriginal => ({
  ...await importOriginal<typeof import('@vercel/blob')>(),
  ...blob,
}))

const record: SessionRecord = {
  schema: 1, id: 'session-test-123', revision: 0, mode: 'preview',
  tokens: { producer: 'p', 'presenter-a': 'a', 'presenter-b': 'b', viewer: 'v' },
  access: { 'presenter-a': true, 'presenter-b': true },
  preview: { sceneId: 'opening' }, live: null, lock: null, heldAt: null,
  updatedAt: 0, previewUpdatedAt: 0, liveUpdatedAt: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  blob.head.mockResolvedValue({ etag: '"origin-cas-tag"' })
  blob.get.mockImplementation(async () => ({
    statusCode: 200,
    stream: new Response(JSON.stringify(record)).body,
    blob: { etag: 'W/"delivery-tag"' },
  }))
})

test('hosted reads avoid the metadata call and command CAS uses an earlier canonical origin tag', async () => {
  const store = blobSessionStore()
  await expect(store.read(record.id)).resolves.toEqual({ record, version: 'W/"delivery-tag"' })
  expect(blob.head).not.toHaveBeenCalled()
  const current = await store.read(record.id, 'write')
  expect(current?.version).toBe('"origin-cas-tag"')
  expect(blob.head.mock.invocationCallOrder[0]).toBeLessThan(blob.get.mock.invocationCallOrder[1])
  expect(blob.get).toHaveBeenLastCalledWith(`studio-sessions/v1/${record.id}.json`, { access: 'private', useCache: false })

  const update = { ...record, revision: 1, mode: 'live' as const, live: record.preview }
  await expect(store.write(update, current?.version)).resolves.toBe(true)
  expect(blob.put).toHaveBeenCalledWith(`studio-sessions/v1/${record.id}.json`, JSON.stringify(update), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, ifMatch: '"origin-cas-tag"', contentType: 'application/json',
  })
})

test('hosted commands never retry a failed conditional write as an unconditional write', async () => {
  const store = blobSessionStore()
  blob.head.mockRejectedValueOnce(new BlobNotFoundError())
  await expect(store.read(record.id, 'write')).resolves.toBeNull()
  expect(blob.get).not.toHaveBeenCalled()
  blob.put.mockRejectedValueOnce(new BlobPreconditionFailedError())
  await expect(store.write(record, '"stale"')).resolves.toBe(false)
  expect(blob.put).toHaveBeenCalledTimes(1)
})

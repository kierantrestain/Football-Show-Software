import { openDB, type DBSchema } from 'idb'

type FrameEntry = { id: string; blob: Blob; storedAt: number }
interface FrameCacheDb extends DBSchema {
  frames: { key: string; value: FrameEntry; indexes: { age: number } }
}

const maxCacheBytes = 64 * 1024 * 1024
const connect = () => openDB<FrameCacheDb>('touchline-programme-cache', 1, {
  upgrade(db) {
    db.createObjectStore('frames').createIndex('age', 'storedAt')
  },
})
let database: ReturnType<typeof connect> | undefined
const cache = () => (database ??= connect())

export async function cachedProgrammeFrame(id: string) {
  return (await (await cache()).get('frames', id))?.blob
}

export async function cacheProgrammeFrame(id: string, blob: Blob) {
  const transaction = (await cache()).transaction('frames', 'readwrite')
  await transaction.store.put({ id, blob, storedAt: Date.now() }, id)
  let cursor = await transaction.store.index('age').openCursor(null, 'prev')
  let total = 0
  while (cursor) {
    total += cursor.value.blob.size
    if (total > maxCacheBytes) await cursor.delete()
    cursor = await cursor.continue()
  }
  await transaction.done
}

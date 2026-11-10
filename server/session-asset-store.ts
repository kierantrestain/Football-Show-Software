import { link, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface SessionAssetStore {
  exists(id: string, key: string): Promise<boolean>
  get(id: string, key: string): Promise<Uint8Array<ArrayBuffer> | null>
  put(id: string, key: string, bytes: Uint8Array<ArrayBuffer>): Promise<void>
}

export function diskAssetStore(directory: string): SessionAssetStore {
  const folder = (id: string) => join(directory, 'media', id)
  const path = (id: string, key: string) => join(folder(id), `${key}.jpg`)
  return {
    async exists(id, key) {
      try {
        return (await stat(path(id, key))).isFile()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
        throw error
      }
    },
    async get(id, key) {
      try {
        return new Uint8Array(await readFile(path(id, key)))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
    },
    async put(id, key, bytes) {
      await mkdir(folder(id), { recursive: true, mode: 0o700 })
      const scratch = join(folder(id), `${randomUUID()}.tmp`)
      try {
        await writeFile(scratch, bytes, { mode: 0o600 })
        await link(scratch, path(id, key))
      } catch (error) {
        // The key is the digest of the content. A simultaneous identical upload
        // can safely reuse the first complete file.
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      } finally {
        await rm(scratch, { force: true })
      }
    },
  }
}

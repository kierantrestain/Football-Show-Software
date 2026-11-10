import { BlobNotFoundError, get, head, put } from '@vercel/blob'
import type { SessionAssetStore } from './session-asset-store'

const pathname = (id: string, key: string) => `studio-sessions/v1/media/${id}/${key}.jpg`

export function blobAssetStore(oidcToken?: string): SessionAssetStore {
  const credentials = oidcToken ? { oidcToken } : {}
  async function exists(id: string, key: string) {
    try {
      await head(pathname(id, key), credentials)
      return true
    } catch (error) {
      if (error instanceof BlobNotFoundError) return false
      throw error
    }
  }
  return {
    exists,
    async get(id, key) {
      const blob = await get(pathname(id, key), { ...credentials, access: 'private', useCache: false })
      if (!blob || blob.statusCode !== 200) return null
      return new Uint8Array(await new Response(blob.stream).arrayBuffer())
    },
    async put(id, key, bytes) {
      if (await exists(id, key)) return
      // The digest scopes these writes to identical content. Retrying an
      // upload cannot change a frame that has already been staged.
      await put(pathname(id, key), Buffer.from(bytes), {
        ...credentials, access: 'private', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true,
      })
    },
  }
}

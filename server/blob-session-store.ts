import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from '@vercel/blob'
import type { SessionRecord, SessionStore } from './session-store'

const pathname = (id: string) => `studio-sessions/v1/${id}.json`

export function blobSessionStore(oidcToken?: string): SessionStore {
  const credentials = oidcToken ? { oidcToken } : {}
  return {
    async read(id, purpose) {
      const key = pathname(id)
      let writeVersion: string | undefined
      if (purpose === 'write') {
        try {
          // The control API's ETag is the CAS token. Read it before the
          // uncached body so a concurrent change can only invalidate the token.
          writeVersion = (await head(key, credentials)).etag
          if (!writeVersion) throw new Error('Missing conditional write version.')
        } catch (error) {
          if (error instanceof BlobNotFoundError) return null
          throw error
        }
      }
      const blob = await get(key, { ...credentials, access: 'private', useCache: false })
      if (!blob || blob.statusCode !== 200) return null
      const record = await new Response(blob.stream).json() as SessionRecord
      return { record, version: writeVersion ?? blob.blob.etag }
    },
    async write(record, expectedVersion) {
      try {
        await put(pathname(record.id), JSON.stringify(record), {
          ...credentials,
          access: 'private',
          contentType: 'application/json',
          addRandomSuffix: false,
          ...(expectedVersion === undefined ? {} : { allowOverwrite: true, ifMatch: expectedVersion }),
        })
        return true
      } catch (error) {
        if (error instanceof BlobPreconditionFailedError) return false
        throw error
      }
    },
  }
}

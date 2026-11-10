import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import type { SessionRecord, SessionStore } from './session-store'

const pathname = (id: string) => `studio-sessions/v1/${id}.json`

export function blobSessionStore(oidcToken?: string): SessionStore {
  const credentials = oidcToken ? { oidcToken } : {}
  return {
    async read(id) {
      const blob = await get(pathname(id), { ...credentials, access: 'private', useCache: false })
      if (!blob || blob.statusCode !== 200) return null
      const record = await new Response(blob.stream).json() as SessionRecord
      return { record, version: blob.blob.etag }
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

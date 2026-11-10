import { frameKeyPattern, MAX_FRAME_BYTES, validMediaManifest } from '../src/media-reference.js'
import { authorize, readSessionCredentials, SessionProblem } from './session-service.js'
import { frameDigest, frameDimensions, readableFrame } from './session-frame.js'
import type { SessionStore } from './session-store'
import type { SessionAssetStore } from './session-asset-store'

const responseHeaders = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', vary: 'Authorization' }
const frameError = (status: number, error: string) => Response.json({ error }, { status, headers: responseHeaders })

async function readFrame(request: Request) {
  if (request.headers.get('content-type')?.toLowerCase() !== 'image/jpeg') throw new SessionProblem(415, 'Send a prepared JPEG frame.')
  if (Number(request.headers.get('content-length')) > MAX_FRAME_BYTES) throw new SessionProblem(413, 'A prepared frame exceeds the 4 MiB upload limit.')
  const reader = request.body?.getReader()
  if (!reader) throw new SessionProblem(400, 'The prepared frame is empty.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_FRAME_BYTES) {
        void reader.cancel().catch(() => undefined)
        throw new SessionProblem(413, 'A prepared frame exceeds the 4 MiB upload limit.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return new Uint8Array(Buffer.concat(chunks, size))
}

export function sessionAssetService(sessions: SessionStore, assets: SessionAssetStore) {
  return async (request: Request) => {
    try {
      if (request.method !== 'GET' && request.method !== 'POST') return frameError(405, 'Only GET and POST are supported.')
      const { id, token } = readSessionCredentials(request)
      const stored = await sessions.read(id)
      if (!stored) return frameError(404, 'This studio session could not be found.')
      const record = stored.record
      const role = authorize(record, token)
      if (request.method === 'POST') {
        if (role !== 'producer') return frameError(403, 'Only the producer may upload frames.')
        const bytes = await readFrame(request)
        const dimensions = frameDimensions(bytes)
        if (!dimensions) return frameError(422, 'The prepared image is unreadable or larger than 3840 pixels on one edge.')
        const key = frameDigest(bytes)
        await assets.put(id, key, bytes)
        return Response.json({ key, ...dimensions }, { status: 201, headers: responseHeaders })
      }

      if (role !== 'producer' && role !== 'viewer' && !record.access[role]) return frameError(403, 'This presenter link no longer has access.')
      const key = new URL(request.url).searchParams.get('key') ?? ''
      if (!frameKeyPattern.test(key)) return frameError(400, 'A valid prepared frame key is required.')
      const snapshots = role === 'viewer' ? [record.live] : [record.preview, record.live]
      if (!snapshots.some(snapshot => {
        const manifest = snapshot?.mediaManifest
        return validMediaManifest(manifest) && Object.values(manifest).some(frame => frame.key === key)
      })) return frameError(404, 'This frame is outside the staged programme.')
      const bytes = await assets.get(id, key)
      if (!readableFrame(bytes, key)) {
        return frameError(404, 'The staged frame is missing or unreadable.')
      }
      return new Response(bytes, {
        headers: { ...responseHeaders, 'content-type': 'image/jpeg', 'content-length': String(bytes.byteLength) },
      })
    } catch (error) {
      if (error instanceof SessionProblem) return frameError(error.status, error.message)
      console.error('Studio frame service failed.', error instanceof Error ? error.name : 'UnknownError')
      return frameError(503, 'Staged frame storage is temporarily unavailable.')
    }
  }
}

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { extname, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { pathToFileURL } from 'node:url'
import { handleFootball } from '../api/football'
import { sessionService } from './session-service'
import { diskSessionStore } from './session-store'
import { validStudioSnapshot } from './studio-snapshot'

const mime: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function browserRequest(request: IncomingMessage, response: ServerResponse, url: URL) {
  const headers = new Headers()
  for (const [name, values] of Object.entries(request.headers)) {
    if (typeof values === 'string') headers.set(name, values)
    else values?.forEach(value => headers.append(name, value))
  }
  const controller = new AbortController()
  response.once('close', () => controller.abort())
  const body = request.method !== 'GET' && request.method !== 'HEAD'
    ? Readable.toWeb(request) as unknown as ReadableStream<Uint8Array>
    : undefined
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method, headers, body, signal: controller.signal,
    ...(body ? { duplex: 'half' } : {}),
  }
  return new Request(url, init)
}

async function writeResponse(response: ServerResponse, data: Response) {
  if (response.destroyed) return
  response.writeHead(data.status, Object.fromEntries(data.headers))
  if (data.body) await pipeline(Readable.fromWeb(data.body as NodeReadableStream), response)
  else response.end()
}

interface StudioServerOptions {
  sessionDirectory?: string
  staticDirectory?: string
  longPollMs?: number
}

export function createStudioServer(options: StudioServerOptions = {}) {
  const sessionDirectory = options.sessionDirectory ?? process.env.STUDIO_SESSION_DIR ?? '.studio-sessions'
  const staticDirectory = resolve(options.staticDirectory ?? 'dist')
  const handleSession = sessionService(diskSessionStore(sessionDirectory), {
    longPollMs: options.longPollMs ?? 14_000,
    pollAfterMs: 100,
    validateContent: validStudioSnapshot,
  })

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://studio.local')
      if (url.pathname === '/api/session') {
        return await writeResponse(response, await handleSession(browserRequest(request, response, url)))
      }
      if (url.pathname === '/api/football') {
        return await writeResponse(response, await handleFootball(browserRequest(request, response, url)))
      }
      if (url.pathname.startsWith('/api/')) {
        response.writeHead(404).end('Studio API route not found.')
        return
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' }).end()
        return
      }

      const pathname = decodeURIComponent(url.pathname)
      let file = resolve(staticDirectory, `.${pathname}`)
      if (file !== staticDirectory && !file.startsWith(staticDirectory + sep)) {
        response.writeHead(404).end()
        return
      }
      let info = await stat(file).catch(() => null)
      if (!info?.isFile() && !extname(pathname)) {
        file = resolve(staticDirectory, 'index.html')
        info = await stat(file).catch(() => null)
      }
      if (!info?.isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          .end(extname(pathname) ? 'Asset not found.' : 'The studio web build is missing. Run npm run build and refresh.')
        return
      }
      response.writeHead(200, {
        'content-type': mime[extname(file)] ?? 'application/octet-stream',
        'content-length': info.size,
        'cache-control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      })
      if (request.method === 'HEAD') response.end()
      else await pipeline(createReadStream(file), response)
    } catch {
      if (!response.headersSent && !response.destroyed) response.writeHead(500).end('The studio server could not complete the request.')
      else if (!response.destroyed) response.end()
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.STUDIO_HOST ?? '0.0.0.0'
  const port = Number(process.env.STUDIO_PORT ?? 8787)
  const server = createStudioServer()
  server.listen(port, host, () => {
    const addresses = Object.values(networkInterfaces()).flat().filter(address =>
      address?.family === 'IPv4' && !address.internal).map(address => address?.address)
    console.log(`Studio server listening at http://localhost:${port}`)
    if (host === '0.0.0.0') addresses.forEach(address => console.log(`Tablet and TV access: http://${address}:${port}`))
  })
}

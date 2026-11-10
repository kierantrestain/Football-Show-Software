import { blobSessionStore } from '../server/blob-session-store.js'
import { sessionService } from '../server/session-service.js'
import { validStudioSnapshot } from '../server/studio-snapshot.js'

export default {
  fetch(request: Request) {
    const oidcToken = request.headers.get('x-vercel-oidc-token') ?? process.env.VERCEL_OIDC_TOKEN
    const useOidc = Boolean(process.env.BLOB_STORE_ID && oidcToken)
    if (!process.env.BLOB_READ_WRITE_TOKEN && !useOidc) {
      return Response.json({ error: 'Shared studio sessions require connected private storage. Use the LAN studio server to connect devices locally.' }, {
        status: 503,
        headers: { 'cache-control': 'no-store' },
      })
    }
    return sessionService(blobSessionStore(useOidc ? oidcToken : undefined), { validateContent: validStudioSnapshot })(request)
  },
}

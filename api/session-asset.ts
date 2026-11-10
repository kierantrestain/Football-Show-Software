import { blobAssetStore } from '../server/blob-session-asset-store.js'
import { blobSessionStore } from '../server/blob-session-store.js'
import { sessionAssetService } from '../server/session-asset-service.js'

export default {
  fetch(request: Request) {
    const oidcToken = request.headers.get('x-vercel-oidc-token') ?? process.env.VERCEL_OIDC_TOKEN
    const useOidc = Boolean(process.env.BLOB_STORE_ID && oidcToken)
    if (!process.env.BLOB_READ_WRITE_TOKEN && !useOidc) {
      return Response.json({ error: 'Shared studio frames require connected private storage.' }, {
        status: 503, headers: { 'cache-control': 'no-store' },
      })
    }
    const token = useOidc ? oidcToken : undefined
    return sessionAssetService(blobSessionStore(token), blobAssetStore(token))(request)
  },
}

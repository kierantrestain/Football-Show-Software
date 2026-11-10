const cacheName = 'touchline-shell-v2'
const shellPath = '/index.html'

async function retainShell(cache, response) {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return
  const html = await response.clone().text()
  const paths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1])
  await Promise.all(paths.map(async path => {
    if (!await cache.match(path)) await cache.add(path)
  }))
  await cache.put(shellPath, response)
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    const response = await fetch(shellPath, { cache: 'reload' })
    if (!response.ok) throw new Error('Studio shell unavailable')
    await retainShell(cache, response)
    await cache.add('/touchline.svg')
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('touchline-shell-') && name !== cacheName) await caches.delete(name)
  await self.clients.claim()
})()))

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return
  if (event.request.mode === 'navigate') {
    const online = fetch(event.request)
    event.waitUntil(online.then(async response => retainShell(await caches.open(cacheName), response.clone())).catch(() => {}))
    event.respondWith(online.catch(() => caches.match(shellPath)))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName)
      const cached = await cache.match(event.request)
      if (cached) return cached
      const response = await fetch(event.request)
      if (response.ok) await cache.put(event.request, response.clone())
      return response
    })())
  }
})

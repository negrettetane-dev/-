const VECTOR_CACHE = 'zhitu-offline-vector-packs-v1'

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (!url.pathname.startsWith('/__zhitu_offline_vector__/')) return
  event.respondWith((async () => {
    const cache = await caches.open(VECTOR_CACHE)
    const stored = await cache.match(new Request(url.href))
    if (!stored) return new Response('Offline map package not found', { status: 404 })
    const range = event.request.headers.get('range')
    if (!range) return stored
    const blob = await stored.blob()
    const match = /bytes=(\d+)-(\d*)/.exec(range)
    if (!match) return stored
    const start = Number(match[1])
    const end = match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1
    if (start >= blob.size || end < start) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${blob.size}` } })
    return new Response(blob.slice(start, end + 1), { status: 206, headers: { 'content-type': 'application/vnd.pmtiles', 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${blob.size}`, 'accept-ranges': 'bytes' } })
  })())
})

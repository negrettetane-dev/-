import type { OfflinePack } from '../types'

const CACHE_NAME = 'zhitu-offline-packs-v1'
const VECTOR_CACHE_NAME = 'zhitu-offline-vector-packs-v1'
const key = (city: string) => new Request(`/__zhitu_offline__/${city}`)
const vectorKey = (city: string) => new Request(`/__zhitu_offline_vector__/${city}.pmtiles`)

export async function getOfflinePack(city: string): Promise<OfflinePack | undefined> {
  const response = await (await caches.open(CACHE_NAME)).match(key(city))
  return response ? response.json() as Promise<OfflinePack> : undefined
}

export async function saveOfflinePack(pack: OfflinePack) {
  await (await caches.open(CACHE_NAME)).put(key(pack.city), new Response(JSON.stringify(pack), { headers: { 'content-type': 'application/json' } }))
}

export async function removeOfflinePack(city: string) {
  return (await caches.open(CACHE_NAME)).delete(key(city))
}

export async function installedOfflineCities() {
  const requests = await (await caches.open(CACHE_NAME)).keys()
  return requests.map(request => request.url.split('/').pop() || '')
}

export async function saveOfflineVectorPack(city: string, file: File) {
  const headers = new Headers({ 'content-type': 'application/vnd.pmtiles', 'x-zhitu-file-name': file.name })
  await (await caches.open(VECTOR_CACHE_NAME)).put(vectorKey(city), new Response(file.stream(), { headers }))
}

export async function hasOfflineVectorPack(city: string) {
  return Boolean(await (await caches.open(VECTOR_CACHE_NAME)).match(vectorKey(city)))
}

export function offlineVectorUrl(city: string) {
  return new URL(`/__zhitu_offline_vector__/${city}.pmtiles`, window.location.origin).toString()
}

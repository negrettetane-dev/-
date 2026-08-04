<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PMTiles, Protocol } from 'pmtiles'
import type { Coordinate, Event, MobilityPoi, Segment } from '../types'

const props = defineProps<{ sourceUrl: string; segments: Segment[]; events?: Event[]; pois?: MobilityPoi[]; focus?: Coordinate & { zoom?: number }; trafficVisible?: boolean }>()
const emit = defineEmits<{ select: [Segment]; selectPoi: [MobilityPoi] }>()
const host = ref<HTMLElement>()
const failed = ref(false)
let map: maplibregl.Map | undefined
let protocol: Protocol | undefined

const roadColor = (level: string) => level === '严重拥堵' ? '#ef4444' : level === '拥堵' ? '#f97316' : level === '缓行' ? '#f59e0b' : '#10b981'
const point = (item: Coordinate) => [item.lng, item.lat] as [number, number]

function updateOverlays() {
  if (!map || !map.isStyleLoaded()) return
  const traffic = map.getSource('traffic') as maplibregl.GeoJSONSource | undefined
  const events = map.getSource('events') as maplibregl.GeoJSONSource | undefined
  const pois = map.getSource('pois') as maplibregl.GeoJSONSource | undefined
  traffic?.setData({ type: 'FeatureCollection', features: props.trafficVisible === false ? [] : props.segments.map(segment => ({ type: 'Feature' as const, properties: { id: segment.id, color: roadColor(segment.congestion_level), name: segment.name }, geometry: { type: 'LineString' as const, coordinates: segment.coordinates.map(point) } })) })
  events?.setData({ type: 'FeatureCollection', features: (props.events || []).map(event => ({ type: 'Feature' as const, properties: { title: event.title }, geometry: { type: 'Point' as const, coordinates: point(event.location) } })) })
  pois?.setData({ type: 'FeatureCollection', features: (props.pois || []).map(poi => ({ type: 'Feature' as const, properties: { id: poi.id, name: poi.name }, geometry: { type: 'Point' as const, coordinates: point(poi) } })) })
}

onMounted(() => {
  if (!host.value) return
  protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
  protocol.add(new PMTiles(props.sourceUrl))
  map = new maplibregl.Map({
    container: host.value,
    center: props.focus ? point(props.focus) : [116.397, 39.908],
    zoom: props.focus?.zoom || 12,
    style: {
      version: 8,
      sources: {
        city: { type: 'vector', url: `pmtiles://${props.sourceUrl}` },
        traffic: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        events: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        pois: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#f7f9fc' } },
        { id: 'water', type: 'fill', source: 'city', 'source-layer': 'water', paint: { 'fill-color': '#b9dff5' } },
        { id: 'park', type: 'fill', source: 'city', 'source-layer': 'landuse', filter: ['==', ['get', 'class'], 'park'], paint: { 'fill-color': '#ccebc5' } },
        { id: 'roads', type: 'line', source: 'city', 'source-layer': 'transportation', paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 14, 3] } },
        { id: 'traffic', type: 'line', source: 'traffic', paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': .9 } },
        { id: 'events', type: 'circle', source: 'events', paint: { 'circle-radius': 7, 'circle-color': '#ef4444', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
        { id: 'pois', type: 'circle', source: 'pois', paint: { 'circle-radius': 6, 'circle-color': '#1677ff', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
      ],
    },
  })
  map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
  map.on('load', updateOverlays)
  map.on('error', () => { failed.value = true })
  map.on('click', 'traffic', (event: maplibregl.MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id
    const segment = props.segments.find(item => item.id === id)
    if (segment) emit('select', segment)
  })
  map.on('click', 'pois', (event: maplibregl.MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id
    const poi = props.pois?.find(item => item.id === id)
    if (poi) emit('selectPoi', poi)
  })
})

watch(() => [props.segments, props.events, props.pois, props.trafficVisible], updateOverlays, { deep: true })
watch(() => props.focus, value => { if (value) map?.flyTo({ center: point(value), zoom: value.zoom || map.getZoom() }) }, { deep: true })
onUnmounted(() => { map?.remove(); if (protocol) maplibregl.removeProtocol('pmtiles') })
</script>

<template>
  <div class="offline-vector-map"><div ref="host" class="offline-vector-host"></div><div v-if="failed" class="map-fallback-note">离线矢量包无法读取，请检查数据包和样式兼容性。</div></div>
</template>

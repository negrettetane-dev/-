<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AMapLoader from '@amap/amap-jsapi-loader'
import type { Coordinate, Event, MobilityPoi, RouteOption, Segment } from '../types'

const OfflineVectorMap = defineAsyncComponent(() => import('./OfflineVectorMap.vue'))

const props = withDefaults(defineProps<{ segments: Segment[]; events?: Event[]; pois?: MobilityPoi[]; selectedId?: string; selectedPoiId?: string; route?: RouteOption; focus?: Coordinate & { zoom?: number }; cityName?: string; trafficVisible?: boolean; viewMode?: '2D' | '3D'; offlineMode?: boolean; offlineVectorSource?: string }>(), { trafficVisible: true, viewMode: '3D', offlineMode: false })
const emit = defineEmits<{ select: [Segment]; selectPoi: [MobilityPoi] }>()
const mapContainer = ref<HTMLElement>()
const mapReady = ref(false)
const mapFailed = ref(false)
let map: any
let AMap: any
let overlays: any[] = []

const mapBounds = computed(() => {
  const points = [
    ...props.segments.flatMap(segment => segment.coordinates),
    ...(props.events || []).map(event => event.location),
    ...(props.pois || []),
    ...(props.route?.path || []),
    ...(props.focus ? [props.focus] : []),
  ]
  if (!points.length) return { minLng: 116.36, maxLng: 116.445, minLat: 39.86, maxLat: 40.005 }
  const lngs = points.map(point => point.lng)
  const lats = points.map(point => point.lat)
  const lngSpan = Math.max(Math.max(...lngs) - Math.min(...lngs), .01)
  const latSpan = Math.max(Math.max(...lats) - Math.min(...lats), .01)
  return { minLng: Math.min(...lngs) - lngSpan * .14, maxLng: Math.max(...lngs) + lngSpan * .14, minLat: Math.min(...lats) - latSpan * .14, maxLat: Math.max(...lats) + latSpan * .14 }
})
const xy = (lng: number, lat: number) => ({
  x: ((lng - mapBounds.value.minLng) / (mapBounds.value.maxLng - mapBounds.value.minLng)) * 900,
  y: 460 - ((lat - mapBounds.value.minLat) / (mapBounds.value.maxLat - mapBounds.value.minLat)) * 420,
})
const roads = computed(() => props.segments.map(segment => ({
  ...segment,
  points: segment.coordinates.map(point => {
    const p = xy(point.lng, point.lat)
    return `${p.x},${p.y}`
  }).join(' '),
})))
const routePoints = computed(() => props.route?.path.map(point => {
  const p = xy(point.lng, point.lat)
  return `${p.x},${p.y}`
}).join(' '))
const focusPoint = computed(() => props.focus ? xy(props.focus.lng, props.focus.lat) : undefined)
const token = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
const color = (level: string) => {
  if (level === '严重拥堵') return token('--color-danger', '#ef4444')
  if (level === '拥堵') return token('--color-warning', '#f97316')
  if (level === '缓行') return token('--color-caution', '#f59e0b')
  return token('--color-success', '#10b981')
}
const routeColor = () => token('--color-accent', '#00d5ff')

function applyFocus() {
  if (!map || !props.focus) return
  map.panTo([props.focus.lng, props.focus.lat])
  if (props.focus.zoom) map.setZoom(props.focus.zoom)
}

function renderOverlays() {
  if (!map || !AMap) return
  map.remove(overlays)
  overlays = []
  if (props.trafficVisible) props.segments.forEach(segment => {
    const line = new AMap.Polyline({
      path: segment.coordinates.map(point => [point.lng, point.lat]),
      strokeColor: color(segment.congestion_level),
      strokeWeight: props.selectedId === segment.id ? 12 : 8,
      strokeOpacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
      zIndex: props.selectedId === segment.id ? 30 : 20,
    })
    line.on('click', () => emit('select', segment))
    overlays.push(line)
  })
  props.events?.forEach(event => overlays.push(new AMap.Marker({
    position: [event.location.lng, event.location.lat],
    title: event.title,
    content: '<div class="amap-event-dot"><span></span></div>',
    offset: new AMap.Pixel(-10, -10),
    zIndex: 40,
  })))
  props.pois?.forEach(poi => {
    const marker = new AMap.Marker({
      position: [poi.lng, poi.lat],
      title: poi.name,
      content: `<button class="amap-poi-marker${props.selectedPoiId === poi.id ? ' selected' : ''}" aria-label="${poi.name}"><span></span></button>`,
      offset: new AMap.Pixel(-13, -26),
      zIndex: props.selectedPoiId === poi.id ? 70 : 45,
    })
    marker.on('click', () => emit('selectPoi', poi))
    overlays.push(marker)
  })
  if (props.route) overlays.push(new AMap.Polyline({
    path: props.route.path.map(point => [point.lng, point.lat]),
    strokeColor: routeColor(),
    strokeWeight: 8,
    strokeOpacity: 0.95,
    strokeStyle: 'dashed',
    zIndex: 50,
  }))
  map.add(overlays)
}

onMounted(async () => {
  if (props.offlineMode) {
    mapFailed.value = true
    return
  }
  const key = import.meta.env.VITE_AMAP_KEY
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE
  if (!key || !securityCode || !mapContainer.value) return
  try {
    ;(window as any)._AMapSecurityConfig = { securityJsCode: securityCode }
    AMap = await AMapLoader.load({ key, version: '2.0', plugins: ['AMap.Scale', 'AMap.ToolBar'] })
    map = new AMap.Map(mapContainer.value, {
      center: props.focus ? [props.focus.lng, props.focus.lat] : [(mapBounds.value.minLng + mapBounds.value.maxLng) / 2, (mapBounds.value.minLat + mapBounds.value.maxLat) / 2],
      zoom: props.focus?.zoom || 12.8,
      viewMode: '3D',
      pitch: props.viewMode === '3D' ? 35 : 0,
      mapStyle: 'amap://styles/darkblue',
      showLabel: true,
    })
    map.addControl(new AMap.Scale())
    map.addControl(new AMap.ToolBar({ position: { right: '12px', top: '64px' } }))
    mapReady.value = true
    await nextTick()
    renderOverlays()
  } catch (error) {
    console.warn('高德地图加载失败，已切换到本地仿真地图。', error)
    mapFailed.value = true
  }
})

watch(() => [props.segments, props.events, props.pois, props.selectedId, props.selectedPoiId, props.route, props.trafficVisible], renderOverlays, { deep: true })
watch(() => props.focus, applyFocus, { deep: true })
watch(() => props.viewMode, value => map?.setPitch(value === '3D' ? 35 : 0))
watch(() => props.offlineMode, value => {
  if (value) { map?.destroy(); map = undefined; mapReady.value = false; mapFailed.value = true }
})
onUnmounted(() => map?.destroy())
</script>

<template>
  <div class="traffic-map">
    <OfflineVectorMap v-if="offlineMode && offlineVectorSource" :source-url="offlineVectorSource" :segments="segments" :events="events" :pois="pois" :focus="focus" :traffic-visible="trafficVisible" @select="emit('select', $event)" @select-poi="emit('selectPoi', $event)" />
    <div v-else ref="mapContainer" class="amap-host" :class="{ visible: mapReady }"></div>
    <svg v-if="!mapReady && !(offlineMode && offlineVectorSource)" viewBox="0 0 900 500" role="img" :aria-label="`${cityName || '城市'}交通仿真地图`">
      <rect width="900" height="500" class="map-paper" />
      <path class="coast" d="M120 0 C90 90 155 160 120 235 C88 310 142 405 105 500 L0 500 L0 0Z" />
      <g class="grid">
        <path v-for="n in 8" :key="`v${n}`" :d="`M ${n * 100} 0 V500`" />
        <path v-for="n in 5" :key="`h${n}`" :d="`M0 ${n * 90} H900`" />
      </g>
      <text x="36" y="46" class="map-label">{{ cityName || '城市' }}示范路网 · 仿真态势</text>
      <polyline
        v-for="road in trafficVisible ? roads : []"
        :key="road.id"
        :points="road.points"
        fill="none"
        :stroke="color(road.congestion_level)"
        :stroke-width="selectedId === road.id ? 13 : 8"
        :class="['road', { selected: selectedId === road.id }]"
        @click="emit('select', road)"
      />
      <polyline v-if="routePoints" :points="routePoints" fill="none" :stroke="routeColor()" stroke-width="8" stroke-dasharray="14 8" class="route-line" />
      <g v-for="event in events" :key="event.id" :transform="`translate(${xy(event.location.lng, event.location.lat).x} ${xy(event.location.lng, event.location.lat).y})`">
        <circle r="14" class="event-halo" />
        <circle r="5" class="event-core" />
      </g>
      <g v-if="focusPoint" :transform="`translate(${focusPoint.x} ${focusPoint.y})`" class="focus-beacon">
        <circle r="20" />
        <circle r="6" />
      </g>
      <g v-for="poi in pois" :key="poi.id" :transform="`translate(${xy(poi.lng, poi.lat).x} ${xy(poi.lng, poi.lat).y})`" :class="['poi-beacon', { selected: selectedPoiId === poi.id }]" role="button" tabindex="0" @click="emit('selectPoi', poi)" @keydown.enter="emit('selectPoi', poi)">
        <path d="M0 -13C-7 -13 -11 -8 -11 -2C-11 6 0 16 0 16S11 6 11 -2C11 -8 7 -13 0 -13Z" />
        <circle cy="-2" r="3" />
      </g>
    </svg>
    <div v-if="mapFailed && !(offlineMode && offlineVectorSource)" class="map-fallback-note">{{ offlineMode ? '离线地图包已启用' : '在线底图不可用，已启用本地地图' }}</div>
    <div v-if="trafficVisible" class="legend">
      <span><i class="green"></i>畅通</span>
      <span><i class="yellow"></i>缓行</span>
      <span><i class="orange"></i>拥堵</span>
      <span><i class="red"></i>严重拥堵</span>
    </div>
  </div>
</template>

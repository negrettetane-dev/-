<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as THREE from 'three'
import type { Event, Segment } from '../types'

const props = defineProps<{ segments: Segment[]; events?: Event[]; selectedId?: string; cityName?: string; center?: { lng: number; lat: number } }>()
const emit = defineEmits<{ select: [Segment] }>()
const host = ref<HTMLElement>()
const selected = ref<string | undefined>(props.selectedId)
let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let frame = 0
let lastFrameAt = 0
let sceneVisible = true
let sceneObserver: IntersectionObserver | undefined
let roadGroup: THREE.Group | undefined
let pulseGroup: THREE.Group | undefined
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const roadMeshes = new Map<THREE.Object3D, Segment>()

const bounds = computed(() => {
  const points = [...props.segments.flatMap(segment => segment.coordinates), ...(props.events || []).map(event => event.location), ...(props.center ? [props.center] : [])]
  if (!points.length) return { minLng: 116.36, maxLng: 116.445, minLat: 39.86, maxLat: 40.005 }
  const lngs = points.map(point => point.lng)
  const lats = points.map(point => point.lat)
  const lngSpan = Math.max(Math.max(...lngs) - Math.min(...lngs), .01)
  const latSpan = Math.max(Math.max(...lats) - Math.min(...lats), .01)
  return { minLng: Math.min(...lngs) - lngSpan * .18, maxLng: Math.max(...lngs) + lngSpan * .18, minLat: Math.min(...lats) - latSpan * .18, maxLat: Math.max(...lats) + latSpan * .18 }
})
const project = (lng: number, lat: number) => new THREE.Vector3(
  ((lng - bounds.value.minLng) / (bounds.value.maxLng - bounds.value.minLng) - .5) * 18,
  .05,
  -(((lat - bounds.value.minLat) / (bounds.value.maxLat - bounds.value.minLat) - .5) * 10),
)
const levelColor = (level: string) => level === '严重拥堵' ? 0xef4444 : level === '拥堵' ? 0xf97316 : level === '缓行' ? 0xf59e0b : 0x10b981
const activeName = computed(() => props.segments.find(item => item.id === selected.value)?.name || `${props.cityName || '城市'}示范路网`)

function makeRoad(segment: Segment) {
  const points = segment.coordinates.map(point => project(point.lng, point.lat))
  const curve = new THREE.CatmullRomCurve3(points)
  const geometry = new THREE.TubeGeometry(curve, 32, selected.value === segment.id ? .075 : .05, 8, false)
  const material = new THREE.MeshStandardMaterial({
    color: levelColor(segment.congestion_level),
    emissive: levelColor(segment.congestion_level),
    emissiveIntensity: selected.value === segment.id ? 1.25 : .58,
    roughness: .38,
    metalness: .18,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData.segmentId = segment.id
  roadMeshes.set(mesh, segment)

  const markerGeometry = new THREE.SphereGeometry(selected.value === segment.id ? .16 : .09, 16, 16)
  const markerMaterial = new THREE.MeshBasicMaterial({ color: levelColor(segment.congestion_level) })
  const marker = new THREE.Mesh(markerGeometry, markerMaterial)
  marker.position.copy(points[Math.floor(points.length / 2)])
  marker.position.y = selected.value === segment.id ? .56 : .35
  marker.userData.segmentId = segment.id
  roadMeshes.set(marker, segment)

  roadGroup?.add(mesh, marker)
}

function rebuildRoads() {
  if (!roadGroup || !pulseGroup) return
  for (const group of [roadGroup, pulseGroup]) {
    group.traverse(object => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose()
      if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose())
      else mesh.material?.dispose()
    })
  }
  roadGroup.clear()
  pulseGroup.clear()
  roadMeshes.clear()
  props.segments.forEach(makeRoad)
  props.events?.forEach(event => {
    const point = project(event.location.lng, event.location.lat)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(.28, .018, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: .82 }),
    )
    ring.position.set(point.x, .22, point.z)
    ring.rotation.x = Math.PI / 2
    pulseGroup?.add(ring)
  })
}

function buildCity() {
  if (!scene) return
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(20, .18, 12),
    new THREE.MeshStandardMaterial({ color: 0x0b1627, roughness: .72, metalness: .2 }),
  )
  base.position.y = -.1
  scene.add(base)

  const grid = new THREE.GridHelper(20, 20, 0x00d5ff, 0x17324a)
  grid.position.y = .01
  scene.add(grid)

  const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x182944, emissive: 0x06182a, roughness: .5, metalness: .28 })
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x0f766e, emissive: 0x0f766e, emissiveIntensity: .22 })
  const blocks = [
    [-7.2, -3.2, .8, 1.2, 1.6], [-5.6, -2.1, .9, 1.6, 1.1], [-4.4, 2.4, 1.2, 1.8, 1.2],
    [-1.8, -3.4, 1.4, 1.1, 1.5], [.4, -1.7, .9, 2.2, 1.1], [2.2, 2.8, 1.5, 1.6, 1.3],
    [4.4, .2, 1.1, 1.7, 1.8], [6.4, 3.4, 1.8, 2.2, 1.2], [7.4, -2.5, 1.3, 1.6, 1.6],
  ]
  blocks.forEach(([x, z, h, w, d], index) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), index === 7 ? accentMaterial : buildingMaterial)
    mesh.position.set(x, h / 2, z)
    scene?.add(mesh)
  })

  roadGroup = new THREE.Group()
  pulseGroup = new THREE.Group()
  scene.add(roadGroup, pulseGroup)
  rebuildRoads()
}

function animate(time = performance.now()) {
  if (!renderer || !scene || !camera) return
  frame = requestAnimationFrame(animate)
  if (!sceneVisible || document.hidden || time - lastFrameAt < 33) return
  lastFrameAt = time
  const seconds = time * .001
  if (pulseGroup) {
    pulseGroup.children.forEach((child: THREE.Object3D, index: number) => {
      child.scale.setScalar(1 + Math.sin(seconds * 2.2 + index) * .18)
      const material = (child as THREE.Mesh).material
      if (!Array.isArray(material)) material.opacity = .48 + Math.sin(seconds * 2.2 + index) * .22
    })
  }
  renderer.render(scene, camera)
}

function resize() {
  if (!host.value || !renderer || !camera) return
  const width = host.value.clientWidth
  const height = host.value.clientHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / Math.max(height, 1)
  camera.updateProjectionMatrix()
}

function onPointerDown(event: PointerEvent) {
  if (!host.value || !camera || !scene) return
  const rect = host.value.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects([...roadMeshes.keys()], false)[0]
  if (!hit) return
  const segment = roadMeshes.get(hit.object)
  if (!segment) return
  selected.value = segment.id
  emit('select', segment)
  rebuildRoads()
}

onMounted(async () => {
  await nextTick()
  if (!host.value) return
  scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x090d16, 14, 28)
  camera = new THREE.PerspectiveCamera(42, host.value.clientWidth / Math.max(host.value.clientHeight, 1), .1, 100)
  camera.position.set(8, 9, 11)
  camera.lookAt(0, 0, 0)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  host.value.appendChild(renderer.domElement)
  scene.add(new THREE.AmbientLight(0x7dd3fc, .45))
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(5, 10, 6)
  scene.add(key)
  const cyan = new THREE.PointLight(0x00d5ff, 22, 22)
  cyan.position.set(-4, 4, 3)
  scene.add(cyan)
  buildCity()
  resize()
  host.value.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('resize', resize)
  sceneObserver = new IntersectionObserver(entries => { sceneVisible = entries[0]?.isIntersecting ?? true }, { threshold: .05 })
  sceneObserver.observe(host.value)
  animate()
})

watch(() => [props.segments, props.events, props.selectedId], () => {
  selected.value = props.selectedId
  rebuildRoads()
}, { deep: true })

onUnmounted(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', resize)
  sceneObserver?.disconnect()
  host.value?.removeEventListener('pointerdown', onPointerDown)
  renderer?.dispose()
  host.value?.querySelector('canvas')?.remove()
})
</script>

<template>
  <div class="digital-twin">
    <div ref="host" class="twin-canvas" role="img" :aria-label="`${cityName || '城市'}交通数字孪生视图`"></div>
    <div class="twin-overlay">
      <span>3D 数字孪生视图</span>
      <strong>{{ activeName }}</strong>
    </div>
  </div>
</template>

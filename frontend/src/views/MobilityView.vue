<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Activity, CarFront, CircleParking, CloudRain, Copy, Download, Hospital, Hotel, Layers3, LocateFixed, LogIn, MapPin, Mic, Minus, Navigation, Play, Plus, ScanLine, Search, Share2, Square, Star, TrafficCone, TrainFront, UserRound, Users, Utensils, WifiOff, X, Zap } from '@lucide/vue'
import { api } from '../api'
import TrafficMap from '../components/TrafficMap.vue'
import StateView from '../components/StateView.vue'
import { useCityStore } from '../stores/cityStore'
import { getOfflinePack, hasOfflineVectorPack, installedOfflineCities, offlineVectorUrl, removeOfflinePack, saveOfflinePack, saveOfflineVectorPack } from '../services/offlineMapStorage'
import type { Coordinate, Event as TrafficEvent, MobilityPoi, MobilityUser, MobilityWeather, OfflinePack, OfflinePackManifest, Segment, TaxiEstimate } from '../types'

type ToolPanel = 'nearby' | 'weather' | 'team' | 'sport' | 'offline' | 'account' | 'scan' | null
type SportRecord = { id: string; city: string; duration_seconds: number; distance_km: number; created_at: string }

const router = useRouter()
const cityStore = useCityStore()
const loading = ref(true)
const error = ref('')
const segments = ref<Segment[]>([])
const events = ref<TrafficEvent[]>([])
const query = ref('')
const searchLoading = ref(false)
const searchResults = ref<MobilityPoi[]>([])
const nearbyResults = ref<MobilityPoi[]>([])
const selectedPoi = ref<MobilityPoi>()
const activePanel = ref<ToolPanel>(null)
const nearbyCategory = ref('all')
const weather = ref<MobilityWeather>()
const taxi = ref<TaxiEstimate>()
const taxiLoading = ref(false)
const trafficVisible = ref(true)
const viewMode = ref<'2D' | '3D'>('3D')
const zoom = ref(cityStore.currentCity.zoom + .5)
const currentLocation = ref<Coordinate>({ ...cityStore.currentCity.center })
const locationStatus = ref('城市中心定位')
const actionMessage = ref('')
const scanText = ref('')
const scanError = ref('')
const teamCode = ref('')
const teamJoined = ref(false)
const sportRunning = ref(false)
const sportSeconds = ref(0)
const favorites = ref<string[]>([])
const offlineCities = ref<string[]>([])
const sportRecords = ref<SportRecord[]>([])
const offlinePacks = ref<OfflinePackManifest[]>([])
const offlineDownloading = ref<string>()
const offlineError = ref('')
const offlineMode = ref(false)
const activeOfflinePack = ref<OfflinePack>()
const hasOfflineVector = ref(false)
const offlineVectorPreview = ref('')
const phone = ref('13800138000')
const smsCode = ref('')
const demoCode = ref('')
const authLoading = ref(false)
const authError = ref('')
const user = ref<MobilityUser>()
let searchTimer = 0
let sportTimer = 0

const categoryOptions = [
  { key: 'all', label: '全部', icon: MapPin },
  { key: 'transit', label: '公交地铁', icon: TrainFront },
  { key: 'parking', label: '停车', icon: CircleParking },
  { key: 'food', label: '餐饮', icon: Utensils },
  { key: 'hotel', label: '住宿', icon: Hotel },
  { key: 'hospital', label: '医疗', icon: Hospital },
  { key: 'charging', label: '充电', icon: Zap },
]
const focus = computed(() => ({ ...(selectedPoi.value || currentLocation.value), zoom: zoom.value }))
const mapPois = computed(() => {
  const items = [...cityStore.currentCity.pois.map(item => ({ ...item, category: 'landmark', address: `${cityStore.currentCity.name}重点区域` })), ...nearbyResults.value, ...searchResults.value]
  return [...new Map(items.map(item => [item.id, item])).values()]
})
const favoritePois = computed(() => mapPois.value.filter(item => favorites.value.includes(item.id)))
const isFavorite = computed(() => !!selectedPoi.value && favorites.value.includes(selectedPoi.value.id))
const sportDistance = computed(() => Number((sportSeconds.value / 3600 * 5.2).toFixed(2)))
const activeSegments = computed(() => offlineMode.value && activeOfflinePack.value ? activeOfflinePack.value.segments : segments.value)
const activeEvents = computed(() => offlineMode.value && activeOfflinePack.value ? activeOfflinePack.value.events : events.value)
const currentOfflineInstalled = computed(() => offlineCities.value.includes(cityStore.currentCityCode))
const offlineVectorSource = computed(() => offlineVectorPreview.value || (hasOfflineVector.value ? offlineVectorUrl(cityStore.currentCityCode) : ''))
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

function readStorage<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback }
}
function persist() {
  localStorage.setItem('mobility-favorites', JSON.stringify(favorites.value))
  localStorage.setItem('mobility-offline-cities', JSON.stringify(offlineCities.value))
  localStorage.setItem('mobility-sport-records', JSON.stringify(sportRecords.value))
  if (user.value) localStorage.setItem('mobility-user', JSON.stringify(user.value))
}
function message(text: string) {
  actionMessage.value = text
  window.setTimeout(() => { if (actionMessage.value === text) actionMessage.value = '' }, 2600)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    ;[segments.value, events.value, weather.value] = await Promise.all([
      api.segments(cityStore.currentCityCode), api.events(cityStore.currentCityCode), api.mobilityWeather(cityStore.currentCityCode),
    ])
    currentLocation.value = { ...cityStore.currentCity.center }
    zoom.value = cityStore.currentCity.zoom + .5
    selectedPoi.value = mapPois.value[0]
    await loadNearby()
  } catch {
    error.value = '出行服务加载失败，请检查前后端连接。'
  } finally {
    loading.value = false
  }
}

async function runSearch() {
  const keyword = query.value.trim()
  if (!keyword) { searchResults.value = []; return }
  searchLoading.value = true
  try { searchResults.value = await api.mobilitySearch(cityStore.currentCityCode, keyword) }
  catch { message('搜索服务暂时不可用') }
  finally { searchLoading.value = false }
}
function choosePoi(poi: MobilityPoi) {
  selectedPoi.value = poi
  query.value = poi.name
  searchResults.value = []
  taxi.value = undefined
}

async function loadNearby() {
  nearbyResults.value = await api.mobilityNearby(cityStore.currentCityCode, currentLocation.value.lng, currentLocation.value.lat, nearbyCategory.value)
}
async function openNearby() {
  activePanel.value = 'nearby'
  try { await loadNearby() } catch { message('附近地点加载失败') }
}
async function locate() {
  if (!navigator.geolocation) { locationStatus.value = '浏览器不支持定位，已使用城市中心'; return }
  locationStatus.value = '正在定位...'
  navigator.geolocation.getCurrentPosition(async position => {
    currentLocation.value = { lng: position.coords.longitude, lat: position.coords.latitude }
    zoom.value = 15
    locationStatus.value = `定位精度约 ${Math.round(position.coords.accuracy)} 米`
    await loadNearby()
  }, () => { locationStatus.value = '定位权限不可用，已使用城市中心' }, { enableHighAccuracy: true, timeout: 8000 })
}
function changeZoom(step: number) { zoom.value = Math.min(18, Math.max(9, zoom.value + step)) }

function startVoice() {
  const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!Recognition) { message('当前浏览器不支持语音识别，请使用 Chrome 或 Edge'); return }
  const recognition = new Recognition()
  recognition.lang = 'zh-CN'
  recognition.interimResults = false
  recognition.onresult = (event: any) => { query.value = event.results[0][0].transcript; runSearch() }
  recognition.onerror = () => message('未识别到语音，请重试')
  recognition.start()
  message('正在聆听...')
}
async function decodeQrFile(event: Event) {
  scanError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const Detector = (window as any).BarcodeDetector
  if (!Detector) { scanError.value = '当前浏览器不支持图片扫码，可在下方手动输入地点名称。'; return }
  try {
    const bitmap = await createImageBitmap(file)
    const codes = await new Detector({ formats: ['qr_code'] }).detect(bitmap)
    if (!codes.length) throw new Error('empty')
    scanText.value = codes[0].rawValue
  } catch { scanError.value = '未识别到二维码，请换一张清晰图片。' }
}
function useScanText() {
  if (!scanText.value.trim()) { scanError.value = '请输入地点名称或二维码内容。'; return }
  query.value = scanText.value.trim()
  activePanel.value = null
  runSearch()
}

function toggleFavorite() {
  if (!selectedPoi.value) return
  favorites.value = isFavorite.value ? favorites.value.filter(id => id !== selectedPoi.value!.id) : [...favorites.value, selectedPoi.value.id]
  persist()
  message(isFavorite.value ? '已加入收藏' : '已取消收藏')
}
async function sharePoi() {
  if (!selectedPoi.value) return
  const text = `${selectedPoi.value.name} ${selectedPoi.value.address} https://uri.amap.com/marker?position=${selectedPoi.value.lng},${selectedPoi.value.lat}`
  try { await navigator.clipboard.writeText(text); message('地点信息已复制') }
  catch { message(text) }
}
function planRoute() {
  if (!selectedPoi.value) return
  const nearest = [...cityStore.currentCity.pois].sort((a, b) => {
    const aDistance = Math.hypot(a.lng - selectedPoi.value!.lng, a.lat - selectedPoi.value!.lat)
    const bDistance = Math.hypot(b.lng - selectedPoi.value!.lng, b.lat - selectedPoi.value!.lat)
    return aDistance - bDistance
  })[0]
  router.push({ path: '/route', query: { destination: nearest.id, poi: selectedPoi.value.name } })
}
async function estimateTaxi() {
  if (!selectedPoi.value) return
  taxiLoading.value = true
  try { taxi.value = await api.mobilityTaxi(cityStore.currentCityCode, currentLocation.value, selectedPoi.value) }
  catch { message('打车估价暂时不可用') }
  finally { taxiLoading.value = false }
}

function openTeam() {
  activePanel.value = 'team'
  if (!teamCode.value) teamCode.value = `${cityStore.currentCityCode.slice(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
}
async function copyTeam() {
  await navigator.clipboard?.writeText(teamCode.value)
  message('组队口令已复制')
}
function toggleSport() {
  if (sportRunning.value) {
    sportRunning.value = false
    window.clearInterval(sportTimer)
    if (sportSeconds.value > 0) {
      sportRecords.value = [{ id: `sport-${Date.now()}`, city: cityStore.currentCityCode, duration_seconds: sportSeconds.value, distance_km: sportDistance.value, created_at: new Date().toISOString() }, ...sportRecords.value].slice(0, 10)
      persist()
      message('运动记录已保存')
    }
  } else {
    sportSeconds.value = 0
    sportRunning.value = true
    sportTimer = window.setInterval(() => { sportSeconds.value += 1 }, 1000)
  }
}
async function loadOfflinePacks() {
  try { offlinePacks.value = await api.offlinePacks() }
  catch { offlineError.value = '离线包清单暂时不可用，请确认后端服务已启动。' }
}
async function toggleOffline(city: string) {
  offlineError.value = ''
  if (offlineCities.value.includes(city)) {
    await removeOfflinePack(city)
    offlineCities.value = offlineCities.value.filter(item => item !== city)
    if (city === cityStore.currentCityCode) { offlineMode.value = false; activeOfflinePack.value = undefined }
    persist()
    message('离线地图包已删除')
    return
  }
  offlineDownloading.value = city
  try {
    const pack = await api.downloadOfflinePack(city)
    await saveOfflinePack(pack)
    offlineCities.value = [...new Set([...offlineCities.value, city])]
    if (city === cityStore.currentCityCode) { activeOfflinePack.value = pack; offlineMode.value = true }
    persist()
    message(`${pack.city_info.name} 离线地图包已保存`)
  } catch {
    offlineError.value = '下载失败，请检查网络或后端服务。'
  } finally { offlineDownloading.value = undefined }
}
async function toggleOfflineMode() {
  if (offlineMode.value) { offlineMode.value = false; return }
  const pack = await getOfflinePack(cityStore.currentCityCode)
  if (!pack) { message('请先下载当前城市的离线地图包'); return }
  activeOfflinePack.value = pack
  offlineMode.value = true
}
async function importOfflineVector(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.pmtiles')) { offlineError.value = '请选择 .pmtiles 格式的合法离线矢量地图包。'; return }
  offlineError.value = ''
  offlineDownloading.value = cityStore.currentCityCode
  try {
    await saveOfflineVectorPack(cityStore.currentCityCode, file)
    if (offlineVectorPreview.value) URL.revokeObjectURL(offlineVectorPreview.value)
    offlineVectorPreview.value = URL.createObjectURL(file)
    hasOfflineVector.value = true
    message('矢量底图已导入，当前会话可直接使用；刷新后由离线服务接管。')
  } catch { offlineError.value = '矢量包保存失败，可能是浏览器存储空间不足。' }
  finally { offlineDownloading.value = undefined; input.value = '' }
}
async function requestCode() {
  authError.value = ''
  if (!/^1\d{10}$/.test(phone.value)) { authError.value = '请输入 11 位中国大陆手机号。'; return }
  authLoading.value = true
  try { const result = await api.requestSmsCode(phone.value); demoCode.value = result.demo_code; message('演示验证码已生成') }
  catch { authError.value = '验证码服务暂时不可用。' }
  finally { authLoading.value = false }
}
async function login() {
  authError.value = ''
  authLoading.value = true
  try { user.value = await api.verifySmsCode(phone.value, smsCode.value); persist(); message('登录成功') }
  catch (err) { authError.value = err instanceof Error ? err.message : '登录失败，请检查验证码。' }
  finally { authLoading.value = false }
}
function logout() { user.value = undefined; localStorage.removeItem('mobility-user'); message('已退出登录') }

watch(query, () => { window.clearTimeout(searchTimer); searchTimer = window.setTimeout(runSearch, 280) })
watch(nearbyCategory, loadNearby)
watch(() => cityStore.currentCityCode, async () => { query.value = ''; searchResults.value = []; nearbyResults.value = []; selectedPoi.value = undefined; offlineMode.value = false; activeOfflinePack.value = undefined; if (offlineVectorPreview.value) URL.revokeObjectURL(offlineVectorPreview.value); offlineVectorPreview.value = ''; hasOfflineVector.value = await hasOfflineVectorPack(cityStore.currentCityCode); load() })
onMounted(async () => {
  favorites.value = readStorage('mobility-favorites', [])
  offlineCities.value = await installedOfflineCities()
  hasOfflineVector.value = await hasOfflineVectorPack(cityStore.currentCityCode)
  sportRecords.value = readStorage('mobility-sport-records', [])
  user.value = readStorage<MobilityUser | undefined>('mobility-user', undefined)
  load()
  loadOfflinePacks()
})
onBeforeUnmount(() => { window.clearTimeout(searchTimer); window.clearInterval(sportTimer); if (offlineVectorPreview.value) URL.revokeObjectURL(offlineVectorPreview.value) })
</script>

<template>
  <div class="page full mobility-page">
    <div class="page-title mobility-title">
      <div><h2>{{ cityStore.currentCity.name }}出行服务</h2><p>地图搜索、周边服务与个人出行工具</p></div>
      <span class="mobility-location"><LocateFixed :size="15" />{{ locationStatus }}</span>
    </div>
    <StateView :loading="loading" :error="error" @retry="load">
      <section class="mobility-workbench">
        <div class="mobility-map-shell panel">
          <div class="mobility-search" role="search">
            <Search :size="18" />
            <input v-model="query" aria-label="搜索地点" placeholder="搜索地点、公交站、停车场" @keydown.enter="runSearch">
            <span v-if="searchLoading" class="mini-spinner" aria-label="搜索中"></span>
            <button title="语音搜索" @click="startVoice"><Mic :size="18" /></button>
            <button title="扫描地点二维码" @click="activePanel = 'scan'"><ScanLine :size="18" /></button>
            <button title="账户与收藏" @click="activePanel = 'account'"><UserRound :size="18" /></button>
            <div v-if="searchResults.length" class="search-results" role="listbox">
              <button v-for="poi in searchResults" :key="poi.id" @click="choosePoi(poi)"><MapPin :size="16" /><span><b>{{ poi.name }}</b><small>{{ poi.address }}</small></span><Navigation :size="15" /></button>
            </div>
          </div>

          <TrafficMap :key="offlineMode ? (offlineVectorSource ? 'offline-vector' : 'offline-snapshot') : 'online'" :segments="activeSegments" :events="activeEvents" :pois="mapPois" :selected-poi-id="selectedPoi?.id" :focus="focus" :city-name="cityStore.currentCity.name" :traffic-visible="trafficVisible" :view-mode="viewMode" :offline-mode="offlineMode" :offline-vector-source="offlineVectorSource" @select-poi="choosePoi" />

          <div class="mobility-map-tools" aria-label="地图工具">
            <button :aria-pressed="trafficVisible" title="实时路况" @click="trafficVisible = !trafficVisible"><TrafficCone :size="18" /><span>路况</span></button>
            <button title="附近服务" @click="openNearby"><Search :size="18" /><span>附近</span></button>
            <button title="定位" @click="locate"><LocateFixed :size="18" /><span>定位</span></button>
            <button :aria-pressed="viewMode === '3D'" title="切换 2D/3D" @click="viewMode = viewMode === '3D' ? '2D' : '3D'"><Layers3 :size="18" /><span>{{ viewMode }}</span></button>
          </div>
          <div class="mobility-zoom" aria-label="缩放">
            <button title="放大" @click="changeZoom(1)"><Plus :size="18" /></button>
            <button title="缩小" @click="changeZoom(-1)"><Minus :size="18" /></button>
          </div>
          <div class="mobility-quick-tools">
            <button @click="activePanel = 'weather'"><CloudRain :size="17" />天气</button>
            <button @click="openTeam"><Users :size="17" />组队</button>
            <button @click="activePanel = 'sport'"><Activity :size="17" />运动</button>
            <button @click="activePanel = 'offline'"><WifiOff :size="17" />离线</button>
          </div>
        </div>

        <aside class="mobility-detail panel">
          <template v-if="selectedPoi">
            <div class="panel-head"><h3>地点详情</h3><button class="icon-button compact" :title="isFavorite ? '取消收藏' : '收藏地点'" @click="toggleFavorite"><Star :size="17" :fill="isFavorite ? 'currentColor' : 'none'" /></button></div>
            <span class="status-tag">{{ selectedPoi.category === 'landmark' ? '城市地点' : '附近服务' }}</span>
            <h2>{{ selectedPoi.name }}</h2><p>{{ selectedPoi.address }}</p>
            <dl>
              <div><dt>经度</dt><dd>{{ selectedPoi.lng.toFixed(5) }}</dd></div>
              <div><dt>纬度</dt><dd>{{ selectedPoi.lat.toFixed(5) }}</dd></div>
              <div v-if="selectedPoi.distance_km !== undefined"><dt>距离</dt><dd>{{ selectedPoi.distance_km }} km</dd></div>
              <div v-if="selectedPoi.walking_minutes"><dt>步行</dt><dd>约 {{ selectedPoi.walking_minutes }} 分钟</dd></div>
            </dl>
            <div class="poi-actions">
              <button @click="sharePoi"><Share2 :size="17" />分享</button>
              <button @click="planRoute"><Navigation :size="17" />路线</button>
              <button :class="{ loading: taxiLoading }" :disabled="taxiLoading" @click="estimateTaxi"><CarFront :size="17" />{{ taxiLoading ? '估价中' : '打车' }}</button>
            </div>
            <section v-if="taxi" class="taxi-result"><span>预计 {{ taxi.estimated_minutes }} 分钟</span><strong>约 ¥{{ taxi.estimated_fare_yuan }}</strong><small>{{ taxi.distance_km }} km · 平峰估价</small></section>
          </template>
          <div v-else class="mobility-empty"><MapPin :size="28" /><p>在地图或搜索结果中选择一个地点</p></div>
        </aside>
      </section>
    </StateView>

    <div v-if="activePanel" class="drawer-mask mobility-drawer-mask" @click.self="activePanel = null">
      <aside class="drawer mobility-drawer" role="dialog" :aria-label="activePanel">
        <button class="close" title="关闭" @click="activePanel = null"><X :size="18" /></button>

        <template v-if="activePanel === 'nearby'">
          <h2>附近服务</h2><p>按当前位置计算距离与步行时间。</p>
          <div class="nearby-categories"><button v-for="item in categoryOptions" :key="item.key" :class="{ active: nearbyCategory === item.key }" @click="nearbyCategory = item.key"><component :is="item.icon" :size="16" />{{ item.label }}</button></div>
          <div v-if="nearbyResults.length" class="nearby-list"><button v-for="poi in nearbyResults" :key="poi.id" @click="choosePoi(poi); activePanel = null"><span><b>{{ poi.name }}</b><small>{{ poi.address }}</small></span><em>{{ poi.distance_km }} km</em></button></div>
          <div v-else class="mobility-empty"><Search :size="24" /><p>该分类附近暂无结果，请切换分类。</p></div>
        </template>

        <template v-else-if="activePanel === 'weather' && weather">
          <h2>{{ cityStore.currentCity.name }}天气</h2><p>{{ weather.updated_at.slice(11, 16) }} 更新 · 仿真天气数据</p>
          <div class="weather-reading"><CloudRain :size="34" /><strong>{{ weather.temperature_c }}°</strong><span>{{ weather.condition }}</span></div>
          <dl class="tool-stats"><div><dt>体感</dt><dd>{{ weather.feels_like_c }}°C</dd></div><div><dt>湿度</dt><dd>{{ weather.humidity }}%</dd></div><div><dt>风力</dt><dd>{{ weather.wind }}</dd></div><div><dt>能见度</dt><dd>{{ weather.visibility_km }} km</dd></div></dl>
          <div class="decision"><b>出行建议</b><p>{{ weather.advice }}</p></div>
        </template>

        <template v-else-if="activePanel === 'team'">
          <h2>组队出行</h2><p>共享组队口令，队员可同步目的地与集合状态。</p>
          <div class="team-code"><span>组队口令</span><strong>{{ teamCode }}</strong><button title="复制口令" @click="copyTeam"><Copy :size="17" />复制</button></div>
          <label class="tool-toggle"><input v-model="teamJoined" type="checkbox"><span>我已加入本次行程</span></label>
          <div class="team-members"><span><UserRound :size="17" />发起人</span><span v-if="teamJoined"><UserRound :size="17" />我</span></div>
        </template>

        <template v-else-if="activePanel === 'sport'">
          <h2>运动记录</h2><p>记录当前步行或骑行时长，结束后保存在本机。</p>
          <div class="sport-meter"><Activity :size="30" /><strong>{{ String(Math.floor(sportSeconds / 60)).padStart(2, '0') }}:{{ String(sportSeconds % 60).padStart(2, '0') }}</strong><span>{{ sportDistance }} km</span></div>
          <button class="primary tool-primary" @click="toggleSport"><Square v-if="sportRunning" :size="17" /><Play v-else :size="17" />{{ sportRunning ? '结束并保存' : '开始记录' }}</button>
          <div class="record-list"><article v-for="record in sportRecords.slice(0, 3)" :key="record.id"><span>{{ new Date(record.created_at).toLocaleDateString('zh-CN') }}</span><b>{{ Math.floor(record.duration_seconds / 60) }} 分钟</b><em>{{ record.distance_km }} km</em></article></div>
        </template>

        <template v-else-if="activePanel === 'offline'">
          <h2>离线地图</h2><p>保存本项目的路网、事件和 POI 快照。离线时使用本地路网底图，不使用高德瓦片。</p>
          <button class="secondary tool-primary" :disabled="!currentOfflineInstalled" @click="toggleOfflineMode"><Layers3 :size="17" />{{ offlineMode ? '切换在线地图' : '使用当前城市离线地图' }}</button>
          <label class="scan-upload offline-import"><Layers3 :size="20" /><span>{{ hasOfflineVector ? '已导入完整矢量底图，重新导入' : '导入当前城市 PMTiles 矢量底图' }}</span><small>仅支持有授权、OpenMapTiles 图层规范的数据包</small><input type="file" accept=".pmtiles,application/octet-stream" @change="importOfflineVector"></label>
          <p v-if="offlineError" class="form-error">{{ offlineError }}</p>
          <div class="offline-list"><article v-for="city in cityStore.cities" :key="city.code"><div><b>{{ city.name }}</b><small>路网 · 事件 · POI · {{ formatBytes(offlinePacks.find(item => item.city === city.code)?.size_bytes || 0) }}</small></div><button :class="{ installed: offlineCities.includes(city.code) }" :disabled="offlineDownloading === city.code" @click="toggleOffline(city.code)"><Download :size="16" />{{ offlineDownloading === city.code ? '下载中...' : offlineCities.includes(city.code) ? '删除' : '下载' }}</button></article></div>
        </template>

        <template v-else-if="activePanel === 'account'">
          <template v-if="user"><h2>{{ user.display_name }}</h2><p>{{ user.masked_phone }} · 演示账户</p><div class="account-summary"><span><Star :size="18" />{{ favorites.length }} 个收藏</span><span><Activity :size="18" />{{ sportRecords.length }} 条运动</span><span><WifiOff :size="18" />{{ offlineCities.length }} 个离线包</span></div><button class="secondary tool-primary" @click="logout">退出登录</button></template>
          <template v-else><h2>短信登录</h2><p>演示环境不会发送真实短信，验证码由接口返回。</p><div class="auth-form"><label>手机号<input v-model="phone" inputmode="tel" maxlength="11"></label><button class="secondary" :disabled="authLoading" @click="requestCode">获取验证码</button><label>验证码<input v-model="smsCode" inputmode="numeric" maxlength="6"></label><small v-if="demoCode">本次演示验证码：<b>{{ demoCode }}</b></small><p v-if="authError" class="form-error">{{ authError }}</p><button class="primary" :disabled="authLoading || smsCode.length !== 6" @click="login"><LogIn :size="17" />登录</button></div></template>
          <hr><h4>我的收藏</h4><div v-if="favoritePois.length" class="favorite-list"><button v-for="poi in favoritePois" :key="poi.id" @click="choosePoi(poi); activePanel = null"><MapPin :size="15" />{{ poi.name }}</button></div><div v-else class="compact-empty">暂未收藏地点</div>
        </template>

        <template v-else-if="activePanel === 'scan'">
          <h2>扫描地点</h2><p>上传二维码图片；不支持图片识别时可手动输入地点。</p>
          <label class="scan-upload"><ScanLine :size="22" /><span>选择二维码图片</span><input type="file" accept="image/*" @change="decodeQrFile"></label>
          <label class="scan-manual">识别内容<input v-model="scanText" placeholder="例如：北京站"></label>
          <p v-if="scanError" class="form-error">{{ scanError }}</p>
          <button class="primary tool-primary" @click="useScanText"><Search :size="17" />搜索地点</button>
        </template>
      </aside>
    </div>
    <div v-if="actionMessage" class="mobility-toast" role="status">{{ actionMessage }}</div>
  </div>
</template>

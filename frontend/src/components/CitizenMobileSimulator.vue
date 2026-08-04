<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Activity, AlertTriangle, ArrowRight, BusFront, CheckCircle2, Clock3, CloudRain, LocateFixed, MapPin, Navigation, RefreshCw, Route as RouteIcon, ShieldCheck, Smartphone, Ticket, X } from '@lucide/vue'
import { api } from '../api'
import type { CitizenBusBooking, CitizenCommuteLine, CitizenHomeSummary, CitizenPreference, CitizenSmartPlan, CitizenTripMonitor } from '../types'
import { useCityStore } from '../stores/cityStore'

const emit = defineEmits<{ close: [] }>()
const cityStore = useCityStore()
const activeTab = ref<'home' | 'route' | 'radar' | 'commute'>('home')
const home = ref<CitizenHomeSummary>()
const lines = ref<CitizenCommuteLine[]>([])
const homeLoading = ref(true)
const homeError = ref('')
const origin = ref('')
const destination = ref('')
const preference = ref<CitizenPreference>('safe_first')
const routePlan = ref<CitizenSmartPlan>()
const monitor = ref<CitizenTripMonitor>()
const routeLoading = ref(false)
const routeError = ref('')
const monitorLoading = ref(false)
const userId = ref('user_demo_01')
const selectedLineId = ref('')
const shiftTime = ref('')
const booking = ref<CitizenBusBooking>()
const bookingLoading = ref(false)
const bookingError = ref('')

const places = computed(() => cityStore.currentCity.pois)
const selectedLine = computed(() => lines.value.find(line => line.line_id === selectedLineId.value))
const transportLabel = (value: string) => ({ subway: '地铁', bus: '公交', shared_bike: '共享单车' }[value] || value)
const preferenceLabel = (value: CitizenPreference) => ({ fastest: '最快', congestion_avoid: '避堵', safe_first: '安全优先' }[value])
const riskLabel = (value: CitizenTripMonitor['risk_type']) => value ? ({ waterlog: '积水风险', accident: '事件风险', congestion: '拥堵风险' }[value]) : '路线风险'

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function resetCityState() {
  origin.value = places.value[0]?.id || ''
  destination.value = places.value[1]?.id || ''
  selectedLineId.value = lines.value[0]?.line_id || ''
  shiftTime.value = lines.value[0]?.departure_times[0] || ''
  routePlan.value = undefined
  monitor.value = undefined
  routeError.value = ''
  booking.value = undefined
  bookingError.value = ''
}

async function loadCityData() {
  homeLoading.value = true
  homeError.value = ''
  try {
    [home.value, lines.value] = await Promise.all([
      api.citizenHomeSummary(cityStore.currentCityCode),
      api.citizenCommuteLines(cityStore.currentCityCode),
    ])
    resetCityState()
  } catch (error) {
    homeError.value = messageFrom(error, '市民端数据加载失败')
  } finally {
    homeLoading.value = false
  }
}

function onLineChange() {
  shiftTime.value = selectedLine.value?.departure_times[0] || ''
}

async function runPlan() {
  if (!origin.value || !destination.value || origin.value === destination.value) {
    routeError.value = '请选择不同的起点和终点'
    return
  }
  routeLoading.value = true
  routeError.value = ''
  try {
    routePlan.value = await api.citizenSmartPlan({ city: cityStore.currentCityCode, origin: origin.value, destination: destination.value, preference: preference.value })
    monitor.value = undefined
    activeTab.value = 'route'
  } catch (error) {
    routeError.value = messageFrom(error, '路线规划暂时不可用')
  } finally {
    routeLoading.value = false
  }
}

async function refreshMonitor() {
  if (!routePlan.value) return
  monitorLoading.value = true
  try {
    monitor.value = await api.citizenTripMonitor(routePlan.value.route_id)
  } catch (error) {
    routeError.value = messageFrom(error, '行程风险暂时不可用')
  } finally {
    monitorLoading.value = false
  }
}

async function rerouteSafe() {
  preference.value = 'safe_first'
  await runPlan()
  await refreshMonitor()
  activeTab.value = 'radar'
}

async function submitBooking() {
  bookingLoading.value = true
  bookingError.value = ''
  booking.value = undefined
  try {
    booking.value = await api.citizenBusBooking({ city: cityStore.currentCityCode, user_id: userId.value, shift_time: shiftTime.value, line_id: selectedLineId.value })
    const current = lines.value.find(line => line.line_id === selectedLineId.value)
    if (current && booking.value) current.remaining_seats = booking.value.remaining_seats
  } catch (error) {
    bookingError.value = messageFrom(error, '预约暂时不可用')
  } finally {
    bookingLoading.value = false
  }
}

watch(() => cityStore.currentCityCode, loadCityData)
onMounted(loadCityData)
</script>

<template>
  <div class="citizen-mask" @click.self="emit('close')">
    <aside class="citizen-drawer" role="dialog" aria-label="市民端出行助手">
      <div class="citizen-drawer-head">
        <div>
          <small>TO-C MOBILE SIMULATOR</small>
          <strong>市民出行助手</strong>
        </div>
        <button class="citizen-close" title="关闭市民端模拟器" @click="emit('close')"><X :size="19" /></button>
      </div>

      <div class="citizen-phone">
        <header class="citizen-app-head">
          <div><MapPin :size="15" /><strong>{{ cityStore.currentCity.name }}</strong></div>
          <span><span class="citizen-live-dot"></span>仿真在线</span>
        </header>

        <main class="citizen-content">
          <div v-if="homeLoading" class="citizen-loading"><Smartphone :size="26" /><span>正在加载市民出行数据...</span></div>
          <div v-else-if="homeError" class="citizen-error"><AlertTriangle :size="24" /><p>{{ homeError }}</p><button class="citizen-secondary" @click="loadCityData">重新加载</button></div>

          <template v-else-if="activeTab === 'home' && home">
            <section class="citizen-welcome"><span>今天出行，先看一眼路况</span><strong>{{ cityStore.currentCity.description }}</strong></section>
            <section class="citizen-safety-panel">
              <div class="citizen-panel-label"><span>出行安全指数</span><ShieldCheck :size="17" /></div>
              <div class="citizen-safety-value"><strong>{{ home.travel_safety_index }}</strong><span>/ 100</span></div>
              <div class="citizen-meter"><i :style="{ width: `${home.travel_safety_index}%` }"></i></div>
              <small>结合当前拥堵、天气和事件风险生成</small>
            </section>
            <section class="citizen-notice-list">
              <article><CloudRain :size="17" /><div><span>天气提醒</span><p>{{ home.weather_notice }}</p></div></article>
              <article><Clock3 :size="17" /><div><span>高峰提醒</span><p>{{ home.peak_notice }}</p></div></article>
            </section>
            <section class="citizen-section-block"><div class="citizen-section-title"><h3>推荐出行方式</h3><small>当前城市</small></div><div class="citizen-transport-list"><span v-for="transport in home.recommended_transport" :key="transport"><BusFront :size="15" />{{ transportLabel(transport) }}</span></div></section>
            <button class="citizen-primary citizen-wide-button" @click="activeTab = 'route'"><Navigation :size="17" />规划一条更稳妥的路线<ArrowRight :size="16" /></button>
          </template>

          <template v-else-if="activeTab === 'route'">
            <div class="citizen-page-title"><div><small>SMART ROUTE</small><h2>智能避险导航</h2></div><RouteIcon :size="22" /></div>
            <section class="citizen-form-block">
              <label>起点<select v-model="origin"><option v-for="place in places" :key="place.id" :value="place.id">{{ place.name }}</option></select></label>
              <label>终点<select v-model="destination"><option v-for="place in places" :key="place.id" :value="place.id">{{ place.name }}</option></select></label>
              <div class="citizen-segmented"><button v-for="item in (['fastest', 'congestion_avoid', 'safe_first'] as CitizenPreference[])" :key="item" :class="{ active: preference === item }" @click="preference = item">{{ preferenceLabel(item) }}</button></div>
              <button class="citizen-primary citizen-wide-button" :disabled="routeLoading" @click="runPlan"><Navigation :size="17" />{{ routeLoading ? '正在规划...' : '生成避险方案' }}</button>
              <p v-if="routeError" class="citizen-inline-error">{{ routeError }}</p>
            </section>
            <section v-if="routePlan" class="citizen-result-block">
              <div class="citizen-result-head"><div><span>{{ preferenceLabel(routePlan.strategy) }}路线</span><strong>{{ routePlan.estimated_minutes }}<small> 分钟</small></strong></div><div><span>距离</span><strong>{{ routePlan.total_distance_km }}<small> km</small></strong></div></div>
              <div class="citizen-route-track"><span v-for="(node, index) in routePlan.path_nodes" :key="`${node}-${index}`" :class="{ endpoint: index === 0 || index === routePlan.path_nodes.length - 1 }"><i></i>{{ node }}</span></div>
              <div class="citizen-risk-tags"><span v-for="risk in routePlan.avoided_risks" :key="risk"><ShieldCheck :size="14" />{{ risk }}</span><span v-if="!routePlan.avoided_risks.length" class="quiet">当前未发现需额外规避的风险</span></div>
              <button class="citizen-secondary citizen-wide-button" @click="activeTab = 'radar'; refreshMonitor()"><Activity :size="16" />查看行程风险雷达</button>
            </section>
          </template>

          <template v-else-if="activeTab === 'radar'">
            <div class="citizen-page-title"><div><small>TRIP MONITOR</small><h2>行程风险雷达</h2></div><Activity :size="22" /></div>
            <div v-if="!routePlan" class="citizen-empty"><LocateFixed :size="26" /><p>还没有登记中的路线</p><button class="citizen-primary" @click="activeTab = 'route'">先规划路线</button></div>
            <template v-else>
              <section class="citizen-route-id"><span>当前行程</span><strong>{{ routePlan.route_id }}</strong><small>{{ preferenceLabel(routePlan.strategy) }} · {{ routePlan.estimated_minutes }} 分钟</small></section>
              <section v-if="monitorLoading" class="citizen-loading citizen-small-loading"><RefreshCw :size="22" /><span>正在扫描前方路段...</span></section>
              <section v-else-if="monitor" :class="['citizen-monitor-card', { danger: monitor.has_risk_ahead, calm: !monitor.has_risk_ahead }]">
                <div class="citizen-monitor-icon"><AlertTriangle v-if="monitor.has_risk_ahead" :size="24" /><CheckCircle2 v-else :size="24" /></div>
                <span>{{ monitor.has_risk_ahead ? riskLabel(monitor.risk_type) : '路线运行平稳' }}</span>
                <strong>{{ monitor.has_risk_ahead ? monitor.next_risk_segment : '暂未发现显著风险' }}</strong>
                <p>{{ monitor.description }}</p>
                <small v-if="monitor.distance_to_risk_km">约 {{ monitor.distance_to_risk_km }} km 后进入风险关注区</small>
              </section>
              <div class="citizen-radar-actions"><button class="citizen-secondary" @click="refreshMonitor"><RefreshCw :size="15" />刷新风险</button><button v-if="monitor?.reroute_available" class="citizen-primary" @click="rerouteSafe"><ShieldCheck :size="15" />切换安全路线</button></div>
            </template>
          </template>

          <template v-else-if="activeTab === 'commute'">
            <div class="citizen-page-title"><div><small>COMMUTE BOOKING</small><h2>定制通勤预约</h2></div><Ticket :size="22" /></div>
            <section class="citizen-form-block">
              <label>用户编号<input v-model="userId" placeholder="例如 user_1001"></label>
              <label>通勤线路<select v-model="selectedLineId" @change="onLineChange"><option v-for="line in lines" :key="line.line_id" :value="line.line_id">{{ line.name }}</option></select></label>
              <label>出发班次<select v-model="shiftTime"><option v-for="time in selectedLine?.departure_times || []" :key="time" :value="time">{{ time }}</option></select></label>
              <div v-if="selectedLine" class="citizen-seat-note"><BusFront :size="15" />当前班次剩余 {{ selectedLine.remaining_seats }} 个座位</div>
              <button class="citizen-primary citizen-wide-button" :disabled="bookingLoading" @click="submitBooking"><Ticket :size="17" />{{ bookingLoading ? '正在提交...' : '确认预约' }}</button>
              <p v-if="bookingError" class="citizen-inline-error">{{ bookingError }}</p>
            </section>
            <section v-if="booking" class="citizen-booking-success"><CheckCircle2 :size="26" /><strong>预约成功</strong><span>{{ booking.message }}</span><small>预约编号 {{ booking.booking_id }} · 剩余 {{ booking.remaining_seats }} 座</small></section>
          </template>
        </main>

        <nav class="citizen-tabbar" aria-label="市民端功能导航">
          <button :class="{ active: activeTab === 'home' }" title="市民首页" @click="activeTab = 'home'"><Smartphone :size="17" /><span>首页</span></button>
          <button :class="{ active: activeTab === 'route' }" title="智能避险导航" @click="activeTab = 'route'"><RouteIcon :size="17" /><span>导航</span></button>
          <button :class="{ active: activeTab === 'radar' }" title="行程风险雷达" @click="activeTab = 'radar'"><Activity :size="17" /><span>雷达</span></button>
          <button :class="{ active: activeTab === 'commute' }" title="定制通勤预约" @click="activeTab = 'commute'"><Ticket :size="17" /><span>通勤</span></button>
        </nav>
      </div>
    </aside>
  </div>
</template>

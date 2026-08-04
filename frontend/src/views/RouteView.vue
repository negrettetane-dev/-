<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRightLeft, BatteryCharging, Bike, Clock, CloudRain, Footprints, Leaf, Route as RouteIcon, ShieldCheck, TrafficCone } from '@lucide/vue'
import { api } from '../api'
import type { RouteOption, RouteResult, Segment } from '../types'
import StateView from '../components/StateView.vue'
import TrafficMap from '../components/TrafficMap.vue'
import { useCityStore } from '../stores/cityStore'

const cityStore = useCityStore()
const currentRoute = useRoute()
const places = computed(() => cityStore.currentCity.pois)
const origin = ref('')
const destination = ref('')
const mode = ref('balanced')
const loading = ref(false)
const error = ref('')
const samePlace = computed(() => origin.value === destination.value)
const result = ref<RouteResult>()
const selected = ref<RouteOption>()
const segments = ref<Segment[]>([])
const itinerary = computed(() => [
  { time: '09:00', title: `${places.value[0]?.name || '起点'}出发`, meta: '公共交通接驳 · 模拟实时 ETA 4 分钟' },
  { time: '09:35', title: places.value[1]?.name || '重点目的地', meta: '重点区域到达 · 保留调度缓冲时间' },
  { time: '12:40', title: places.value[2]?.name || '中途节点', meta: `${cityStore.currentCity.scenarios[1] || '重点场景'} · 事件风险持续监测` },
  { time: '15:20', title: places.value[3]?.name || '终点区域', meta: '路线状态复核 · 建议准备备用方案' },
])
const modeTabs = [
  { key: 'balanced', label: '综合', icon: RouteIcon },
  { key: 'lowCarbon', label: '低碳', icon: Leaf },
  { key: 'accessible', label: '无障碍', icon: ShieldCheck },
  { key: 'ev', label: '新能源', icon: BatteryCharging },
  { key: 'blind', label: '视障', icon: Footprints },
  { key: 'cycling', label: '骑行', icon: Bike },
]

async function load() {
  if (samePlace.value) {
    error.value = ''
    result.value = undefined
    selected.value = undefined
    return
  }
  loading.value = true
  error.value = ''
  try {
    result.value = await api.route(cityStore.currentCityCode, origin.value, destination.value)
    selected.value = result.value.items[0]
    segments.value = await api.segments(cityStore.currentCityCode)
  } catch {
    error.value = '路径推荐服务暂时不可用'
  } finally {
    loading.value = false
  }
}

function swap() {
  ;[origin.value, destination.value] = [destination.value, origin.value]
  load()
}
function resetPlaces() {
  origin.value = places.value[0]?.id || ''
  const requested = typeof currentRoute.query.destination === 'string' ? currentRoute.query.destination : ''
  destination.value = places.value.some(item => item.id === requested) ? requested : places.value[1]?.id || ''
  if (origin.value === destination.value) origin.value = places.value.find(item => item.id !== destination.value)?.id || ''
}
onMounted(() => { resetPlaces(); load() })
watch(() => cityStore.currentCityCode, () => { resetPlaces(); load() })
</script>

<template>
  <div class="page">
    <div class="page-title">
      <div>
        <h2>{{ cityStore.currentCity.name }}智能路径推荐</h2>
        <p>多目的地时序规划、天气自适应、低碳对比和专属模式</p>
      </div>
    </div>
    <div class="route-form panel">
      <label>起点
        <select v-model="origin" @change="load">
          <option v-for="p in places" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <button class="icon-button" title="交换起终点" @click="swap"><ArrowRightLeft /></button>
      <label>终点
        <select v-model="destination" @change="load">
          <option v-for="p in places" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <button class="primary" :disabled="samePlace || loading" @click="load"><RouteIcon :size="17" />生成方案</button>
    </div>
    <div class="scenario-tabs route-modes" role="tablist" aria-label="出行偏好">
      <span><CloudRain :size="16" /> 天气策略已启用</span>
      <button v-for="item in modeTabs" :key="item.key" :class="{ active: mode === item.key }" @click="mode = item.key">
        <component :is="item.icon" :size="15" />
        {{ item.label }}
      </button>
    </div>
    <div v-if="samePlace" class="inline-notice">
      起点和终点相同，请选择不同地点后生成路径方案。
    </div>
    <StateView v-else :loading="loading" :error="error" :empty="!result" @retry="load">
      <div class="route-layout">
        <section class="panel map-large">
          <TrafficMap :segments="segments" :route="selected" :focus="{ ...cityStore.currentCity.center, zoom: cityStore.currentCity.zoom }" :city-name="cityStore.currentCity.name" />
        </section>
        <aside class="route-options">
          <section class="trip-timeline panel">
            <div class="panel-head"><h3>一日行程单</h3><span>4 地点</span></div>
            <ol>
              <li v-for="item in itinerary" :key="item.time">
                <time>{{ item.time }}</time>
                <div><strong>{{ item.title }}</strong><small>{{ item.meta }}</small></div>
              </li>
            </ol>
          </section>
          <button v-for="r in result?.items" :key="r.strategy" :class="['route-card', r.strategy, { active: selected?.strategy === r.strategy }]" @click="selected = r">
            <div class="route-card-head">
              <h3>{{ r.title }}</h3>
              <span>{{ r.strategy === 'fastest' ? '效率优先' : r.strategy === 'low_carbon' ? '低碳优先' : '无障碍优先' }}</span>
            </div>
            <p>{{ r.advice }}</p>
            <dl>
              <div><Clock :size="15" /><b>{{ r.estimated_minutes }}分钟</b></div>
              <div><RouteIcon :size="15" /><b>{{ r.distance_km }} km</b></div>
              <div><TrafficCone :size="15" /><b>拥堵 {{ r.congestion_score }}</b></div>
              <div><Leaf :size="15" /><b>{{ r.carbon_kg }} kg CO2</b></div>
            </dl>
          </button>
          <section class="mode-explain panel">
            <b>{{ modeTabs.find(x => x.key === mode)?.label }}模式依据</b>
            <p v-if="mode === 'lowCarbon'">当地铁/公交耗时差距可接受时，优先推荐低排放方案，并展示减排量。</p>
            <p v-else-if="mode === 'accessible'">避开模拟台阶和电梯停运点，保留数据覆盖范围提示。</p>
            <p v-else-if="mode === 'ev'">剩余续航不足时插入顺路充电点，显示等待与电价时段。</p>
            <p v-else-if="mode === 'blind'">按路段展示盲道完整性、复杂路口和非机动车密集风险。</p>
            <p v-else-if="mode === 'cycling'">雨天隐藏首推骑行；晴天展示坡度、路面和风景路线偏好。</p>
            <p v-else>综合时间、拥堵、天气、碳排放和个人偏好生成可解释推荐。</p>
          </section>
        </aside>
      </div>
    </StateView>
  </div>
</template>

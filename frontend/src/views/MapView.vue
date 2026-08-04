<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Filter, Layers3, LocateFixed } from '@lucide/vue'
import { api } from '../api'
import type { Event, Segment } from '../types'
import StateView from '../components/StateView.vue'
import TrafficMap from '../components/TrafficMap.vue'
import { useCityStore } from '../stores/cityStore'

const cityStore = useCityStore()
const loading = ref(true)
const error = ref('')
const level = ref('全部')
const eventType = ref('全部')
const sceneKey = ref('normal')
const segments = ref<Segment[]>([])
const events = ref<Event[]>([])
const selected = ref<Segment>()

const scenes = computed(() => {
  const city = cityStore.currentCity
  const firstSegments = segments.value
  return [
    { key: 'normal', label: '全域运行', target: '', center: { ...city.center, zoom: city.zoom }, insight: `${city.name}全域路网运行可控，保持重点区域与换乘节点联合监测。` },
    ...city.scenarios.slice(0, 3).map((label, index) => ({
      key: `scenario-${index}`,
      label,
      target: firstSegments[index]?.id || '',
      center: { ...(firstSegments[index]?.coordinates[0] || city.center), zoom: city.zoom + .8 },
      insight: `${label}进入响应窗口，建议结合实时路况、事件和天气影响进行联动调度。`,
    })),
  ]
})
const activeScene = computed(() => scenes.value.find(scene => scene.key === sceneKey.value) || scenes.value[0])
const shownSegments = computed(() => level.value === '全部' ? segments.value : segments.value.filter(x => x.congestion_level === level.value))
const shownEvents = computed(() => eventType.value === '全部' ? events.value : events.value.filter(x => x.type === eventType.value))

async function load() {
  loading.value = true
  error.value = ''
  try {
    [segments.value, events.value] = await Promise.all([api.segments(cityStore.currentCityCode), api.events(cityStore.currentCityCode)])
    selected.value = segments.value[0]
  } catch {
    error.value = '地图态势加载失败'
  } finally {
    loading.value = false
  }
}

watch(sceneKey, () => {
  const target = activeScene.value.target
  selected.value = segments.value.find(segment => segment.id === target) || segments.value[0]
})
watch(() => cityStore.currentCityCode, () => {
  sceneKey.value = 'normal'
  load()
})
onMounted(load)
</script>

<template>
  <div class="page full">
    <div class="page-title">
      <div>
        <h2>{{ cityStore.currentCity.name }}态势地图</h2>
        <p>路段、事件、天气和治理场景联动分析</p>
      </div>
      <div class="filters">
        <Filter :size="17" />
        <select v-model="level" aria-label="拥堵等级筛选">
          <option v-for="x in ['全部', '畅通', '缓行', '拥堵', '严重拥堵']" :key="x">{{ x }}</option>
        </select>
        <select v-model="eventType" aria-label="事件类型筛选">
          <option value="全部">全部事件</option>
          <option value="congestion">拥堵</option>
          <option value="weather">天气</option>
          <option value="event">突发事件</option>
          <option value="commute">通勤</option>
        </select>
      </div>
    </div>
    <StateView :loading="loading" :error="error" @retry="load">
      <div class="scenario-tabs">
        <span><Layers3 :size="16" /> {{ cityStore.currentCity.name }}场景</span>
        <button v-for="scene in scenes" :key="scene.key" :class="{ active: sceneKey === scene.key }" @click="sceneKey = scene.key">
          {{ scene.label }}
        </button>
      </div>
      <div class="map-layout">
        <section class="panel map-large">
          <TrafficMap :segments="shownSegments" :events="shownEvents" :selected-id="selected?.id" :focus="activeScene.center" :city-name="cityStore.currentCity.name" @select="selected = $event" />
        </section>
        <aside class="panel detail">
          <div class="panel-head"><h3>路段详情</h3><LocateFixed :size="18" /></div>
          <template v-if="selected">
            <span class="status-tag">{{ selected.congestion_level }}</span>
            <h2>{{ selected.name }}</h2>
            <p>{{ selected.district }}</p>
            <dl>
              <div><dt>平均速度</dt><dd>{{ selected.average_speed }} km/h</dd></div>
              <div><dt>实时流量</dt><dd>{{ selected.flow }} 辆/h</dd></div>
              <div><dt>拥堵指数</dt><dd>{{ selected.congestion_index }}</dd></div>
              <div><dt>天气影响</dt><dd>{{ selected.weather_factor }}%</dd></div>
              <div><dt>事件影响</dt><dd>{{ selected.event_factor }}%</dd></div>
            </dl>
            <div class="scene-insight">
              <b>{{ activeScene.label }}</b>
              <p>{{ activeScene.insight }}</p>
            </div>
            <div class="decision">
              <b>决策建议</b>
              <p>{{ selected.congestion_index >= 60 ? '建议发布绕行提示，并加强路口疏导。' : '当前运行基本稳定，保持连续监测。' }}</p>
            </div>
          </template>
        </aside>
      </div>
    </StateView>
  </div>
</template>

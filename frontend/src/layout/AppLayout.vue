<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Activity, AlarmClock, CloudRain, Compass, DatabaseZap, Map, Navigation, Route, ShieldCheck, Smartphone, TriangleAlert, Zap } from '@lucide/vue'
import CitySelector from '../components/CitySelector.vue'
import CitizenMobileSimulator from '../components/CitizenMobileSimulator.vue'
import { useCityStore } from '../stores/cityStore'

const now = ref(new Date())
const cityStore = useCityStore()
const citizenOpen = ref(false)
let timer = 0

onMounted(() => {
  timer = window.setInterval(() => { now.value = new Date() }, 1000)
  cityStore.hydrate()
})
onUnmounted(() => clearInterval(timer))

const displayTime = computed(() => {
  const pad = (value: number) => String(value).padStart(2, '0')
  const date = now.value
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
})

const nav = [
  ['/dashboard', '演示总览', Activity],
  ['/map', '态势地图', Map],
  ['/mobility', '出行服务', Compass],
  ['/prediction', '拥堵预测', AlarmClock],
  ['/route', '出行规划', Route],
  ['/warnings', '事件预警', TriangleAlert],
  ['/simulation', '事件推演', Zap],
] as const
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <Navigation :size="25" />
        <div>
          <b>智途云枢</b>
          <small>MULTI-CITY TRAFFIC OPERATIONS CENTER</small>
        </div>
      </div>
      <nav>
        <RouterLink v-for="[to, label, Icon] in nav" :key="to" :to="to">
          <component :is="Icon" :size="18" />
          <span>{{ label }}</span>
        </RouterLink>
      </nav>
      <div class="source">
        <i></i>
        <div>
          <b>数据链路在线</b>
          <small>路况 / 公交 / POI / 天气 / 用户偏好</small>
        </div>
      </div>
    </aside>
    <section class="workspace">
      <header>
        <div>
          <h1>多城市智慧交通控制中心 · {{ cityStore.currentCity.name }}</h1>
          <p>{{ cityStore.currentCity.description }} · 多源数据融合 · 交管云端决策 · 仿真演示数据</p>
        </div>
        <div class="head-meta">
          <CitySelector />
          <button class="citizen-launch" title="打开市民端模拟器" @click="citizenOpen = true"><Smartphone :size="16" /><span>市民端</span></button>
          <span><CloudRain :size="17" /> 阵雨 27℃</span>
          <span class="data-source"><DatabaseZap :size="17" /> 模拟快照 / 可离线</span>
          <span class="link-state"><i></i> 同源数据</span>
          <span><ShieldCheck :size="17" /> P0 演示版</span>
          <strong>{{ displayTime }}</strong>
        </div>
      </header>
      <main>
        <RouterView />
      </main>
    </section>
  </div>
  <CitizenMobileSimulator v-if="citizenOpen" @close="citizenOpen = false" />
</template>

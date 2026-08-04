<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Activity, CarFront, Gauge, Radio, TriangleAlert } from '@lucide/vue'
import { api } from '../api'
import type { Event, Segment, Summary, TrendPoint, Warning } from '../types'
import StateView from '../components/StateView.vue'
import LineChart from '../components/LineChart.vue'
import DigitalTwinScene from '../components/DigitalTwinScene.vue'
import { useCityStore } from '../stores/cityStore'

const loading = ref(true)
const error = ref('')
const summary = ref<Summary>()
const trend = ref<TrendPoint[]>([])
const segments = ref<Segment[]>([])
const events = ref<Event[]>([])
const warnings = ref<Warning[]>([])
const selected = ref<Segment>()
const cityStore = useCityStore()

const topIssue = computed(() => summary.value?.top_congested?.[0])
const updatedAt = computed(() => summary.value?.updated_at ? new Date(summary.value.updated_at).toLocaleTimeString('zh-CN', { hour12: false }) : '--')

async function load() {
  loading.value = true
  error.value = ''
  try {
    [summary.value, trend.value, segments.value, events.value, warnings.value] = await Promise.all([
      api.summary(cityStore.currentCityCode),
      api.trend(cityStore.currentCityCode),
      api.segments(cityStore.currentCityCode),
      api.events(cityStore.currentCityCode),
      api.warnings(cityStore.currentCityCode),
    ])
    selected.value = summary.value.top_congested[0] || segments.value[0]
  } catch {
    error.value = '交通数据加载失败，请检查数据源。'
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => cityStore.currentCityCode, load)
</script>

<template>
  <div class="page dashboard-page">
    <div class="page-title command-title">
      <div>
        <h2>{{ cityStore.currentCity.name }}运行总览</h2>
        <p>{{ cityStore.currentCity.description }} · 感知、研判、决策同源态势</p>
      </div>
      <span class="live"><i></i>态势持续更新 · {{ updatedAt }}</span>
    </div>
    <StateView :loading="loading" :error="error" @retry="load">
      <section class="command-hero">
        <div class="hero-stage panel">
          <DigitalTwinScene :segments="segments" :events="events" :selected-id="selected?.id" :city-name="cityStore.currentCity.name" :center="cityStore.currentCity.center" @select="selected = $event" />
        </div>
        <aside class="hero-decision panel">
          <div class="panel-head"><h3>当前研判</h3><span>TOC Decision</span></div>
          <div class="decision-stack">
            <span>主要问题</span>
            <strong>{{ selected?.name || topIssue?.name }}</strong>
            <p>{{ selected?.district || topIssue?.district }}，拥堵指数 {{ selected?.congestion_index || topIssue?.congestion_index }}，建议联动公交优先、绕行诱导与市民端路线重排。</p>
          </div>
          <div class="brief-mini">
            <b>示范场景</b>
            <span>{{ cityStore.currentCity.scenarios.join(' · ') }}</span>
          </div>
        </aside>
      </section>
      <div class="kpis">
        <article><div class="kpi-icon amber"><Gauge /></div><div><span>交通运行指数</span><strong>{{ summary?.congestion_index }}</strong><small>{{ summary?.congestion_level }}</small></div></article>
        <article><div class="kpi-icon green"><CarFront /></div><div><span>平均速度</span><strong>{{ summary?.average_speed }}</strong><small>km/h</small></div></article>
        <article><div class="kpi-icon orange"><Activity /></div><div><span>拥堵路段</span><strong>{{ summary?.congested_segments }}</strong><small>/ {{ summary?.monitored_segments }} 路段</small></div></article>
        <article><div class="kpi-icon red"><TriangleAlert /></div><div><span>活跃事件</span><strong>{{ summary?.active_events }}</strong><small>需要关注</small></div></article>
      </div>
      <div class="dash-grid refined">
        <section class="panel ranking">
          <div class="panel-head"><h3>高风险道路排行</h3><Radio :size="17" /></div>
          <button v-for="(s, i) in summary?.top_congested" :key="s.id" :class="['rank rank-button', { active: selected?.id === s.id }]" @click="selected = s">
            <b>{{ i + 1 }}</b>
            <div><strong>{{ s.name }}</strong><small>{{ s.district }} · {{ s.average_speed }} km/h · 流量 {{ s.flow }}</small></div>
            <em>{{ s.congestion_index }}</em>
          </button>
        </section>
        <section class="panel trend-panel">
          <div class="panel-head"><h3>今日拥堵趋势</h3><span>指数 0-100</span></div>
          <LineChart :labels="trend.map(x => x.time)" :values="trend.map(x => x.congestion_index)" />
        </section>
        <section class="panel alerts">
          <div class="panel-head"><h3>关键预警</h3><RouterLink to="/warnings">查看全部</RouterLink></div>
          <div v-for="w in warnings" :key="w.id" class="alert-row">
            <i :class="w.level"></i>
            <div><strong>{{ w.title }}</strong><small>{{ w.district }} · {{ w.occurred_at.slice(11) }}</small></div>
          </div>
        </section>
      </div>
    </StateView>
  </div>
</template>

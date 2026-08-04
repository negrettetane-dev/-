<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AlertTriangle, CloudRain, GitBranch, Zap } from '@lucide/vue'
import { api } from '../api'
import type { Segment, WhatIfResult } from '../types'
import StateView from '../components/StateView.vue'
import LineChart from '../components/LineChart.vue'
import { useCityStore } from '../stores/cityStore'

const cityStore = useCityStore()
const segments = ref<Segment[]>([])
const eventType = ref<'waterlog' | 'accident'>('waterlog')
const targetSegment = ref('')
const waterDepth = ref(30)
const result = ref<WhatIfResult>()
const loading = ref(false)
const loadingSegments = ref(true)
const error = ref('')
const target = computed(() => segments.value.find(segment => segment.name === targetSegment.value))

async function loadSegments() {
  loadingSegments.value = true
  try {
    segments.value = await api.segments(cityStore.currentCityCode)
    if (!segments.value.some(segment => segment.name === targetSegment.value)) targetSegment.value = segments.value[0]?.name || ''
    result.value = undefined
  } catch {
    error.value = '推演路段加载失败'
  } finally {
    loadingSegments.value = false
  }
}

async function runSimulation() {
  if (!targetSegment.value) return
  loading.value = true
  error.value = ''
  try {
    result.value = await api.whatIf(cityStore.currentCityCode, {
      event_type: eventType.value,
      target_segment: targetSegment.value,
      ...(eventType.value === 'waterlog' ? { water_depth_cm: waterDepth.value } : {}),
    })
  } catch {
    error.value = '沙盘推演服务暂时不可用'
  } finally {
    loading.value = false
  }
}

watch(() => cityStore.currentCityCode, loadSegments)
onMounted(loadSegments)
</script>

<template>
  <div class="page">
    <div class="page-title">
      <div>
        <h2>{{ cityStore.currentCity.name }}事件沙盘推演</h2>
        <p>模拟突发事件影响范围，生成路网分流与现场处置 SOP</p>
      </div>
      <span class="live"><i></i>推演数据 · 不写入实时路况</span>
    </div>
    <section class="simulation-form panel">
      <label>事件类型
        <select v-model="eventType">
          <option value="waterlog">积水事件</option>
          <option value="accident">交通事故</option>
        </select>
      </label>
      <label>目标路段
        <select v-model="targetSegment" :disabled="loadingSegments">
          <option v-for="segment in segments" :key="segment.id" :value="segment.name">{{ segment.name }}</option>
        </select>
      </label>
      <label v-if="eventType === 'waterlog'">积水深度
        <input v-model.number="waterDepth" type="number" min="0" max="200" step="5"> 
      </label>
      <div v-else></div>
      <button class="primary" :disabled="loading || loadingSegments || !targetSegment" @click="runSimulation"><Zap :size="17" />开始推演</button>
    </section>

    <div v-if="error" class="inline-notice">{{ error }}</div>
    <StateView v-else :loading="loadingSegments" :empty="!result" empty-text="选择事件类型和目标路段，开始一次可解释的交通影响推演。">
      <div v-if="result" class="simulation-grid">
        <section class="panel simulation-result">
          <div class="panel-head"><h3>路网影响量化</h3><GitBranch :size="18" /></div>
          <div class="comparison-grid">
            <article><span>事件前速度</span><strong>{{ result.comparison.before_speed_kmh }}<small> km/h</small></strong></article>
            <article><span>事件后速度</span><strong>{{ result.comparison.after_speed_kmh }}<small> km/h</small></strong></article>
            <article><span>优化后速度</span><strong>{{ result.comparison.optimized_speed_kmh }}<small> km/h</small></strong></article>
          </div>
          <div class="panel-head"><h3>拥堵扩散趋势</h3><AlertTriangle :size="18" /></div>
          <LineChart :labels="['+15分钟', '+30分钟', '+45分钟']" :values="result.spread_trend" color="var(--color-danger)" />
          <div class="panel-head"><h3>受影响路段</h3><span>{{ result.affected_segments.length }} 个</span></div>
          <div class="simulation-list"><span v-for="name in result.affected_segments" :key="name">{{ name }}</span></div>
        </section>
        <aside class="panel">
          <div class="panel-head"><h3>联动处置 SOP</h3><CloudRain :size="18" /></div>
          <ol class="sop-list">
            <li v-for="action in result.sop_actions" :key="action">{{ action }}</li>
          </ol>
          <div class="decision" style="margin: 0 var(--space-sm) var(--space-sm)">
            <b>推演结论</b>
            <p>{{ target?.name }}在事件冲击下会向相邻路网扩散，优先执行现场警戒、信号联动与远端诱导。</p>
          </div>
        </aside>
      </div>
    </StateView>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BrainCircuit, CloudRain, Percent } from '@lucide/vue'
import { api } from '../api'
import type { Prediction } from '../types'
import StateView from '../components/StateView.vue'
import LineChart from '../components/LineChart.vue'
import { useCityStore } from '../stores/cityStore'

const horizon = ref(60)
const loading = ref(true)
const error = ref('')
const data = ref<Prediction>()
const cityStore = useCityStore()
const labels = computed(() => ['当前', ...(data.value?.items.map(x => `+${x.after_minutes}分钟`) || [])])
const values = computed(() => [data.value?.baseline_index || 0, ...(data.value?.items.map(x => x.congestion_index) || [])])
const baseline = computed(() => Array(labels.value.length).fill(data.value?.baseline_index || 0))

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await api.prediction(cityStore.currentCityCode, horizon.value)
  } catch {
    error.value = '预测服务暂时不可用'
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => cityStore.currentCityCode, load)
</script>

<template>
  <div class="page">
    <div class="page-title">
      <div>
        <h2>{{ cityStore.currentCity.name }}拥堵预测</h2>
        <p>多因子融合的短时交通趋势研判 · 当前基线 {{ data?.baseline_index ?? '--' }}</p>
      </div>
      <div class="segments-control" role="tablist" aria-label="预测时长">
        <button v-for="n in [30, 60, 90]" :key="n" :class="{ active: horizon === n }" @click="horizon = n; load()">{{ n }}分钟</button>
      </div>
    </div>
    <StateView :loading="loading" :error="error" @retry="load">
      <div class="prediction-grid">
        <section class="panel prediction-chart">
          <div class="panel-head"><h3>未来 {{ horizon }} 分钟趋势</h3><span>实线预测 · 虚线当前基线</span></div>
          <LineChart :labels="labels" :values="values" :compare-values="baseline" color="var(--color-warning)" />
        </section>
        <section class="panel confidence">
          <Percent />
          <strong>{{ Math.round((data?.confidence || 0) * 100) }}%</strong>
          <span>预测置信度</span>
          <p>{{ data?.model }}</p>
        </section>
        <section class="panel risk-list">
          <div class="panel-head"><h3>高风险路段</h3><BrainCircuit :size="18" /></div>
          <div v-for="(s, i) in data?.high_risk_segments" :key="s.id" class="risk">
            <b>0{{ i + 1 }}</b>
            <div><strong>{{ s.name }}</strong><small>{{ s.district }} · {{ s.congestion_level }}</small></div>
            <em>{{ s.congestion_index }}</em>
          </div>
        </section>
        <section class="panel factors">
          <div class="panel-head"><h3>主要影响因素</h3><CloudRain :size="18" /></div>
          <div class="factor-tags"><span v-for="f in data?.factors" :key="f">{{ f }}</span></div>
          <p>{{ data?.explanation }}</p>
        </section>
      </div>
    </StateView>
  </div>
</template>

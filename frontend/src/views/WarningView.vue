<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BellRing, ChevronRight, X } from '@lucide/vue'
import { api } from '../api'
import type { Warning } from '../types'
import StateView from '../components/StateView.vue'
import { useCityStore } from '../stores/cityStore'

const loading = ref(true)
const error = ref('')
const level = ref('全部')
const type = ref('全部')
const status = ref('全部')
const selected = ref<Warning>()
const items = ref<Warning[]>([])
const cityStore = useCityStore()
const shown = computed(() => items.value.filter(w =>
  (level.value === '全部' || w.level === level.value)
  && (type.value === '全部' || w.type === type.value)
  && (status.value === '全部' || w.status === status.value),
))
const levelText = (value: string) => value === 'red' ? '红色' : value === 'orange' ? '橙色' : '黄色'
const typeText = (value: string) => value === 'weather' ? '天气' : value === 'congestion' ? '拥堵' : '事件'
const statusText = (value: string) => value === 'active' ? '监测中' : value

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await api.warnings(cityStore.currentCityCode)
  } catch {
    error.value = '预警数据加载失败'
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
        <h2>{{ cityStore.currentCity.name }}事件预警中心</h2>
        <p>主动识别拥堵、天气与突发事件风险 · {{ cityStore.currentCity.description }}</p>
      </div>
      <div class="filters">
        <select v-model="level">
          <option value="全部">全部等级</option>
          <option value="red">红色</option>
          <option value="orange">橙色</option>
          <option value="yellow">黄色</option>
        </select>
        <select v-model="type">
          <option value="全部">全部类型</option>
          <option value="congestion">拥堵</option>
          <option value="weather">天气</option>
        </select>
        <select v-model="status">
          <option value="全部">全部状态</option>
          <option value="active">监测中</option>
        </select>
      </div>
    </div>
    <StateView :loading="loading" :error="error" :empty="shown.length === 0" @retry="load">
      <div class="warning-list">
        <article v-for="w in shown" :key="w.id" :class="['warning-card', w.level]" @click="selected = w">
          <div class="warning-icon"><BellRing /></div>
          <div class="warning-main">
            <div><span>{{ levelText(w.level) }}预警 · {{ typeText(w.type) }}</span><time>{{ w.occurred_at }}</time></div>
            <h3>{{ w.title }}</h3>
            <p>{{ w.impact }}</p>
            <small>{{ w.district }} · 状态：{{ statusText(w.status) }}</small>
          </div>
          <ChevronRight />
        </article>
      </div>
    </StateView>
    <div v-if="selected" class="drawer-mask" @click.self="selected = undefined">
      <aside class="drawer">
        <button class="close" title="关闭" @click="selected = undefined"><X /></button>
        <span :class="['status-tag', selected.level]">{{ levelText(selected.level) }}预警详情</span>
        <h2>{{ selected.title }}</h2>
        <p>{{ selected.occurred_at }} · {{ selected.district }}</p>
        <hr>
        <h4>影响研判</h4>
        <p>{{ selected.impact }}</p>
        <h4>处置建议</h4>
        <div class="decision"><p>{{ selected.suggestion }}</p></div>
      </aside>
    </div>
  </div>
</template>

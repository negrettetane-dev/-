<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LineChart as EChartsLine } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { init, use, type ECharts } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

use([EChartsLine, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{ labels: string[]; values: number[]; color?: string; compareValues?: number[] }>()
const el = ref<HTMLElement>()
let chart: ECharts | undefined

const token = (name: string, fallback: string) => {
  if (!el.value) return fallback
  const value = getComputedStyle(el.value).getPropertyValue(name).trim()
  return value || fallback
}

const resolveColor = (value: string | undefined, fallbackToken = '--color-accent') => {
  if (!value) return token(fallbackToken, '#00d5ff')
  return value.startsWith('var(') ? token(value.slice(4, -1), token(fallbackToken, '#00d5ff')) : value
}

const draw = () => {
  if (!el.value) return
  chart ??= init(el.value)
  const mainColor = resolveColor(props.color)
  const compareColor = token('--color-muted-2', '#64748b')
  chart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 40, right: 18, top: 24, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(18, 26, 43, .94)',
      borderColor: mainColor,
      borderWidth: 1,
      textStyle: { color: token('--color-ink', '#f7fbff') },
    },
    xAxis: {
      type: 'category',
      data: props.labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, .2)' } },
      axisTick: { show: false },
      axisLabel: { color: token('--color-muted', '#94a3b8') },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, .055)' } },
      axisLabel: { color: token('--color-muted', '#94a3b8') },
    },
    series: [
      {
        name: '当前/预测',
        type: 'line',
        smooth: true,
        data: props.values,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3, color: mainColor, shadowColor: mainColor, shadowBlur: 10 },
        itemStyle: { color: mainColor, borderColor: '#ffffff', borderWidth: 1 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 213, 255, .34)' },
              { offset: 1, color: 'rgba(0, 213, 255, 0)' },
            ],
          },
        },
      },
      ...(props.compareValues ? [{
        name: '当前基线',
        type: 'line',
        smooth: true,
        data: props.compareValues,
        symbolSize: 6,
        lineStyle: { width: 2, color: compareColor, type: 'dashed' },
        itemStyle: { color: compareColor },
      }] : []),
    ],
  })
}
const resize = () => chart?.resize()

onMounted(() => {
  draw()
  window.addEventListener('resize', resize)
})
watch(() => [props.labels, props.values, props.compareValues, props.color], draw, { deep: true })
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
})
</script>

<template>
  <div ref="el" class="chart"></div>
</template>

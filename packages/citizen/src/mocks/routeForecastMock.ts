// ===== 智途云枢 · 路线拥堵预测 Mock =====
// 未来 15/30/45/60 分钟拥堵预测（模拟数据）。
// 规则稳定可重复，不使用 Math.random，不伪造路线 path。
// 预测以 departureAt（实际出发时间）为基准时段：早/晚高峰上调指数，深夜下调。

import type { TravelMode, RouteForecastPoint } from '../types/routeForecast';

// 各出行方式的基础趋势（稳定、可重复）
const BASE_TRENDS: Record<TravelMode, Omit<RouteForecastPoint, 'offsetMinutes'>[]> = {
  drive: [
    { level: 'slow', index: 5.6, avgSpeed: 31, estimatedDuration: 1860 },
    { level: 'slow', index: 5.8, avgSpeed: 30, estimatedDuration: 1900 },
    { level: 'congested', index: 6.9, avgSpeed: 24, estimatedDuration: 2140 },
    { level: 'slow', index: 5.5, avgSpeed: 32, estimatedDuration: 1800 },
  ],
  bus: [
    { level: 'slow', index: 4.2, avgSpeed: 26, estimatedDuration: 2160 },
    { level: 'slow', index: 4.4, avgSpeed: 25, estimatedDuration: 2220 },
    { level: 'slow', index: 4.8, avgSpeed: 24, estimatedDuration: 2280 },
    { level: 'slow', index: 4.1, avgSpeed: 26, estimatedDuration: 2100 },
  ],
  bike: [
    { level: 'free', index: 2.8, avgSpeed: 15, estimatedDuration: 1500 },
    { level: 'free', index: 2.9, avgSpeed: 15, estimatedDuration: 1520 },
    { level: 'free', index: 3.1, avgSpeed: 14, estimatedDuration: 1580 },
    { level: 'free', index: 2.7, avgSpeed: 15, estimatedDuration: 1480 },
  ],
  walk: [
    { level: 'free', index: 1.5, avgSpeed: 5, estimatedDuration: 1800 },
    { level: 'free', index: 1.5, avgSpeed: 5, estimatedDuration: 1800 },
    { level: 'free', index: 1.6, avgSpeed: 5, estimatedDuration: 1840 },
    { level: 'free', index: 1.4, avgSpeed: 5, estimatedDuration: 1760 },
  ],
};

/** 出发时段拥堵因子：早高峰 7-9、晚高峰 17-19 上调；深夜 22-6 下调；确定性（同 departureAt 同结果） */
function peakFactor(hour: number): number {
  if (hour >= 7 && hour <= 9) return 0.8;
  if (hour >= 17 && hour <= 19) return 0.6;
  if (hour >= 22 || hour <= 5) return -0.8;
  if (hour >= 12 && hour <= 14) return 0.2;
  return 0;
}

function clampIndex(value: number): number {
  return Math.round(Math.max(1, Math.min(9.9, value)) * 10) / 10;
}

/** 为指定方式生成 15/30/45/60 分钟预测点；departureAt 作为预测基准时间（模拟数据） */
export function getMockRouteForecast(mode: TravelMode, departureAt?: string): RouteForecastPoint[] {
  const base = BASE_TRENDS[mode];
  const offsets: RouteForecastPoint['offsetMinutes'][] = [15, 30, 45, 60];
  const factor = departureAt && !Number.isNaN(new Date(departureAt).getTime())
    ? peakFactor(new Date(departureAt).getHours())
    : 0;
  return offsets.map((offsetMinutes, i) => ({
    offsetMinutes,
    level: base[i].level,
    index: clampIndex(base[i].index + factor),
    avgSpeed: Math.round(base[i].avgSpeed),
    estimatedDuration: base[i].estimatedDuration,
  }));
}

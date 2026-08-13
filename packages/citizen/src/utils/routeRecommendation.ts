// ===== 智途云枢 · 路线智能推荐算法 =====
// 基于当前耗时、未来预测拥堵、距离、收费、数据完整度打分。
// 推荐可解释：生成推荐理由。

import type { TravelMode, RouteForecastPoint } from '../types/routeForecast';

export interface SmartRouteScoreInput {
  mode: TravelMode;
  label: string;
  distance: number; // 米
  duration: number; // 秒
  toll?: number; // 元
  forecast?: RouteForecastPoint[]; // 可能为空
}

/** 综合评分：分数越低越优 */
export function calculateRouteScore(route: SmartRouteScoreInput): number {
  const durationMin = route.duration / 60;
  const distanceKm = route.distance / 1000;

  // 当前耗时（分钟）权重 3
  let score = durationMin * 3;

  // 未来预测：30 分钟后拥堵指数影响
  const forecast30 = route.forecast?.find(f => f.offsetMinutes === 30);
  if (forecast30) {
    score += forecast30.index * 2; // 拥堵指数越高分越高（越差）
  }

  // 距离（km）权重 1
  score += distanceKm;

  // 收费：每元 0.5
  if (route.toll) score += route.toll * 0.5;

  // 数据完整度：缺预测数据加罚分
  if (!route.forecast || route.forecast.length === 0) score += 8;

  return Math.round(score * 10) / 10;
}

/** 从多方案中选最优 */
export function recommendBestRoute(routes: SmartRouteScoreInput[]): SmartRouteScoreInput | null {
  if (!routes.length) return null;
  return routes.reduce((best, r) => (calculateRouteScore(r) < calculateRouteScore(best) ? r : best));
}

/** 生成推荐理由 */
export function generateRecommendationReason(
  selected: SmartRouteScoreInput,
  routes: SmartRouteScoreInput[],
): string {
  const forecast30 = selected.forecast?.find(f => f.offsetMinutes === 30);
  const forecast60 = selected.forecast?.find(f => f.offsetMinutes === 60);

  const parts: string[] = [];

  // 与最快的方案对比耗时
  const fastest = routes.reduce((a, b) => (a.duration < b.duration ? a : b));
  if (fastest.mode !== selected.mode) {
    const diffMin = Math.round((selected.duration - fastest.duration) / 60);
    if (diffMin > 0) {
      parts.push(`虽比最快方案慢约 ${diffMin} 分钟`);
    }
  }

  // 预测趋势
  if (forecast30 && forecast60) {
    if (forecast60.index < forecast30.index) {
      parts.push(`但预计 60 分钟后拥堵较 30 分钟时缓解，届时出行更顺畅`);
    } else if (forecast30.index > 5) {
      parts.push(`但 30 分钟后该方案拥堵指数约 ${forecast30.index.toFixed(1)}，早晚高峰请留意`);
    }
  }

  if (selected.forecast && selected.forecast.length > 0) {
    parts.push('以上推荐基于模拟预测，仅供演示参考');
  } else {
    parts.push('当前仅依据距离、时间和收费进行推荐');
  }

  return parts.join('，') || '综合距离、时间与收费考虑，该方案较为均衡';
}

/** 出发时间建议 */
export function generateDepartureAdvice(forecast?: RouteForecastPoint[]): string {
  if (!forecast || forecast.length === 0) {
    return '暂无法提供出发时间建议';
  }
  const now = forecast[0];
  const f30 = forecast.find(f => f.offsetMinutes === 30);
  const f60 = forecast.find(f => f.offsetMinutes === 60);

  if (f60 && f60.index < (f30?.index ?? now.index)) {
    return '如时间允许，建议约45分钟后出发，预计届时交通压力有所缓解';
  }
  if (f30 && f30.index > now.index) {
    return '建议现在出发，预计30分钟后交通压力上升';
  }
  return '当前与未来交通压力相近，按需出发即可';
}

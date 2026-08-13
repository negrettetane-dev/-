// ===== 智途云枢 · 路线拥堵预测 Service =====
// 数据来源切换层：当前使用前端 Mock（VITE_ROUTE_FORECAST_SOURCE=mock）。
// 未来后端完成后，只需替换本文件内部实现为真实接口，页面组件无需改动。

import type { TravelMode, ForecastSource, RouteForecastPoint } from '../types/routeForecast';
import { getMockRouteForecast } from '../mocks/routeForecastMock';

export interface ForecastResult {
  points: RouteForecastPoint[];
  source: ForecastSource;
}

/**
 * 获取某出行方式未来拥堵预测。
 * 当前固定走 Mock（稳定可重复，非随机）。
 * TODO BACKEND: future: GET /api/route/congestion-forecast?mode=
 */
export async function getRouteForecast(mode: TravelMode): Promise<ForecastResult> {
  // 模拟网络延迟
  await new Promise(r => setTimeout(r, 300));
  return {
    points: getMockRouteForecast(mode),
    source: 'simulation',
  };
}

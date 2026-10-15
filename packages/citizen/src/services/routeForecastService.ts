// ===== 智途云枢 · 路线拥堵预测 Service =====
// 数据来源切换层：当前使用前端 Mock（VITE_ROUTE_FORECAST_SOURCE=mock）。
// 未来后端完成后，只需替换本文件内部实现为真实接口，页面组件无需改动。

import type { TravelMode, ForecastSource, RouteForecastPoint } from '../types/routeForecast';
import { getMockRouteForecast } from '../mocks/routeForecastMock';

export interface ForecastResult {
  points: RouteForecastPoint[];
  source: ForecastSource;
  /** 预测基准时间（实际出发时间 ISO），供前端展示「以 X 出发为基准」 */
  baseAt?: string;
}

/**
 * 获取某出行方式未来拥堵预测。
 * departureAt：实际出发时间（ISO），作为预测基准；缺省回退当前时间。
 * 当前固定走 Mock（稳定可重复，非随机）。
 * TODO BACKEND: future: GET /api/route/congestion-forecast?mode=&departure_at=&origin=&destination=
 */
export async function getRouteForecast(mode: TravelMode, departureAt?: string): Promise<ForecastResult> {
  // 模拟网络延迟
  await new Promise(r => setTimeout(r, 300));
  return {
    points: getMockRouteForecast(mode, departureAt),
    source: 'simulation',
    baseAt: departureAt || undefined,
  };
}

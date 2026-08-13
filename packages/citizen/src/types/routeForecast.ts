// ===== 智途云枢 · 路线预测类型 =====

export type TravelMode = 'drive' | 'bus' | 'bike' | 'walk';

export type ForecastSource =
  | 'simulation'
  | 'api'
  | 'fallback'
  | 'unknown';

export interface RouteForecastPoint {
  offsetMinutes: 0 | 15 | 30 | 45 | 60;
  level: 'free' | 'slow' | 'congested' | 'blocked';
  index: number;
  avgSpeed: number;
  estimatedDuration: number;
}

export const FORECAST_LEVEL_LABEL: Record<RouteForecastPoint['level'], string> = {
  free: '畅通',
  slow: '缓行',
  congested: '拥堵',
  blocked: '严重拥堵',
};

export const FORECAST_LEVEL_COLOR: Record<RouteForecastPoint['level'], string> = {
  free: '#52c41a',
  slow: '#fadb14',
  congested: '#ff7a00',
  blocked: '#f5222d',
};

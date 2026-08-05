// ===== 交通路况相关 =====

/** 拥堵级别 */
export type CongestionLevel = 'free' | 'slow' | 'congested' | 'blocked';

/** 拥堵级别颜色映射 */
export const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  free: '#52c41a',
  slow: '#fadb14',
  congested: '#ff7a00',
  blocked: '#f5222d',
};

/** 拥堵级别中文 */
export const CONGESTION_LABELS: Record<CongestionLevel, string> = {
  free: '畅通',
  slow: '缓行',
  congested: '拥堵',
  blocked: '严重拥堵',
};

/** 道路路段 */
export interface RoadSegment {
  id: string;
  name: string;
  direction: string;
  startCoord: [number, number]; // [lng, lat]
  endCoord: [number, number];
  speed: number; // km/h
  freeFlowSpeed: number;
  congestionLevel: CongestionLevel;
  travelTimeIndex: number; // 实际通行时间/自由流通行时间
  timestamp: number;
}

/** 交通事件/事故 */
export interface TrafficIncident {
  id: string;
  type: 'accident' | 'construction' | 'control' | 'flooding' | 'fog' | 'activity';
  title: string;
  description: string;
  position: [number, number];
  roadName: string;
  direction?: string;
  severity: 'normal' | 'serious' | 'critical';
  startTime: number;
  endTime?: number;
  lanesClosed?: number;
  totalLanes?: number;
  reportedBy?: 'system' | 'citizen';
}

/** 天气预警 */
export interface WeatherAlert {
  id: string;
  type: 'rain' | 'fog' | 'snow' | 'wind' | 'hail';
  level: 'blue' | 'yellow' | 'orange' | 'red';
  title: string;
  content: string;
  publishTime: number;
  validUntil: number;
  affectedAreas: string[];
}

/** 交通预警推送 */
export interface TrafficAlert {
  id: string;
  category: 'accident' | 'weather' | 'congestion' | 'control' | 'construction';
  title: string;
  summary: string;
  detail?: string;
  position?: [number, number];
  roadName?: string;
  severity: 'info' | 'warning' | 'critical';
  publishTime: number;
  validUntil?: number;
}

/** 城市拥堵概览 */
export interface CongestionOverview {
  cityIndex: number;        // 0-10, 全市拥堵指数
  avgSpeed: number;         // 平均车速 km/h
  congestedRoadCount: number;
  totalRoadCount: number;
  timestamp: number;
  districtRanking: DistrictCongestion[];
  trend24h: { hour: number; index: number }[];
}

export interface DistrictCongestion {
  district: string;
  index: number;
  avgSpeed: number;
  trend: 'up' | 'down' | 'stable';
}

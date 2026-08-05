import type { CongestionLevel } from './traffic';

// ===== 路径规划相关 =====

/** 出行方式 */
export type TravelMode = 'drive' | 'bus' | 'bike' | 'walk';

/** 出行方式标签 */
export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  drive: '驾车',
  bus: '公交地铁',
  bike: '骑行',
  walk: '步行',
};

/** POI 地点 */
export interface POI {
  id: string;
  name: string;
  address: string;
  coord: [number, number];
}

/** 路径规划请求 */
export interface RouteRequest {
  origin: POI;
  destination: POI;
  mode: TravelMode;
  departTime?: number; // 出发时间戳，默认现在
}

/** 预测时段路况 */
export interface CongestionPrediction {
  timeOffset: number; // 从现在起的分钟数 (15/30/45/60)
  estimatedDuration: number; // 预估通行时长 (秒)
  congestionLevel: CongestionLevel;
  confidence: number; // 0-1 置信度
}

/** 驾车路线 */
export interface DriveRoute {
  id: string;
  mode: 'drive';
  distance: number; // 米
  duration: number; // 秒
  tolls: number; // 过路费(元)
  trafficLights: number;
  polyline: [number, number][];
  steps: RouteStep[];
  congestionSegments: { level: CongestionLevel; ratio: number }[];
  predictions: CongestionPrediction[];
  bestDepartTime?: number; // AI推荐的最佳出发时间
  aiAdvice?: string; // AI出行建议
}

/** 公交地铁路线 */
export interface TransitRoute {
  id: string;
  mode: 'bus';
  distance: number;
  duration: number;
  cost: number; // 票价(元)
  segments: TransitSegment[];
  predictions: CongestionPrediction[];
}

export type TransitSegment = WalkSegment | BusSegment | MetroSegment;

export interface WalkSegment {
  type: 'walk';
  distance: number;
  duration: number;
  polyline: [number, number][];
  instruction: string;
}

export interface BusSegment {
  type: 'bus';
  lineName: string;
  lineId: string;
  fromStop: string;
  toStop: string;
  stopCount: number;
  duration: number;
  polyline: [number, number][];
  crowding: CrowdingLevel;
  nextBusArrival?: number; // 下一班车到站秒数
  nextBusCrowding?: CrowdingLevel;
}

export interface MetroSegment {
  type: 'metro';
  lineName: string;
  lineId: string;
  fromStation: string;
  toStation: string;
  stationCount: number;
  duration: number;
  crowding: CrowdingLevel;
}

/** 车厢拥挤度 */
export type CrowdingLevel = 'empty' | 'normal' | 'crowded' | 'full';

export const CROWDING_LABELS: Record<CrowdingLevel, string> = {
  empty: '宽松',
  normal: '适中',
  crowded: '拥挤',
  full: '满载',
};

/** 骑行/步行路线 */
export interface BikeWalkRoute {
  id: string;
  mode: 'bike' | 'walk';
  distance: number;
  duration: number;
  calories?: number; // 骑行消耗卡路里
  polyline: [number, number][];
  steps: RouteStep[];
  bikeLaneRatio?: number; // 骑行专用道占比
}

/** 通用路线步骤 */
export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  polyline: [number, number][];
  roadName?: string;
}

/** 路线搜索结果 */
export type RouteResult = DriveRoute | TransitRoute | BikeWalkRoute;

/** 公交实时信息 */
export interface BusRealtime {
  busId: string;
  lineId: string;
  lineName: string;
  plate: string;
  lat: number;
  lng: number;
  speed: number;
  direction: string;
  nextStop: string;
  nextStopArrivalSeconds: number;
  crowding: CrowdingLevel;
  timestamp: number;
}

import { apiGet } from './apiClient';
import type { MockRoadSegment, HourlyMetrics, AiAlert } from '../mocks/mockData';

export interface DistrictCongestionData {
  district: string;
  index: number;
  avgSpeed: number;
  trend: 'up' | 'down' | 'stable';
}

export interface RealTimeMetrics {
  timestamp: number;
  activeVehicles: number;
  avgSpeed: number;
  congestionIndex: number;
  incidentCount: number;
  congestedRoadCount: number;
  deviceOnlineRate: number;
}

export const dashboardService = {
  getMetrics: () => apiGet<RealTimeMetrics>('/dashboard/metrics'),
  getHourlyTraffic: () => apiGet<HourlyMetrics[]>('/dashboard/hourly'),
  getDistrictCongestion: () => apiGet<DistrictCongestionData[]>('/dashboard/districts'),
  getRoadSegments: () => apiGet<MockRoadSegment[]>('/dashboard/roads'),
  getAiAlerts: () => apiGet<AiAlert[]>('/dashboard/ai-alerts'),
};

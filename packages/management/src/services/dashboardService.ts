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
  getMetrics: async () => {
    const [hourly, roads, alerts, metrics] = await Promise.all([
      apiGet<HourlyMetrics[]>('/dashboard/hourly'),
      apiGet<MockRoadSegment[]>('/dashboard/roads'),
      apiGet<AiAlert[]>('/dashboard/ai-alerts'),
      // 尝试从 /dashboard/metrics 读取设备在线率；后端未提供该字段时不伪造，回退 0
      apiGet<{ deviceOnlineRate?: number }>('/dashboard/metrics').catch(() => null),
    ]);
    const latest = hourly[hourly.length - 1];
    return {
      timestamp: Date.now(),
      activeVehicles: latest?.activeVehicles ?? 0,
      avgSpeed: latest?.avgSpeed ?? 0,
      congestionIndex: latest?.congestionIndex ?? 0,
      incidentCount: latest?.incidentCount ?? alerts.length,
      congestedRoadCount: roads.filter(road => road.congestionLevel === 'congested' || road.congestionLevel === 'blocked').length,
      deviceOnlineRate: metrics?.deviceOnlineRate ?? 0,
    };
  },
  getHourlyTraffic: () => apiGet<HourlyMetrics[]>('/dashboard/hourly'),
  getDistrictCongestion: () => apiGet<DistrictCongestionData[]>('/dashboard/districts'),
  getRoadSegments: () => apiGet<MockRoadSegment[]>('/dashboard/roads'),
  getAiAlerts: async () => {
    const data = await apiGet<Array<{
      id:string; type:string; title:string; description:string; severity:string;
      roadName:string; time:number; status:string;
    }>>('/dashboard/ai-alerts');
    return data.map((item): AiAlert => ({
      id:item.id,
      type:item.type || item.title,
      location:item.roadName,
      time:item.time,
      confidence:item.severity === 'high' ? 0.9 : item.severity === 'medium' ? 0.7 : 0.5,
      description:item.description,
    }));
  },
};

import { create } from 'zustand';
import type { HourlyMetrics, AiAlert } from '../mocks/mockData';
import type { DistrictCongestionData, RealTimeMetrics } from '../services/dashboardService';
import { dashboardService } from '../services/dashboardService';
import type { MockRoadSegment } from '../mocks/mockData';

interface DashboardState {
  metrics: RealTimeMetrics | null;
  hourlyData: HourlyMetrics[];
  districtData: DistrictCongestionData[];
  roadSegments: MockRoadSegment[];
  aiAlerts: AiAlert[];
  loading: boolean;

  fetchMetrics: () => Promise<void>;
  fetchHourlyData: () => Promise<void>;
  fetchDistrictData: () => Promise<void>;
  fetchRoadSegments: () => Promise<void>;
  fetchAiAlerts: () => Promise<void>;
  fetchAll: () => Promise<void>;

  // For auto-refresh: update metrics with slight random variation
  tick: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  metrics: null,
  hourlyData: [],
  districtData: [],
  roadSegments: [],
  aiAlerts: [],
  loading: false,

  fetchMetrics: async () => {
    try {
      const data = await dashboardService.getMetrics();
      set({ metrics: data });
    } catch { set({ metrics: null }); }
  },
  fetchHourlyData: async () => {
    try {
      const data = await dashboardService.getHourlyTraffic();
      set({ hourlyData: data });
    } catch { set({ hourlyData: [] }); }
  },
  fetchDistrictData: async () => {
    try {
      const data = await dashboardService.getDistrictCongestion();
      set({ districtData: data });
    } catch { set({ districtData: [] }); }
  },
  fetchRoadSegments: async () => {
    try {
      const data = await dashboardService.getRoadSegments();
      set({ roadSegments: data });
    } catch { set({ roadSegments: [] }); }
  },
  fetchAiAlerts: async () => {
    try {
      const data = await dashboardService.getAiAlerts();
      set({ aiAlerts: data });
    } catch { set({ aiAlerts: [] }); }
  },
  fetchAll: async () => {
    set({ loading: true });
    const [metrics, hourlyData, districtData, roadSegments, aiAlerts] = await Promise.all([
      dashboardService.getMetrics().catch(() => null),
      dashboardService.getHourlyTraffic().catch(() => []),
      dashboardService.getDistrictCongestion().catch(() => []),
      dashboardService.getRoadSegments().catch(() => []),
      dashboardService.getAiAlerts().catch(() => []),
    ]);
    set({ metrics, hourlyData, districtData, roadSegments, aiAlerts, loading: false });
  },
  tick: () => { void dashboardService.getMetrics().then(metrics => set({ metrics })).catch(() => undefined); },
}));

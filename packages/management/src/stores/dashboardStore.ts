import { create } from 'zustand';
import type { HourlyMetrics, AiAlert } from '../mocks/mockData';
import type { DistrictCongestionData, RealTimeMetrics } from '../services/dashboardService';
import { dashboardService } from '../services/dashboardService';
import { generateRoadSegments, generateDistrictCongestion, generateRealTimeMetrics, generateAiAlerts, generateHourlyMetrics } from '../mocks/mockData';
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
    } catch {
      // fallback to direct mock
      set({ metrics: generateRealTimeMetrics() });
    }
  },
  fetchHourlyData: async () => {
    try {
      const data = await dashboardService.getHourlyTraffic();
      set({ hourlyData: data });
    } catch {
      set({ hourlyData: generateHourlyMetrics() });
    }
  },
  fetchDistrictData: async () => {
    try {
      const data = await dashboardService.getDistrictCongestion();
      set({ districtData: data });
    } catch {
      set({ districtData: generateDistrictCongestion() });
    }
  },
  fetchRoadSegments: async () => {
    try {
      const data = await dashboardService.getRoadSegments();
      set({ roadSegments: data });
    } catch {
      set({ roadSegments: generateRoadSegments() });
    }
  },
  fetchAiAlerts: async () => {
    try {
      const data = await dashboardService.getAiAlerts();
      set({ aiAlerts: data });
    } catch {
      set({ aiAlerts: generateAiAlerts() });
    }
  },
  fetchAll: async () => {
    set({ loading: true });
    set({
      metrics: generateRealTimeMetrics(),
      hourlyData: generateHourlyMetrics(),
      districtData: generateDistrictCongestion(),
      roadSegments: generateRoadSegments(),
      aiAlerts: generateAiAlerts(),
      loading: false,
    });
  },
  tick: () => {
    set((state) => {
      if (!state.metrics) return state;
      const variation = () => Math.floor(Math.random() * 200 - 100);
      return {
        metrics: {
          ...state.metrics,
          timestamp: Date.now(),
          activeVehicles: state.metrics.activeVehicles + variation(),
          avgSpeed: Math.round((state.metrics.avgSpeed + (Math.random() - 0.5) * 2) * 10) / 10,
          congestionIndex: Math.round((state.metrics.congestionIndex + (Math.random() - 0.5) * 0.3) * 10) / 10,
        },
      };
    });
  },
}));

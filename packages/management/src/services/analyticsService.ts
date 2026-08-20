import { apiGet } from './apiClient';

export interface AnalyticsTrendPoint {
  date: string;
  total: number;
  resolved: number;
}

export interface AnalyticsDistributionItem {
  name: string;
  value: number;
}

export interface AnalyticsSummary {
  totalIncidents: number;
  avgResponseTime: number;
  resolutionRate: number;
  citizenSatisfaction: number;
}

export const analyticsService = {
  getTrend: (params?: Record<string, string>) =>
    apiGet<AnalyticsTrendPoint[]>('/analytics/incident-trend', params),
  getCategoryDistribution: (params?: Record<string, string>) =>
    apiGet<AnalyticsDistributionItem[]>('/analytics/category-distribution', params),
  getSummary: (params?: Record<string, string>) =>
    apiGet<AnalyticsSummary>('/analytics/summary', params),
};

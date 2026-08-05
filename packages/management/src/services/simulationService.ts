import { apiGet, apiPost } from './apiClient';
import type { MockScenario } from '../mocks/mockData';

export interface SimulationResults {
  avgSpeedImprovement: number;
  travelTimeReduction: number;
  queueLengthReduction: number;
  congestionIndexChange: number;
  fuelSaving: string;
}

export const simulationService = {
  getScenarios: () => apiGet<MockScenario[]>('/simulation/scenarios'),
  start: (scenarioId: string, params?: Record<string, unknown>) =>
    apiPost<{ success: boolean; sessionId: string }>('/simulation/start', { scenarioId, ...params }),
  stop: () => apiPost<{ success: boolean }>('/simulation/stop'),
  pause: () => apiPost<{ success: boolean }>('/simulation/pause'),
  getResults: (sessionId: string) =>
    apiGet<SimulationResults>(`/simulation/results/${sessionId}`),
};

import { apiGet, apiPut } from './apiClient';
import type { MockIntersection } from '../mocks/mockData';

export interface SignalPhase {
  id: string;
  intersectionId: string;
  phaseNo: number;
  direction: string;
  greenTime: number;
  yellowTime: number;
  redTime: number;
  minGreen: number;
  maxGreen: number;
}

export interface IntersectionDetail extends MockIntersection {
  phases: SignalPhase[];
}

export const signalService = {
  getList: () => apiGet<MockIntersection[]>('/signals'),
  getById: (id: string) => apiGet<IntersectionDetail>(`/signals/${id}`),
  updatePhases: (id: string, phases: SignalPhase[]) =>
    apiPut<{ success: boolean }>(`/signals/${id}`, { phases }),
};

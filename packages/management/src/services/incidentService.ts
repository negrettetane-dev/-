import { apiGet, apiPut } from './apiClient';
import type { MockIncident } from '../mocks/mockData';
import type { PaginatedResponse } from '@zhitu/shared';

export const incidentService = {
  getList: (params?: Record<string, unknown>) =>
    apiGet<PaginatedResponse<MockIncident>>('/incidents', params),
  getById: (id: string) => apiGet<MockIncident>(`/incidents/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    apiPut<{ success: boolean }>(`/incidents/${id}`, data),
};

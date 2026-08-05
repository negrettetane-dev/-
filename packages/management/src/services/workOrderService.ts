import { apiGet, apiPut } from './apiClient';
import type { MockWorkOrder } from '../mocks/mockData';
import type { PaginatedResponse } from '@zhitu/shared';

export const workOrderService = {
  getList: (params?: Record<string, unknown>) =>
    apiGet<PaginatedResponse<MockWorkOrder>>('/workorders', params),
  getById: (id: string) => apiGet<MockWorkOrder>(`/workorders/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    apiPut<{ success: boolean }>(`/workorders/${id}`, data),
};

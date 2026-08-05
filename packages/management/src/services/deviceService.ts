import { apiGet } from './apiClient';
import type { MockDevice } from '../mocks/mockData';
import type { PaginatedResponse } from '@zhitu/shared';

export const deviceService = {
  getList: (params?: Record<string, unknown>) =>
    apiGet<PaginatedResponse<MockDevice>>('/devices', params),
  getById: (id: string) => apiGet<MockDevice>(`/devices/${id}`),
};

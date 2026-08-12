import { apiGet, apiPut } from './apiClient';
import type { MockIncident } from '../mocks/mockData';
import type { PaginatedResponse } from '@zhitu/shared';

export const incidentService = {
  getList: async (params?: Record<string, unknown>) => {
    const data = await apiGet<PaginatedResponse<{
      id: string; title: string; description: string; roadName: string;
      severity: string; status: string; reportedAt: string; reportedBy: string;
    }>>('/incidents', params);
    return {
      ...data,
      list: data.list.map((item): MockIncident => ({
        id: item.id,
        source: 'citizen_report',
        type: item.title,
        title: item.title,
        description: item.description,
        position: [0, 0],
        roadName: item.roadName,
        severity: item.severity === 'high' ? 'critical' : item.severity === 'low' ? 'normal' : 'serious',
        status: item.status === 'pending' ? 'new' : item.status as MockIncident['status'],
        assignedTo: item.reportedBy,
        createTime: Date.parse(item.reportedAt) || Date.now(),
        images: [],
      })),
    };
  },
  getById: async (id: string): Promise<MockIncident> => {
    const item = await apiGet<Record<string, unknown>>(`/incidents/${id}`);
    return {
      id: String(item.id || id), source: 'citizen_report' as const, type: String(item.title || ''),
      title: String(item.title || ''), description: String(item.description || ''),
      position: Array.isArray(item.position) ? item.position as [number, number] : [0, 0],
      roadName: String(item.roadName || ''),
      severity: item.severity === 'high' ? 'critical' : item.severity === 'low' ? 'normal' : 'serious',
      status: item.status === 'pending' ? 'new' : String(item.status || 'new') as MockIncident['status'],
      assignedTo: String(item.reportedBy || ''),
      createTime: Date.parse(String(item.reportedAt || '')) || Date.now(),
      images: Array.isArray(item.images) ? item.images as string[] : [],
    };
  },
  update: (id: string, data: Record<string, unknown>) =>
    apiPut<{ success: boolean }>(`/incidents/${id}`, data),
};

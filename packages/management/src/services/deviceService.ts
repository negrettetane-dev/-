import { apiGet } from './apiClient';
import type { MockDevice } from '../mocks/mockData';
import type { PaginatedResponse } from '@zhitu/shared';

export const deviceService = {
  getList: async (params?: Record<string, unknown>) => {
    const data = await apiGet<PaginatedResponse<Record<string, unknown>>>('/devices', params);
    return { ...data, list: data.list.map(normalizeDevice) };
  },
  getById: async (id: string) => normalizeDevice(await apiGet<Record<string, unknown>>(`/devices/${id}`)),
};

function normalizeDevice(item: Record<string, unknown>): MockDevice {
  const position = Array.isArray(item.position) ? item.position : Array.isArray(item.coordinates) ? item.coordinates : [0, 0];
  return {
    id:String(item.id || ''),
    type:String(item.type || 'camera') as MockDevice['type'],
    name:String(item.name || item.id || ''),
    position:position as [number, number],
    roadName:String(item.roadName || item.address || ''),
    status:String(item.status || 'offline') as MockDevice['status'],
    lastHeartbeat:Number(item.lastHeartbeat || item.updatedAt || 0),
    uptime:Number(item.uptime || 0),
    installDate:item.installDate ? Number(item.installDate) : undefined,
    model:item.model ? String(item.model) : undefined,
  };
}

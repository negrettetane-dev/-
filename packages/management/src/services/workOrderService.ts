import { apiGet, apiPut } from './apiClient';
import type { MockWorkOrder } from '../mocks/mockData';
import type { PaginatedResponse } from '@zhitu/shared';

export const workOrderService = {
  getList: async (params?: Record<string, unknown>) => {
    const data = await apiGet<PaginatedResponse<Record<string, unknown>>>('/workorders', params);
    return { ...data, list: data.list.map(normalizeWorkOrder) };
  },
  getById: async (id: string) => normalizeWorkOrder(await apiGet<Record<string, unknown>>(`/workorders/${id}`)),
  update: (id: string, data: Record<string, unknown>) =>
    apiPut<{ success: boolean }>(`/workorders/${id}`, data),
};

function normalizeWorkOrder(item: Record<string, unknown>): MockWorkOrder {
  const rawStatus = String(item.status || 'pending');
  const status = rawStatus === 'resolved' ? 'completed' : rawStatus === 'closed' ? 'rejected' : rawStatus;
  return {
    id:String(item.id || ''),
    workOrderNo:String(item.workOrderNo || item.orderNo || item.id || ''),
    category:String(item.category || item.type || 'other'),
    description:String(item.description || ''),
    images:Array.isArray(item.images) ? item.images as string[] : [],
    position:(Array.isArray(item.position) ? item.position : [0, 0]) as [number, number],
    address:String(item.address || item.roadName || ''),
    contactPhone:item.contactPhone ? String(item.contactPhone) : undefined,
    status:status as MockWorkOrder['status'],
    createTime:Number(item.createTime || Date.parse(String(item.createdAt || item.reportedAt || '')) || 0),
    updateTime:Number(item.updateTime || Date.parse(String(item.updatedAt || '')) || 0),
    processLogs:Array.isArray(item.processLogs) ? item.processLogs as MockWorkOrder['processLogs'] : [],
    reporterName:item.reporterName ? String(item.reporterName) : item.reportedBy ? String(item.reportedBy) : undefined,
    rating:item.rating ? Number(item.rating) : undefined,
  };
}

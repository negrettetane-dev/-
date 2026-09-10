import { apiGet, apiPut, apiPost } from './apiClient';
import type { MockWorkOrder } from '../mocks/mockData';
import type { PaginatedResponse } from '@zhitu/shared';

export const workOrderService = {
  getList: async (params?: Record<string, unknown>) => {
    const data = await apiGet<PaginatedResponse<Record<string, unknown>>>('/workorders', params);
    return { ...data, list: data.list.map(normalizeWorkOrder) };
  },
  getById: async (id: string) => normalizeWorkOrder(await apiGet<Record<string, unknown>>(`/workorders/${id}`)),
  update: async (id: string, data: Record<string, unknown>) => {
    const result = await apiPut<{ success: boolean }>(`/workorders/${id}`, data);
    // 通知创建必须由后端在事件状态更新事务中完成；此调用兼容当前演示环境。
    try { await apiPost('/notifications', { event: 'event.status_updated', eventId: id, status: data.status, note: data.note }); } catch { /* 旧后端未提供通知接口时不阻断事件状态更新 */ }
    return result;
  },
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

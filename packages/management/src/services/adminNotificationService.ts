import { apiGet, apiPost } from './apiClient';

// ===== 管理端通知中心服务 =====
// 通知类型：event（新事件）、user（新用户）、stock（兑换商品库存预警）

export type AdminNotificationType = 'event' | 'user' | 'stock';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  content: string;
  relatedId?: string;
  read: boolean;
  createdAt: number | string;
}

interface NotificationListResponse {
  list: AdminNotification[];
  unreadCount: number;
  total: number;
}

export const adminNotificationService = {
  list: (params?: { unreadOnly?: boolean }): Promise<NotificationListResponse> =>
    apiGet<NotificationListResponse>('/notifications', params),

  unreadCount: (): Promise<{ count: number }> =>
    apiGet<{ count: number }>('/notifications/unread-count'),

  markRead: (ids: string[]): Promise<{ success: boolean }> =>
    apiPost<{ success: boolean }>('/notifications/read', { ids }),

  markAllRead: (): Promise<{ success: boolean }> =>
    apiPost<{ success: boolean }>('/notifications/read', { ids: [] }),
};

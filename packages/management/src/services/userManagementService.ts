import { apiGet, apiPost } from './apiClient';

export interface CitizenUser {
  id: string;
  username: string;
  nickname?: string;
  phone?: string;
  email?: string;
  isVerified: boolean;
  carbonCredits: number;
  createdAt: number | string;
}

export interface PointTransaction {
  id: string;
  userId: string;
  type: 'earn' | 'redeem' | 'adjust';
  amount: number;
  reason: string;
  operator: string;
  time: number | string;
}

interface CitizenUserPage {
  list: CitizenUser[];
  total: number;
  page: number;
  pageSize: number;
}

export const userManagementService = {
  list: (params: { page: number; pageSize: number; search?: string }): Promise<CitizenUserPage> =>
    apiGet<CitizenUserPage>('/users', params),

  pointTransactions: (userId: string): Promise<{ list: PointTransaction[] }> =>
    apiGet<{ list: PointTransaction[] }>(`/users/${userId}/point-transactions`),

  adjustPoints: (userId: string, amount: number, reason: string): Promise<{ success: boolean; balance?: number }> =>
    apiPost<{ success: boolean; balance?: number }>(`/users/${userId}/points`, { amount, reason }),
};

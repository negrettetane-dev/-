import { apiGet, apiPut } from './apiClient';
import type { CarbonReward } from '../stores/adminPersistence';

export interface CarbonRewardPage {
  list?: CarbonReward[];
  items?: CarbonReward[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export function normalizeCarbonRewards(data: unknown): CarbonReward[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const page = data as CarbonRewardPage;
  if (Array.isArray(page.list)) return page.list;
  if (Array.isArray(page.items)) return page.items;
  return [];
}

export const carbonRewardService = {
  list: async (): Promise<CarbonReward[]> => {
    const data = await apiGet<CarbonReward[] | CarbonRewardPage>('/carbon/rewards', { page: 1, pageSize: 100 });
    return normalizeCarbonRewards(data);
  },
  replace: (rewards: CarbonReward[]) => apiPut<CarbonReward[]>('/carbon/rewards', { rewards }),
};

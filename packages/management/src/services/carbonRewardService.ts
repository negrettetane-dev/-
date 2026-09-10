import { apiGet, apiPut } from './apiClient';
import type { CarbonReward } from '../stores/adminPersistence';
export const carbonRewardService = { list: () => apiGet<CarbonReward[]>('/carbon/rewards'), replace: (rewards: CarbonReward[]) => apiPut<CarbonReward[]>('/carbon/rewards', { rewards }) };

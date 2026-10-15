import type { RedemptionRecord } from '../stores/persistence';

interface RewardReference {
  id: string | number;
  name: string;
  cost: number;
}

function firstValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

export function addTwoMonths(value: string | number | Date): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const result = new Date(date);
  const originalDate = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + 2);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDate, lastDay));
  return result.toISOString();
}

function toIsoString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeRedemptions(rows: unknown, rewards: RewardReference[] = []): RedemptionRecord[] {
  if (!Array.isArray(rows)) return [];
  const rewardMap = new Map(rewards.map(reward => [String(reward.id), reward]));

  return rows.map((item, index) => {
    const record = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const rewardId = firstValue(record, ['reward_id', 'rewardId', 'product_id', 'productId']) ?? '';
    const reward = rewardMap.get(String(rewardId));
    const redeemedAtValue = firstValue(record, ['redeemed_at', 'redeemedAt', 'created_at', 'createdAt', 'time']);
    const redeemedAt = toIsoString(redeemedAtValue);
    const expiresAtValue = firstValue(record, ['expires_at', 'expiresAt', 'expire_at', 'expireAt', 'valid_until', 'validUntil']);
    const expiresAt = toIsoString(expiresAtValue);

    return {
      id: String(firstValue(record, ['id', 'redemption_id', 'redemptionId']) ?? `redemption-${index}`),
      user_id: String(firstValue(record, ['user_id', 'userId']) ?? ''),
      reward_id: rewardId as string | number,
      reward_name: String(firstValue(record, ['reward_name', 'rewardName', 'product_name', 'productName', 'name']) ?? reward?.name ?? '兑换商品信息缺失'),
      points_cost: Number(firstValue(record, ['points_cost', 'pointsCost', 'cost', 'points']) ?? reward?.cost ?? 0),
      status: String(firstValue(record, ['status', 'use_status', 'useStatus']) ?? 'unused'),
      redeemed_at: redeemedAt,
      expires_at: expiresAt ?? (redeemedAt ? addTwoMonths(redeemedAt) : null),
    };
  });
}

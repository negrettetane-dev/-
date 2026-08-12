// ===== 智途云枢 · 兑换记录 状态与日期 规范化工具 =====
// 用于市民端 / 管理端统一处理兑换记录状态枚举和日期显示。

// ====== 状态规范化 ======

export type RedemptionStatusValue =
  | 'unused'
  | 'used'
  | 'expired'
  | '未使用'
  | '已使用'
  | '已过期'
  | string;

export type NormalizedRedemptionStatus =
  | 'unused'
  | 'used'
  | 'expired'
  | 'unknown';

/** 将后端状态（英文或中文）规范化为内部枚举 */
export function normalizeRedemptionStatus(value: unknown): NormalizedRedemptionStatus {
  const status = String(value ?? '').trim().toLowerCase();

  if (status === 'unused' || status === '未使用') return 'unused';
  if (status === 'used' || status === '已使用') return 'used';
  if (status === 'expired' || status === '已过期') return 'expired';

  return 'unknown';
}

/** 状态显示标签 */
export const REDEMPTION_STATUS_META: Record<NormalizedRedemptionStatus, { label: string }> = {
  unused: { label: '📌 未使用' },
  used: { label: '✅ 已使用' },
  expired: { label: '⏰ 已过期' },
  unknown: { label: '⚠️ 状态未知' },
};

// ====== 日期校验 ======

export function isValidDateValue(value: unknown): value is string | number | Date {
  if (value === null || value === undefined || value === '') return false;
  const date = new Date(value as string | number | Date);
  return !Number.isNaN(date.getTime());
}

/** 安全格式化：null/空/非法 → fallback */
export function formatDateSafe(value: unknown, fallback = '日期未知'): string {
  if (!isValidDateValue(value)) return fallback;
  return new Date(value as string | number | Date).toLocaleDateString('zh-CN');
}

/** 有效期显示：空 → 长期有效；非法 → 有效期信息异常；合法 → 日期 */
export function formatExpiryDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '长期有效';
  if (!isValidDateValue(value)) return '有效期信息异常';
  return new Date(value as string | number | Date).toLocaleDateString('zh-CN');
}

// ====== 状态 + 过期联合判断 ======

/**
 * 后端 status 是主要依据；只有后端状态不可识别时，
 * 才允许用合法 expires_at 辅助判断过期。
 */
export function resolveRedemptionStatus(
  status: unknown,
  expiresAt: unknown,
  now = Date.now(),
): NormalizedRedemptionStatus {
  const normalized = normalizeRedemptionStatus(status);
  if (normalized !== 'unknown') return normalized;

  if (isValidDateValue(expiresAt) && new Date(expiresAt as string | number | Date).getTime() < now) {
    return 'expired';
  }

  return 'unknown';
}

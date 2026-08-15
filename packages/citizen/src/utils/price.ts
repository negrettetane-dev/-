// ===== 智途云枢 · 价格格式化 =====
// 根据 amount + currency + unit 生成中文展示文本。
// 兼容历史字符串价格（如 "8元/小时"）直接透传，不报错、不丢失。

import type { PriceValue } from '../types/price';

/** 单位 → 中文后缀 */
const UNIT_LABEL: Record<string, string> = {
  CNY_PER_KWH: '元/度',
  CNY_PER_HOUR: '元/小时',
  CNY_PER_MINUTE: '元/分钟',
  CNY_PER_TIME: '元/次',
  FREE: '免费',
};

export function formatPrice(price: PriceValue): string {
  if (price == null) return '价格待定';
  // 兼容旧的字符串价格（历史数据 / 未迁移字段）
  if (typeof price === 'string') {
    const s = price.trim();
    return s || '价格待定';
  }
  if (price.unit === 'FREE' || Number(price.amount) === 0) return '免费';
  const amount = Number(price.amount);
  const amountStr = Number.isFinite(amount) ? String(amount) : '0';
  const unit = UNIT_LABEL[price.unit];
  return unit ? `${amountStr} ${unit}` : `${amountStr} 元`;
}

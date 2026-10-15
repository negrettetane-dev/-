// ===== 智途云枢 · 结构化价格类型 =====
// 停车/充电价格不再用 "1.2元/度" 这种拼接字符串，统一为结构化对象。
// 后端返回 { amount, currency, unit }，前端根据 amount + currency + unit 显示中文。

export type PriceUnit =
  | 'CNY_PER_KWH'
  | 'CNY_PER_HOUR'
  | 'CNY_PER_MINUTE'
  | 'CNY_PER_TIME'
  | 'FREE'
  | string;

export interface Price {
  amount: number;
  currency: string; // 货币代码，如 CNY
  unit: PriceUnit;
}

/** 兼容：后端可能返回结构化 Price，或历史数据仍为拼接字符串 */
export type PriceValue = Price | string | null | undefined;

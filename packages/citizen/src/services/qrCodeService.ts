// ===== 智途云枢 · 统一乘车码服务 =====
// 公交码 / 地铁码完全独立，内容不同，仅用于演示。

export type TransitQrMode = 'bus' | 'metro';

export interface QrState {
  content: string;
  expiresAt: number; // 时间戳(ms)
  isDemo: true;
}

const VALIDITY_MS = 60 * 1000; // 60 秒有效期

/** 生成指定模式的演示乘车码（公交/地铁内容互不相同） */
export function generateTransitQr(mode: TransitQrMode, userId: string, now: number = Date.now()): QrState {
  const prefix = mode === 'bus' ? 'ZHITU-DEMO-BUS' : 'ZHITU-DEMO-METRO';
  return {
    content: `${prefix}-${userId}-${now}`,
    expiresAt: now + VALIDITY_MS,
    isDemo: true,
  };
}

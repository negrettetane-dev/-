// ===== 智途云枢 · 乘车码服务 =====
// 公交码 / 地铁码完全独立，内容不同，仅用于演示。

export type QrMode = 'bus' | 'metro';

export interface QrState {
  content: string;
  expiresAt: number; // 时间戳(ms)
  isDemo: true;
}

const VALIDITY_MS = 60 * 1000; // 60 秒有效期

function generateQrContent(mode: QrMode, userId: string, ts: number): string {
  const prefix = mode === 'bus' ? 'ZHITU-DEMO-BUS' : 'ZHITU-DEMO-METRO';
  return `${prefix}-${userId}-${ts}`;
}

/** 生成指定模式的演示乘车码（内容与模式强相关，公交/地铁互不相同） */
export function generateQr(mode: QrMode, userId: string = 'u1', now: number = Date.now()): QrState {
  return {
    content: generateQrContent(mode, userId, now),
    expiresAt: now + VALIDITY_MS,
    isDemo: true,
  };
}

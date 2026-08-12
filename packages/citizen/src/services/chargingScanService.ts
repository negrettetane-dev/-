// ===== 智途云枢 · 扫码充电（演示）服务 =====
// 本阶段仅生成演示充电二维码，未连接真实充电运营平台，不会启动实体充电。

export interface ChargingDemoQrState {
  content: string;
  expiresAt: number;
  isDemo: true;
}

const VALIDITY_MS = 60 * 1000; // 60 秒

/** 生成充电演示二维码（内容与站点/桩/枪强相关，独立于乘车码） */
export function generateChargingDemoQr(
  stationId = 'UNKNOWN',
  pileCode = 'DEMO-PILE',
  gunCode = 'GUN-01',
  now: number = Date.now(),
): ChargingDemoQrState {
  return {
    content: `ZHITU-DEMO-CHARGING-${stationId}-${pileCode}-${gunCode}-${now}`,
    expiresAt: now + VALIDITY_MS,
    isDemo: true,
  };
}

import type { Price } from '../types/price';

export type ChargingDeviceStatus = 'available' | 'occupied' | 'offline' | 'fault';

export interface ChargingQrPayload {
  schema: 'zhitu.charging.v1';
  stationId: string;
  pileCode: string;
  gunCode: string;
  status: ChargingDeviceStatus;
  powerKw: number;
  price: Price;
  issuedAt?: string;
  expiresAt?: string;
  isDemo?: boolean;
}

export type ChargingQrParseErrorCode =
  | 'EMPTY_CONTENT'
  | 'INVALID_JSON'
  | 'INVALID_SCHEMA'
  | 'MISSING_FIELD'
  | 'INVALID_FIELD'
  | 'EXPIRED';

export class ChargingQrParseError extends Error {
  constructor(public readonly code: ChargingQrParseErrorCode, message: string) {
    super(message);
    this.name = 'ChargingQrParseError';
  }
}

const statuses: ChargingDeviceStatus[] = ['available', 'occupied', 'offline', 'fault'];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const requiredText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ChargingQrParseError('MISSING_FIELD', `二维码缺少有效的${field}`);
  }
  return value.trim();
};

const optionalDate = (value: unknown, field: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ChargingQrParseError('INVALID_FIELD', `${field}格式不正确`);
  }
  return value;
};

export function parseChargingQrContent(content: string, now = Date.now()): ChargingQrPayload {
  if (!content.trim()) throw new ChargingQrParseError('EMPTY_CONTENT', '二维码内容为空');

  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new ChargingQrParseError('INVALID_JSON', '二维码内容不是有效的设备数据');
  }
  if (!isRecord(value)) throw new ChargingQrParseError('INVALID_JSON', '二维码内容格式不正确');
  if (value.schema !== 'zhitu.charging.v1') {
    throw new ChargingQrParseError('INVALID_SCHEMA', '不支持的充电设备二维码格式');
  }

  const stationId = requiredText(value.stationId, '充电站编号');
  const pileCode = requiredText(value.pileCode, '充电桩编号');
  const gunCode = requiredText(value.gunCode, '充电枪编号');
  if (typeof value.status !== 'string' || !statuses.includes(value.status as ChargingDeviceStatus)) {
    throw new ChargingQrParseError('INVALID_FIELD', '充电枪状态不正确');
  }
  if (typeof value.powerKw !== 'number' || !Number.isFinite(value.powerKw) || value.powerKw < 0) {
    throw new ChargingQrParseError('INVALID_FIELD', '充电功率不正确');
  }
  if (!isRecord(value.price) || typeof value.price.amount !== 'number' || !Number.isFinite(value.price.amount) || value.price.amount < 0) {
    throw new ChargingQrParseError('INVALID_FIELD', '充电价格不正确');
  }
  const currency = requiredText(value.price.currency, '价格货币');
  const unit = requiredText(value.price.unit, '价格单位');
  const issuedAt = optionalDate(value.issuedAt, '二维码生成时间');
  const expiresAt = optionalDate(value.expiresAt, '二维码有效期');
  if (expiresAt && Date.parse(expiresAt) <= now) {
    throw new ChargingQrParseError('EXPIRED', '二维码已过期，请重新选择');
  }

  return {
    schema: 'zhitu.charging.v1',
    stationId,
    pileCode,
    gunCode,
    status: value.status as ChargingDeviceStatus,
    powerKw: value.powerKw,
    price: { amount: value.price.amount, currency, unit },
    ...(issuedAt ? { issuedAt } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(typeof value.isDemo === 'boolean' ? { isDemo: value.isDemo } : {}),
  };
}

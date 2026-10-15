// ===== 智途云枢 · 长途客运班次查询服务 =====
// 数据真实性边界：
//   - 后端优先：调 /api/long-distance/* 获取真实班次/库存/购票深链。
//   - 后端不可用（未接入/网络异常）时降级本地演示班次，并明确标注 source: 'demo'。
//   - 余票/价格/停售状态：查询时按班次「刷新」，不长期固定——避免「页面余 32 张，跳转后无票」。
//   - 购票链接不固定长期保存：点击购买时由后端即时生成（带班次+日期+库存校验）。
//   - 智能推荐可解释、可降级：缺实时交通/天气时退化为按距离+发车时间+余票排序。

import { apiGet, apiPost, ApiError } from './apiClient';
import { isValidCoord } from './locationService';
import type { LongDistancePurchase, CreateLongDistancePurchaseRequest } from '@zhitu/shared';

export interface BusSchedule {
  id: string;
  provider: 'e2go' | 'ctrip' | 'qunar';
  providerName: string;
  originCity: string;
  originStation: string;
  destinationCity: string;
  destinationStation: string;
  /** HH:mm */
  departureTime: string;
  /** HH:mm */
  arrivalTime: string;
  /** 演示票价基准（元）；实际以查询时刷新为准 */
  basePrice: number;
  /** 演示座位基准 */
  baseTickets: number;
  /** 运行天数：0-6 对应周日-周六；空=每天 */
  runDays?: number[];
}

export interface ScheduleInventory {
  price: number;
  remainingTickets: number;
  saleStatus: 'on_sale' | 'almost_sold' | 'sold_out';
  /** 库存刷新时间 */
  refreshedAt: string;
}

export interface QueryResult {
  schedule: BusSchedule;
  inventory: ScheduleInventory;
  /** 距用户位置（km，有坐标时） */
  distanceKm?: number;
}

export interface Recommendation {
  schedule: BusSchedule;
  inventory: ScheduleInventory;
  reasons: string[];
}

/** 购票深链（后端即时生成） */
export interface PurchaseLink {
  purchaseUrl: string;
  expiresIn: number;
  providerName?: string;
}

/** 数据来源标注 */
export type DataSource = 'backend' | 'demo';

// ===== 后端接口契约（对齐后端：/api/long-distance/*） =====
interface ApiSchedule {
  id: string;
  provider?: string;
  providerName?: string;
  originCity?: string;
  originStation?: string;
  destinationCity?: string;
  destinationStation?: string;
  departureTime?: string;
  arrivalTime?: string;
  runDays?: number[];
  inventory?: Partial<ScheduleInventory>;
}

/** 后端返回的班次字段可能缺失 → 归一化到前端模型 */
function normalizeApiSchedule(raw: ApiSchedule): BusSchedule {
  return {
    id: String(raw.id || ''),
    provider: (raw.provider as BusSchedule['provider']) || 'e2go',
    providerName: String(raw.providerName || raw.provider || '合作平台'),
    originCity: String(raw.originCity || ''),
    originStation: String(raw.originStation || ''),
    destinationCity: String(raw.destinationCity || ''),
    destinationStation: String(raw.destinationStation || ''),
    departureTime: String(raw.departureTime || ''),
    arrivalTime: String(raw.arrivalTime || ''),
    basePrice: Number(raw.inventory?.price ?? 0),
    baseTickets: Number(raw.inventory?.remainingTickets ?? 0),
    runDays: Array.isArray(raw.runDays) ? raw.runDays : [],
  };
}

function normalizeInventory(raw?: Partial<ScheduleInventory>): ScheduleInventory {
  return {
    price: Number(raw?.price ?? 0),
    remainingTickets: Number(raw?.remainingTickets ?? 0),
    saleStatus: raw?.saleStatus || (Number(raw?.remainingTickets ?? 0) <= 0 ? 'sold_out' : 'on_sale'),
    refreshedAt: String(raw?.refreshedAt || new Date().toISOString()),
  };
}

// ===== 本地演示数据（降级用） =====
const SCHEDULES: BusSchedule[] = [
  { id: 'cs-wh-0830', provider: 'e2go', providerName: 'e2Go', originCity: '长沙', originStation: '长沙汽车西站', destinationCity: '武汉', destinationStation: '武汉宏基客运站', departureTime: '08:30', arrivalTime: '11:50', basePrice: 120, baseTickets: 32, runDays: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'cs-wh-1320', provider: 'ctrip', providerName: '携程汽车票', originCity: '长沙', originStation: '长沙汽车南站', destinationCity: '武汉', destinationStation: '武汉宏基客运站', departureTime: '13:20', arrivalTime: '16:35', basePrice: 118, baseTickets: 5, runDays: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'cs-yy-0920', provider: 'qunar', providerName: '去哪儿', originCity: '长沙', originStation: '长沙汽车东站', destinationCity: '岳阳', destinationStation: '岳阳汽车站', departureTime: '09:20', arrivalTime: '11:05', basePrice: 55, baseTickets: 18, runDays: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'cs-yy-1520', provider: 'e2go', providerName: 'e2Go', originCity: '长沙', originStation: '长沙汽车西站', destinationCity: '岳阳', destinationStation: '岳阳汽车站', departureTime: '15:20', arrivalTime: '17:05', basePrice: 58, baseTickets: 24, runDays: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'cs-zz-0730', provider: 'ctrip', providerName: '携程汽车票', originCity: '长沙', originStation: '长沙汽车西站', destinationCity: '株洲', destinationStation: '株洲中心站', departureTime: '07:30', arrivalTime: '08:50', basePrice: 32, baseTickets: 40, runDays: [1, 2, 3, 4, 5, 6] },
  { id: 'cs-zz-1030', provider: 'qunar', providerName: '去哪儿', originCity: '长沙', originStation: '长沙汽车南站', destinationCity: '株洲', destinationStation: '株洲中心站', departureTime: '10:30', arrivalTime: '11:50', basePrice: 30, baseTickets: 12, runDays: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'wh-hf-0930', provider: 'e2go', providerName: 'e2Go', originCity: '武汉', originStation: '武汉宏基客运站', destinationCity: '合肥', destinationStation: '合肥汽车站', departureTime: '09:30', arrivalTime: '12:45', basePrice: 135, baseTickets: 28, runDays: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'wh-xy-1140', provider: 'ctrip', providerName: '携程汽车票', originCity: '武汉', originStation: '武汉宏基客运站', destinationCity: '襄阳', destinationStation: '襄阳汽车站', departureTime: '11:40', arrivalTime: '15:10', basePrice: 98, baseTickets: 8, runDays: [0, 2, 4, 6] },
];

/** 演示站点坐标（GCJ-02，用于距离推荐；缺坐标时降级） */
export const STATION_COORDS: Record<string, { lng: number; lat: number }> = {
  '长沙汽车西站': { lng: 112.902, lat: 28.205 },
  '长沙汽车南站': { lng: 113.020, lat: 28.077 },
  '长沙汽车东站': { lng: 113.028, lat: 28.197 },
  '武汉宏基客运站': { lng: 114.320, lat: 30.528 },
  '武汉汉口汽车站': { lng: 114.253, lat: 30.620 },
  '岳阳汽车站': { lng: 113.129, lat: 29.358 },
  '株洲中心站': { lng: 113.134, lat: 27.827 },
  '合肥汽车站': { lng: 117.283, lat: 31.861 },
  '襄阳汽车站': { lng: 112.142, lat: 32.009 },
};

function haversineKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function hashStr(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 本地降级库存刷新（模拟合作平台实时库存） */
export function refreshInventoryLocal(schedule: BusSchedule, date: string, querySeq: number): ScheduleInventory {
  const seed = `${schedule.id}:${date}:${querySeq}`;
  const variation = (hashStr(seed) % 7) - 3; // -3 ~ +3
  const remaining = Math.max(0, schedule.baseTickets + variation);
  const priceJitter = (hashStr(`${seed}:price`) % 3) - 1;
  const price = Math.max(1, schedule.basePrice + priceJitter);
  const saleStatus = remaining <= 0 ? 'sold_out' : remaining <= 5 ? 'almost_sold' : 'on_sale';
  return { price, remainingTickets: remaining, saleStatus, refreshedAt: new Date().toISOString() };
}

function stationDistance(station: string, userLng?: number, userLat?: number): number | undefined {
  if (userLng == null || userLat == null) return undefined;
  if (!isValidCoord(userLng, userLat)) return undefined;
  const coord = STATION_COORDS[station];
  if (!coord) return undefined;
  return haversineKm(coord, { lng: userLng, lat: userLat });
}

function sortResults(results: QueryResult[]): QueryResult[] {
  return [...results].sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null && Math.abs(a.distanceKm - b.distanceKm) > 0.5) {
      return a.distanceKm - b.distanceKm;
    }
    return a.schedule.departureTime.localeCompare(b.schedule.departureTime);
  });
}

/** 本地降级查询（演示数据） */
export function querySchedulesLocal(
  origin: string,
  destination: string,
  date: string,
  querySeq: number,
  userLng?: number,
  userLat?: number,
): QueryResult[] {
  const o = origin.trim();
  const d = destination.trim();
  if (!o || !d) return [];
  const matches = SCHEDULES.filter(s =>
    (s.originCity.includes(o) || o.includes(s.originCity) || s.originStation.includes(o)) &&
    (s.destinationCity.includes(d) || d.includes(s.destinationCity) || s.destinationStation.includes(d)),
  );
  const results = matches.map(schedule => {
    const inventory = refreshInventoryLocal(schedule, date, querySeq);
    const distanceKm = stationDistance(schedule.originStation, userLng, userLat);
    return { schedule, inventory, distanceKm };
  });
  return sortResults(results);
}

/** 智能推荐（本地降级：可解释、可降级，不伪装实时事实） */
export function recommendSchedules(
  results: QueryResult[],
  userLng?: number,
  userLat?: number,
): Recommendation[] {
  if (results.length === 0) return [];
  const sorted = [...results].sort((a, b) => {
    const aSold = a.inventory.saleStatus === 'sold_out' ? 1 : 0;
    const bSold = b.inventory.saleStatus === 'sold_out' ? 1 : 0;
    if (aSold !== bSold) return aSold - bSold;
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    return a.schedule.departureTime.localeCompare(b.schedule.departureTime);
  });
  return sorted.slice(0, 3).map(item => {
    const reasons: string[] = [];
    if (item.distanceKm != null) reasons.push(`距您最近 ${item.distanceKm.toFixed(1)}km`);
    else reasons.push(`发车 ${item.schedule.departureTime}`);
    if (item.inventory.remainingTickets > 10) reasons.push('余票充足');
    else if (item.inventory.saleStatus === 'almost_sold') reasons.push('余票紧张，建议尽快');
    if (item.inventory.saleStatus === 'sold_out') reasons.push('已售罄（可看其他班次）');
    return { schedule: item.schedule, inventory: item.inventory, reasons };
  });
}

export const COMMON_CITIES = ['长沙', '武汉', '岳阳', '株洲', '合肥', '襄阳'];

// ===== 后端优先 + 本地降级：统一入口 =====

/**
 * 查询班次：后端优先；失败降级本地演示数据。
 * 返回 { results, source }，source 标注数据来源（backend/demo）。
 */
export async function querySchedules(
  origin: string,
  destination: string,
  date: string,
  querySeq: number,
  userLng?: number,
  userLat?: number,
): Promise<{ results: QueryResult[]; source: DataSource }> {
  try {
    const data = await apiGet<ApiSchedule[]>('/long-distance/schedules', { origin, destination, date });
    const list = Array.isArray(data) ? data : [];
    if (list.length > 0) {
      const results: QueryResult[] = list
        .map(raw => {
          const schedule = normalizeApiSchedule(raw);
          const inventory = normalizeInventory(raw.inventory);
          const distanceKm = stationDistance(schedule.originStation, userLng, userLat);
          return { schedule, inventory, distanceKm };
        })
        .filter(r => r.schedule.id && r.schedule.originStation);
      return { results: sortResults(results), source: 'backend' };
    }
    // 后端返回空：降级本地（避免空白）
    return { results: querySchedulesLocal(origin, destination, date, querySeq, userLng, userLat), source: 'demo' };
  } catch {
    // 后端不可用：降级本地演示
    return { results: querySchedulesLocal(origin, destination, date, querySeq, userLng, userLat), source: 'demo' };
  }
}

/** 刷新单班次库存：后端优先；失败降级本地 */
export async function refreshInventory(
  schedule: BusSchedule,
  date: string,
  querySeq: number,
): Promise<{ inventory: ScheduleInventory; source: DataSource }> {
  try {
    const data = await apiGet<Partial<ScheduleInventory>>(`/long-distance/schedules/${encodeURIComponent(schedule.id)}/inventory`, { date });
    if (data && (Number(data.remainingTickets) >= 0 || data.saleStatus)) {
      return { inventory: normalizeInventory(data), source: 'backend' };
    }
  } catch { /* 降级 */ }
  return { inventory: refreshInventoryLocal(schedule, date, querySeq), source: 'demo' };
}

/**
 * 生成购票深链：后端即时生成；后端不可用时返回演示占位（标注 demo，不伪装真实链接）。
 */
export async function getPurchaseUrl(
  schedule: BusSchedule,
  date: string,
  passengerCount: number,
): Promise<{ link: PurchaseLink; source: DataSource }> {
  try {
    const data = await apiPost<Partial<PurchaseLink>>('/long-distance/purchase-url', {
      scheduleId: schedule.id,
      date,
      passengerCount,
    });
    if (data?.purchaseUrl) {
      return { link: { purchaseUrl: data.purchaseUrl, expiresIn: Number(data.expiresIn ?? 300), providerName: data.providerName }, source: 'backend' };
    }
  } catch { /* 降级 */ }
  return {
    link: {
      // 演示占位：不伪装真实购票链接，仅示意跳转合作平台
      purchaseUrl: `https://www.e2go.com.cn?schedule=${encodeURIComponent(schedule.id)}&date=${encodeURIComponent(date)}&pax=${passengerCount}`,
      expiresIn: 300,
      providerName: schedule.providerName,
    },
    source: 'demo',
  };
}

// ===== 购票记录（后端存储；后端未接入时降级本地演示） =====

const PURCHASE_KEY = 'zhitu_long_distance_purchases';

function readLocalPurchases(): LongDistancePurchase[] {
  try {
    const raw = localStorage.getItem(PURCHASE_KEY);
    return raw ? JSON.parse(raw) as LongDistancePurchase[] : [];
  } catch { return []; }
}

function writeLocalPurchases(list: LongDistancePurchase[]): void {
  try { localStorage.setItem(PURCHASE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

/**
 * 创建购票记录：点击「确认购票信息」时调用，后端存储；后端未接入时降级本地。
 * 返回记录 + 数据来源。
 */
export async function createPurchase(
  schedule: BusSchedule,
  date: string,
  passengerCount: number,
  price: number,
): Promise<{ purchase: LongDistancePurchase; source: DataSource }> {
  const now = Date.now();
  const demoPurchase: LongDistancePurchase = {
    id: `ldp_${now.toString(36)}`,
    purchaseNo: `LD${now.toString(36).toUpperCase()}`,
    kind: 'purchase',
    scheduleId: schedule.id,
    routeName: `${schedule.originStation} → ${schedule.destinationStation}`,
    provider: schedule.providerName,
    date,
    departureTime: schedule.departureTime,
    originStation: schedule.originStation,
    destinationStation: schedule.destinationStation,
    price,
    passengerCount,
    status: 'pending',
    createdAt: now,
  };
  try {
    const req: CreateLongDistancePurchaseRequest = { scheduleId: schedule.id, date, passengerCount };
    const data = await apiPost<LongDistancePurchase>('/long-distance/purchases', req);
    if (data?.id) return { purchase: { ...data, kind: 'purchase' }, source: 'backend' };
  } catch (error) {
    // 未登录（401）：抛 UNAUTHORIZED，由页面提示登录，不静默降级本地
    if (error instanceof ApiError && error.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    // 其他错误（后端未接入/网络）：降级本地
  }
  // 本地降级：写入 localStorage（演示，跨设备不可见）
  writeLocalPurchases([demoPurchase, ...readLocalPurchases()]);
  return { purchase: demoPurchase, source: 'demo' };
}

/** 我的购票记录：后端优先；后端未接入时读本地降级 */
export async function getMyPurchases(): Promise<{ purchases: LongDistancePurchase[]; source: DataSource }> {
  try {
    const data = await apiGet<LongDistancePurchase[]>('/long-distance/purchases');
    if (Array.isArray(data)) {
      return { purchases: data.map(p => ({ ...p, kind: 'purchase' as const })), source: 'backend' };
    }
  } catch { /* 降级 */ }
  return { purchases: readLocalPurchases(), source: 'demo' };
}

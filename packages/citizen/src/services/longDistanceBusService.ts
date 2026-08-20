// ===== 智途云枢 · 长途客运班次查询服务 =====
// 数据真实性边界：
//   - 班次基础信息（线路/站/时刻/票价区间）为演示数据（source: demo），可查询。
//   - 余票/价格/停售状态：查询时按班次「刷新」（模拟合作平台库存同步），
//     不长期固定——避免「页面余 32 张，跳转后无票」。
//   - 购票链接（purchaseUrl）不固定长期保存：点击购买时由「合作平台」即时生成
//     （带班次+日期+库存校验），跳转前展示同步信息。
//   - 智能推荐可解释、可降级：缺实时交通/天气时退化为按距离+发车时间+余票排序。

import { isValidCoord } from './locationService';

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

/** 智能推荐依据（可解释） */
export interface Recommendation {
  schedule: BusSchedule;
  inventory: ScheduleInventory;
  reasons: string[];
}

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

/** 确定性 hash（djb2）：余票/价格随「班次+日期+查询次数」变化，避免长期固定 */
function hashStr(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 刷新班次库存（模拟合作平台实时库存） */
export function refreshInventory(schedule: BusSchedule, date: string, querySeq: number): ScheduleInventory {
  const seed = `${schedule.id}:${date}:${querySeq}`;
  // 余票：基础票数随查询浮动（演示"实时库存"），偶发售罄
  const variation = (hashStr(seed) % 7) - 3; // -3 ~ +3
  const remaining = Math.max(0, schedule.baseTickets + variation);
  const priceJitter = (hashStr(`${seed}:price`) % 3) - 1; // -1 ~ +1 元
  const price = Math.max(1, schedule.basePrice + priceJitter);
  const saleStatus = remaining <= 0 ? 'sold_out' : remaining <= 5 ? 'almost_sold' : 'on_sale';
  return { price, remainingTickets: remaining, saleStatus, refreshedAt: new Date().toISOString() };
}

/** 站到用户位置距离（km）；无坐标或站未收录返回 undefined（智能推荐降级依据） */
function stationDistance(station: string, userLng?: number, userLat?: number): number | undefined {
  if (userLng == null || userLat == null) return undefined;
  if (!isValidCoord(userLng, userLat)) return undefined;
  const coord = STATION_COORDS[station];
  if (!coord) return undefined;
  return haversineKm(coord, { lng: userLng, lat: userLat });
}

/**
 * 查询班次：按出发城市+到达城市（模糊匹配）。返回班次 + 刷新后库存 + 距离。
 * 结果按：发车时间优先；用户坐标可用时按「距出发站近」排前。
 */
export function querySchedules(
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
    const inventory = refreshInventory(schedule, date, querySeq);
    const distanceKm = stationDistance(schedule.originStation, userLng, userLat);
    return { schedule, inventory, distanceKm };
  });
  // 排序：距离近优先（有坐标时），否则按发车时间
  results.sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null && Math.abs(a.distanceKm - b.distanceKm) > 0.5) {
      return a.distanceKm - b.distanceKm;
    }
    return a.schedule.departureTime.localeCompare(b.schedule.departureTime);
  });
  return results;
}

/**
 * 智能推荐班次（可解释、可降级）：
 *   - 有坐标：优先距用户最近的出发站班次 + 发车时间 + 余票充足
 *   - 缺坐标/缺实时数据：退化为「按距离(无则跳过)、发车时间、余票」排序
 * 推荐理由明确列出依据，不伪装成实时班次事实。
 */
export function recommendSchedules(
  results: QueryResult[],
  userLng?: number,
  userLat?: number,
): Recommendation[] {
  if (results.length === 0) return [];
  const sorted = [...results].sort((a, b) => {
    // 1) 余票充足优先（排除售罄）
    const aSold = a.inventory.saleStatus === 'sold_out' ? 1 : 0;
    const bSold = b.inventory.saleStatus === 'sold_out' ? 1 : 0;
    if (aSold !== bSold) return aSold - bSold;
    // 2) 有坐标：距出发站近优先
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    // 3) 发车时间早优先
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

/** 常见城市快捷入口 */
export const COMMON_CITIES = ['长沙', '武汉', '岳阳', '株洲', '合肥', '襄阳'];

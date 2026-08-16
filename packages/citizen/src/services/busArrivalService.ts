// ===== 智途云枢 · 长辈模式「公交车到哪了」数据服务 =====
// 数据真实性边界（必须遵守）：
//   - 候车站点：后端 /transit/nearby 优先，失败降级高德 PlaceSearch 附近公交站。
//   - 线路名：来自后端附近站返回的 lines[]（真实静态信息）。
//   - 方向（开往 XX）：尽量用 getBusLines() 真实线路表匹配；匹配不到不伪造，返回空。
//   - 车辆位置 / 剩余站数 / ETA / 拥挤度：演示数据，前端按确定性伪随机生成，明确标注。
// 不生成不存在的 8路/56路 作为兜底假数据。

import { loadAMap } from '../lib/amap';
import { getCurrentLocation } from './locationService';
import { getNearbyStations, getBusLines } from './transitService';
import type { TransitLine } from '../types/transit';

export type CrowdingLevel = 'empty' | 'normal' | 'crowded' | 'full';

export const CROWD_META: Record<CrowdingLevel, { emoji: string; label: string; color: string }> = {
  empty: { emoji: '🟢', label: '空闲', color: '#52c41a' },
  normal: { emoji: '🟡', label: '适中', color: '#faad14' },
  crowded: { emoji: '🟠', label: '较拥挤', color: '#ff7a00' },
  full: { emoji: '🔴', label: '拥挤', color: '#f5222d' },
};

const CROWD_LEVELS: CrowdingLevel[] = ['empty', 'normal', 'crowded', 'full'];

/** 每条线路在该候车站的到站展示信息 */
export interface ElderlyBusLineArrival {
  /** 用于跳线路详情；匹配不到真实线路时为空字符串 */
  lineId: string;
  /** 线路名（真实，来自附近站 lines[]） */
  lineName: string;
  /** 开往方向（真实线路表匹配的 to 端点；匹配不到为空，页面显示「方向未接入」） */
  direction: string;
  /** 车辆刚到的站名（演示；匹配到真实线路站点序列时用真实站名） */
  vehicleStation: string;
  /** 还有 N 站（演示） */
  stopsRemaining: number;
  /** 约 N 分钟到站（演示） */
  etaMinutes: number;
  /** 拥挤度（演示） */
  crowding: CrowdingLevel;
}

export interface ElderlyBusStation {
  name: string;
  lng?: number;
  lat?: number;
  distance?: number;
  /** backend = 后端 /transit/nearby；amap = 高德 PlaceSearch 兜底（仅站名，无线路） */
  source: 'backend' | 'amap';
  /** 空数组 = 该站暂无可用线路信息 */
  lines: ElderlyBusLineArrival[];
}

export type BusStationLoadResult =
  | { status: 'ok'; station: ElderlyBusStation }
  | { status: 'failed'; message: string };

export interface BusStationCandidate {
  name: string;
  lng: number;
  lat: number;
  address?: string;
}

/** 确定性字符串 hash（djb2），用于演示数据稳定、刷新不乱跳 */
function hashStr(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 站名归一化，用于跨数据源模糊匹配 */
function comparable(name: string): string {
  return String(name || '')
    .replace(/[（）()\s·]/g, '')
    .replace(/公交枢纽站?|公交场站|枢纽站|总站|车站|站$/g, '');
}

// 全量公交线路表缓存：方向匹配用，失败即返回空，不阻塞主流程
let busLinesCache: TransitLine[] | null = null;
let busLinesPromise: Promise<TransitLine[]> | null = null;

function loadBusLines(): Promise<TransitLine[]> {
  if (busLinesCache) return Promise.resolve(busLinesCache);
  if (!busLinesPromise) {
    busLinesPromise = getBusLines()
      .then((lines) => { busLinesCache = lines; return lines; })
      .catch(() => { busLinesPromise = null; return [] as TransitLine[]; });
  }
  return busLinesPromise;
}

/**
 * 演示到站信息生成：基于线路名 + 候车站 + 时间种子（30s 粒度，与自动刷新周期一致）。
 * 剩余站数 1~6、ETA = 站数 × 约3分钟、拥挤度四选一、车辆位置取上游站名。
 */
function buildDemoArrival(
  lineName: string,
  stationName: string,
  seed: number,
  index: number,
  line?: TransitLine,
): { stopsRemaining: number; etaMinutes: number; crowding: CrowdingLevel; vehicleStation: string } {
  const stopsRemaining = 1 + (hashStr(`${lineName}:${stationName}:${seed}:${index}`) % 6);
  const etaMinutes = stopsRemaining * 3;
  const crowding = CROWD_LEVELS[hashStr(`${lineName}:${seed}:crowd:${index}`) % CROWD_LEVELS.length];

  let vehicleStation = '';
  if (line && line.stations.length) {
    const idx = line.stations.findIndex(s => comparable(s.name) === comparable(stationName));
    const base = idx >= 0 ? idx : line.stations.length - 1;
    const upstream = Math.max(0, base - stopsRemaining - 1);
    vehicleStation = line.stations[upstream]?.name || line.stations[0]?.name || '';
  }
  return { stopsRemaining, etaMinutes, crowding, vehicleStation };
}

/** 组合真实线路名 + 演示到站信息 */
export async function buildElderlyBusLines(
  stationName: string,
  rawLines: string[],
): Promise<ElderlyBusLineArrival[]> {
  const allLines = await loadBusLines();
  const seed = Math.floor(Date.now() / 30000);
  return rawLines.map((name, index) => {
    // 真实后端一条线路有去/返两条独立记录：优先选站点序列包含候车站的方向，避免「开往」方向出错
    const nameMatches = allLines.filter(l => l.name === name || comparable(l.name) === comparable(name));
    const line = nameMatches.find(l => l.stations.some(s => comparable(s.name) === comparable(stationName)))
      || nameMatches[0];
    const direction = line ? (line.to || line.from || '') : '';
    const demo = buildDemoArrival(name, stationName, seed, index, line);
    return {
      lineId: line?.id || '',
      lineName: name,
      direction,
      vehicleStation: demo.vehicleStation,
      stopsRemaining: demo.stopsRemaining,
      etaMinutes: demo.etaMinutes,
      crowding: demo.crowding,
    };
  });
}

/** 高德 PlaceSearch 兜底：按坐标搜附近公交站（仅拿真实站名，不含途经线路） */
export function searchNearbyBusStations(lng: number, lat: number): Promise<BusStationCandidate[]> {
  return loadAMap().then((AMap: any) => new Promise<BusStationCandidate[]>((resolve, reject) => {
    AMap.plugin(['AMap.PlaceSearch'], () => {
      const placeSearch = new AMap.PlaceSearch({ pageSize: 10, pageIndex: 1 });
      placeSearch.searchNearBy('公交站', new AMap.LngLat(lng, lat), 1500, (status: string, result: any) => {
        const pois = result?.poiList?.pois;
        if (status !== 'complete' || !Array.isArray(pois) || pois.length === 0) {
          reject(new Error('nearby-bus-station-not-found'));
          return;
        }
        resolve(
          pois
            .map((p: any): BusStationCandidate | null => {
              const plng = Number(p?.location?.lng);
              const plat = Number(p?.location?.lat);
              if (!Number.isFinite(plng) || !Number.isFinite(plat)) return null;
              return { name: String(p.name || ''), lng: plng, lat: plat, address: p.address ? String(p.address) : undefined };
            })
            .filter((c: BusStationCandidate | null): c is BusStationCandidate => c !== null && !!c.name),
        );
      });
    });
  }));
}

/** 手动搜索公交站候选（高德 PlaceSearch，公交车站分类） */
export function searchBusStations(keyword: string): Promise<BusStationCandidate[]> {
  const query = keyword.trim();
  if (!query) return Promise.reject(new Error('empty-keyword'));
  return loadAMap().then((AMap: any) => new Promise<BusStationCandidate[]>((resolve, reject) => {
    AMap.plugin(['AMap.PlaceSearch'], () => {
      const run = (type?: string) => {
        const placeSearch = new AMap.PlaceSearch({ city: '北京', pageSize: 10, pageIndex: 1, ...(type ? { type } : {}) });
        placeSearch.search(query, (status: string, result: any) => {
          const pois = result?.poiList?.pois;
          if (status !== 'complete' || !Array.isArray(pois) || pois.length === 0) {
            if (type === '150700') { run(undefined); return; } // 分类过滤无结果则降级通用搜索
            reject(new Error('bus-station-not-found'));
            return;
          }
          resolve(
            pois
              .map((p: any): BusStationCandidate | null => {
                const plng = Number(p?.location?.lng);
                const plat = Number(p?.location?.lat);
                if (!Number.isFinite(plng) || !Number.isFinite(plat)) return null;
                return { name: String(p.name || ''), lng: plng, lat: plat, address: p.address ? String(p.address) : undefined };
              })
              .filter((c: BusStationCandidate | null): c is BusStationCandidate => c !== null && !!c.name),
          );
        });
      };
      run('150700');
    });
  }));
}

/**
 * 解析当前候车站：后端 /transit/nearby 优先（含途经线路），
 * 失败降级高德附近公交站（仅站名），再失败返回 failed（页面提示手动选站/重新加载）。
 */
export async function resolveElderlyBusStation(
  opts?: { station?: { name: string; lng: number; lat: number } },
): Promise<BusStationLoadResult> {
  let lng: number;
  let lat: number;
  if (opts?.station && Number.isFinite(opts.station.lng) && Number.isFinite(opts.station.lat)) {
    lng = opts.station.lng;
    lat = opts.station.lat;
  } else {
    try {
      const pos = await getCurrentLocation();
      lng = pos.lng;
      lat = pos.lat;
    } catch {
      return { status: 'failed', message: '无法获取当前位置' };
    }
  }

  // 1) 后端优先：附近站含途经线路
  try {
    const stations = await getNearbyStations(lat, lng);
    const bus = stations
      .filter(s => s.mode === 'bus')
      .sort((a, b) => a.distance - b.distance)[0];
    if (bus) {
      const lines = bus.lines?.length ? await buildElderlyBusLines(bus.name, bus.lines) : [];
      return {
        status: 'ok',
        station: { name: bus.name, lng: bus.lng, lat: bus.lat, distance: bus.distance, source: 'backend', lines },
      };
    }
  } catch { /* 后端不可用 → 高德兜底 */ }

  // 2) 高德兜底：附近公交站（仅站名，无线路）
  try {
    const nearby = await searchNearbyBusStations(lng, lat);
    const first = nearby[0];
    if (first) {
      return {
        status: 'ok',
        station: { name: first.name, lng: first.lng, lat: first.lat, source: 'amap', lines: [] },
      };
    }
  } catch { /* ignore */ }

  return { status: 'failed', message: '附近未找到公交站' };
}

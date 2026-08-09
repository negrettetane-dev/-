// ===== 智途云枢 · 公交/地铁统一数据服务 =====
// 所有公交/地铁数据通过此 service 获取，页面不直接硬编码线路。

import type {
  TransitMode,
  TransitLine,
  TransitStation,
  ArrivalInfo,
  TransitSearchResult,
  NearbyStation,
} from '../types/transit';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  return body.data as T;
}

/** 获取全部公交线路 */
export async function getBusLines(): Promise<TransitLine[]> {
  return fetchJson<TransitLine[]>('/api/transit/bus-lines');
}

/** 获取全部地铁线路 */
export async function getMetroLines(): Promise<TransitLine[]> {
  return fetchJson<TransitLine[]>('/api/transit/metro-lines');
}

/** 获取公交/地铁线路详情（含完整站点、首末班） */
export async function getLineDetail(mode: TransitMode, lineId: string): Promise<TransitLine | null> {
  try {
    const data = await fetchJson<TransitLine>(`/api/transit/${mode}/${lineId}`);
    return data;
  } catch {
    return null;
  }
}

/** 搜索线路或站点 */
export async function searchTransit(query: string): Promise<TransitSearchResult[]> {
  if (!query.trim()) return [];
  return fetchJson<TransitSearchResult[]>(`/api/transit/search?q=${encodeURIComponent(query)}`);
}

/** 附近公交/地铁站（定位失败时返回演示数据） */
export async function getNearbyStations(lat?: number, lng?: number): Promise<NearbyStation[]> {
  const qs = lat && lng ? `?lat=${lat}&lng=${lng}` : '';
  return fetchJson<NearbyStation[]>(`/api/transit/nearby${qs}`);
}

/** 获取实时到站信息 */
export async function getArrivalInfo(lineId: string, stationId: string): Promise<ArrivalInfo> {
  return fetchJson<ArrivalInfo>(`/api/transit/arrival?lineId=${lineId}&stationId=${stationId}&t=${Date.now()}`);
}

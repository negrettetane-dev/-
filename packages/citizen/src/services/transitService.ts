// ===== 智途云枢 · 公交/地铁统一数据服务 =====
// 所有公交/地铁数据通过此 service 获取，页面不直接硬编码线路。

import type {
  TransitMode,
  DataSource,
  TransitLine,
  TransitStation,
  ArrivalInfo,
  TransitSearchResult,
  NearbyStation,
} from '../types/transit';
import { apiGet } from './apiClient';

interface ApiStation {
  id?: string;
  name: string;
  sequence?: number;
  lng?: number;
  lat?: number;
  longitude?: number;
  latitude?: number;
  transferLines?: string[] | null;
}

interface ApiTransitLine {
  id: string;
  name: string;
  direction: string;
  operationTime?: string;
  first?: string;
  last?: string;
  source?: DataSource;
  color?: string;
  fare?: number;
  stations: ApiStation[];
}

function normalizeLine(line: ApiTransitLine, mode: TransitMode): TransitLine {
  const [from = '', to = ''] = line.direction.split(/\s*[→-]\s*/);
  const operationTimes = (line.operationTime || '').split('-');
  const first = line.first || operationTimes[0] || '';
  const last = line.last || operationTimes[1] || '';
  return {
    id: line.id,
    mode,
    name: line.name,
    direction: line.direction,
    from,
    to,
    first,
    last,
    color: line.color,
    fare: line.fare,
    status: 'normal',
    source: line.source || 'api',
    stations: (line.stations || []).map((station, sequence) => ({
      id: station.id || `${line.id}_${sequence}`,
      name: station.name,
      sequence: station.sequence ?? sequence,
      longitude: station.lng ?? station.longitude,
      latitude: station.lat ?? station.latitude,
      transferLines: station.transferLines || [],
    })),
  };
}

/** 获取全部公交线路 */
export async function getBusLines(): Promise<TransitLine[]> {
  const lines = await apiGet<ApiTransitLine[]>('/transit/bus-lines');
  return lines.map(line => normalizeLine(line, 'bus'));
}

/** 获取全部地铁线路 */
export async function getMetroLines(): Promise<TransitLine[]> {
  const lines = await apiGet<ApiTransitLine[]>('/transit/metro-lines');
  return lines.map(line => normalizeLine(line, 'metro'));
}

/** 获取公交/地铁线路详情（含完整站点、首末班） */
export async function getLineDetail(mode: TransitMode, lineId: string): Promise<TransitLine | null> {
  try {
    const data = await apiGet<ApiTransitLine>(`/transit/${mode}/${lineId}`);
    return normalizeLine(data, mode);
  } catch {
    return null;
  }
}

/** 搜索线路或站点 */
export async function searchTransit(query: string): Promise<TransitSearchResult[]> {
  if (!query.trim()) return [];
  return apiGet<TransitSearchResult[]>('/transit/search', { q: query });
}

/** 附近公交/地铁站（定位失败时返回演示数据） */
export async function getNearbyStations(lat?: number, lng?: number): Promise<NearbyStation[]> {
  const data = await apiGet<Array<{ type: TransitMode; name: string; lines: string[]; lng: number; lat: number; distance: number }>>(
    '/transit/nearby',
    lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
  );
  return data.map((station, index) => ({ ...station, id: `${station.type}_${station.name}_${index}`, mode: station.type }));
}

/** 获取实时到站信息 */
export async function getArrivalInfo(lineId: string, stationId: string): Promise<ArrivalInfo> {
  const data = await apiGet<{
    lineId: string;
    stationId: string;
    lineName?: string;
    arrivals?: Array<{ vehicleId: string; eta: number }>;
    nextArrivalSeconds?: number;
    followingArrivalSeconds?: number;
    crowdLevel?: ArrivalInfo['crowdLevel'];
    updateTime?: number;
    updatedAt?: number;
    source?: DataSource;
  }>(`/transit/arrival/${encodeURIComponent(lineId)}/${encodeURIComponent(stationId)}`);
  return {
    lineId: data.lineId,
    stationId: data.stationId,
    lineName: data.lineName || '',
    vehicleId: data.arrivals?.[0]?.vehicleId,
    nextArrivalSeconds: data.nextArrivalSeconds ?? data.arrivals?.[0]?.eta ?? 0,
    followingArrivalSeconds: data.followingArrivalSeconds ?? data.arrivals?.[1]?.eta ?? 0,
    crowdLevel: data.crowdLevel || 'normal',
    updatedAt: data.updateTime ?? data.updatedAt ?? Date.now(),
    source: data.source || 'api',
  };
}

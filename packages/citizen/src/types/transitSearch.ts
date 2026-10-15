// ===== 智途云枢 · 公交/地铁搜索统一模型 =====
// 统一线路/公交站/地铁线路/地铁站四类结果的渲染与点击处理。
//
// 真实 API 契约：
//   GET /api/transit/search?q=<keyword>
//   返回 TransitSearchResult[]: { type:'line'|'station', mode:'bus'|'metro', id, name, subtitle?, transferLines?, lng?, lat?, address? }
//   station 结果已返回 lng/lat/address（内置站点坐标表）；未收录的站点返回 null，不伪造坐标。

import type { DataSource } from './transit';

export type TransitResultType = 'bus_line' | 'bus_stop' | 'metro_line' | 'metro_stop';

export interface UnifiedTransitResult {
  id: string;
  type: TransitResultType;
  name: string;
  subtitle?: string;
  address: string;
  city: string;
  /** 接口未返回坐标时为 null —— 不能写入规划状态 */
  lng: number | null;
  lat: number | null;
  transferLines?: string[];
  source: DataSource;
}

/** 搜索结果状态：始终携带本次查询文本，空结果/接口异常区分显示 */
export interface TransitSearchState {
  status: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  query: string;
  results: UnifiedTransitResult[];
}

/** 详情路由映射：项目现有详情页。站点暂无详情页，返回 null（不跳假路由） */
const DETAIL_ROUTES: Record<TransitResultType, string | null> = {
  bus_line: '/travel/bus/:id',
  metro_line: '/travel/metro/:id',
  bus_stop: null,
  metro_stop: null,
};

export function toDetailPath(type: TransitResultType, id: string): string | null {
  const route = DETAIL_ROUTES[type];
  if (!route) return null;
  return route.replace(':id', encodeURIComponent(id));
}

/** 后端 TransitSearchResult → 统一模型（坐标缺省为 null，由接口决定，不猜测） */
export function normalizeSearchResult(raw: {
  type: 'line' | 'station';
  mode: 'bus' | 'metro';
  id: string;
  name: string;
  subtitle?: string;
  transferLines?: string[] | null;
  lng?: number | null;
  lat?: number | null;
  address?: string;
  city?: string;
}): UnifiedTransitResult {
  const isMetro = raw.mode === 'metro';
  const isLine = raw.type === 'line';
  return {
    id: raw.id,
    type: isMetro ? (isLine ? 'metro_line' : 'metro_stop') : (isLine ? 'bus_line' : 'bus_stop'),
    name: raw.name,
    subtitle: raw.subtitle || (raw.transferLines?.length ? `换乘 ${raw.transferLines.join('/')}` : undefined),
    address: raw.address || '',
    city: raw.city || '北京',
    lng: raw.lng ?? null,
    lat: raw.lat ?? null,
    transferLines: raw.transferLines || [],
    source: 'api',
  };
}

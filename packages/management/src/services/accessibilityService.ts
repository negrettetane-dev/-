// ===== 智途云枢 · 管理端无障碍设施服务 =====
// 对接后端 /api/admin/accessibility/* CRUD（后端已实现）。
// 平民端负责使用（查询/展示/路线评价），管理端负责维护（站点/入口 CRUD）。

import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';
import type { PaginatedResponse } from '@zhitu/shared';
import type { StationFacility, UpsertStationFacilityRequest } from '@zhitu/shared';

/** 管理端创建/更新站点请求（服务端入参：无 id/source） */
export interface AdminStationInput extends UpsertStationFacilityRequest {}

export const accessibilityService = {
  /** 分页查询站点（含入口） */
  getList: async (params?: Record<string, unknown>) => {
    const data = await apiGet<PaginatedResponse<Record<string, unknown>>>('/accessibility/stations', params);
    return { ...data, list: (data.list || []).map(normalizeStation) };
  },

  /** 创建站点（可带入口数组） */
  create: async (input: AdminStationInput): Promise<StationFacility> => {
    return normalizeStation(await apiPost<Record<string, unknown>>('/accessibility/stations', input));
  },

  /** 更新站点 */
  update: async (id: string, input: Partial<AdminStationInput>): Promise<StationFacility> => {
    return normalizeStation(await apiPut<Record<string, unknown>>(`/accessibility/stations/${encodeURIComponent(id)}`, input));
  },

  /** 删除站点（级联删入口） */
  remove: async (id: string): Promise<boolean> => {
    await apiDelete(`/accessibility/stations/${encodeURIComponent(id)}`);
    return true;
  },

  /** 新增入口 */
  addEntrance: async (stationId: string, entrance: Record<string, unknown>): Promise<StationFacility> => {
    return normalizeStation(await apiPost<Record<string, unknown>>(`/accessibility/stations/${encodeURIComponent(stationId)}/entrances`, entrance));
  },

  /** 更新入口 */
  updateEntrance: async (entranceId: string, entrance: Record<string, unknown>): Promise<StationFacility> => {
    return normalizeStation(await apiPut<Record<string, unknown>>(`/accessibility/entrances/${encodeURIComponent(entranceId)}`, entrance));
  },

  /** 删除入口 */
  removeEntrance: async (entranceId: string): Promise<boolean> => {
    await apiDelete(`/accessibility/entrances/${encodeURIComponent(entranceId)}`);
    return true;
  },
};

/** 后端字段可能缺失/命名差异 → 归一化到 shared StationFacility */
function normalizeStation(item: Record<string, unknown>): StationFacility {
  const rawEntrances = Array.isArray(item.entrances) ? item.entrances : [];
  const entrances = rawEntrances.map((e: Record<string, unknown>) => ({
    id: e.id ? String(e.id) : undefined,
    name: String(e.name || ''),
    elevator: Boolean(e.elevator),
    ramp: Boolean(e.ramp),
    stairsOnly: Boolean(e.stairsOnly ?? e.stairs_only),
    wheelchairAccessible: Boolean(e.wheelchairAccessible ?? e.wheelchair_accessible),
    status: String(e.status || 'unknown') as StationFacility['entrances'][number]['status'],
  }));
  return {
    stationId: String(item.stationId ?? item.id ?? ''),
    stationName: String(item.stationName ?? item.name ?? ''),
    lng: Number(item.lng ?? item.longitude ?? 0),
    lat: Number(item.lat ?? item.latitude ?? 0),
    entrances,
    accessibleRestroom: Boolean(item.accessibleRestroom ?? item.accessible_restroom),
    source: String(item.source || 'backend') as StationFacility['source'],
  };
}

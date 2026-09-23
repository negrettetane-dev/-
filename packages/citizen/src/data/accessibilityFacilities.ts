// ===== 智途云枢 · 无障碍设施数据（MVP 演示区域 + 后端实时拉取） =====
// 数据真实性边界：
//   - 启动时优先从后端 GET /api/accessibility/stations 拉取真实设施数据（source: 'backend'）。
//   - 后端不可用/未接入时，降级使用前端演示数据（source: 'demo'，仅覆盖典型站点）。
//   - 设施状态三态：verified(已确认) / unknown(待确认) / obstacle(存在障碍)。
//   - 系统不会在数据不足时伪造「全程无障碍」——未收录站点在评分中计为「设施信息待确认」。

import { apiGet } from '../services/apiClient';
import { createDemoAccessibilityFacilities } from '@zhitu/shared';
import type { FacilityStatus, FacilityEntrance, StationFacility } from '@zhitu/shared';

export type { FacilityStatus, FacilityEntrance, StationFacility };

const demoAccessibilityFacilities = createDemoAccessibilityFacilities();

/** 站名归一化（去除 站/枢纽 后缀、括号、空格），用于与高德返回站点名模糊匹配 */
export function normalizeFacilityName(name: string): string {
  return String(name || '')
    .replace(/[（）()\s·]/g, '')
    .replace(/公交枢纽站?|公交场站|枢纽站|总站|车站|站$/g, '');
}

/** 动态设施 Map：默认演示数据，后端就绪后替换为真实数据 */
let facilityMap = new Map<string, StationFacility>(demoAccessibilityFacilities.map(f => [normalizeFacilityName(f.stationName), f]));

/** 当前设施数据来源：demo（演示兜底） | backend（后端真实） */
let facilitySource: 'demo' | 'backend' = 'demo';
let loadPromise: Promise<boolean> | null = null;
const facilityListeners = new Set<() => void>();

export function subscribeAccessibilityFacilities(listener: () => void): () => void {
  facilityListeners.add(listener);
  return () => facilityListeners.delete(listener);
}

export function refreshAccessibilityFacilities(): Promise<boolean> {
  loadPromise = null;
  return loadAccessibilityFacilities();
}

/** 按站名查无障碍设施；未收录返回 null（视为「设施信息待确认」） */
export function getFacilityForStation(stationName: string): StationFacility | null {
  if (!stationName) return null;
  return facilityMap.get(normalizeFacilityName(stationName)) ?? null;
}

/** 当前设施数据来源（供 UI 标注真实/演示） */
export function getFacilitySource(): 'demo' | 'backend' {
  return facilitySource;
}

function normalizeFacility(raw: Record<string, unknown>): StationFacility | null {
  const stationName = String(raw.stationName ?? raw.station_name ?? '').trim();
  const lng = Number(raw.lng ?? raw.longitude);
  const lat = Number(raw.lat ?? raw.latitude);
  if (!stationName) return null;
  const entrances = Array.isArray(raw.entrances) ? raw.entrances.map((entrance: Record<string, unknown>) => ({
    id: entrance.id ? String(entrance.id) : undefined,
    name: String(entrance.name ?? entrance.entranceName ?? entrance.entrance_name ?? '入口'),
    elevator: Boolean(entrance.elevator),
    ramp: Boolean(entrance.ramp),
    stairsOnly: Boolean(entrance.stairsOnly ?? entrance.stairs_only),
    wheelchairAccessible: Boolean(entrance.wheelchairAccessible ?? entrance.wheelchair_accessible),
    status: String(entrance.status || 'unknown') as FacilityStatus,
  })) : [];
  return {
    stationId: String(raw.stationId ?? raw.station_id ?? raw.id ?? stationName),
    stationName,
    // 设施评估按站名和入口字段完成；缺坐标只是不绘制地图标记，不能丢弃真实设施记录。
    lng: Number.isFinite(lng) ? lng : 0,
    lat: Number.isFinite(lat) ? lat : 0,
    entrances,
    accessibleRestroom: Boolean(raw.accessibleRestroom ?? raw.accessible_restroom),
    source: 'backend',
  };
}

/**
 * 从统一接口拉取无障碍设施数据并替换本地 Map（幂等，只拉一次）。
 * - 成功：保留接口返回的数据来源；缺失来源时按真实接口处理为 backend。
 * - 失败：保持演示数据兜底（source: demo），不伪造真实状态。
 * 返回是否成功。
 */
export function loadAccessibilityFacilities(): Promise<boolean> {
  if (loadPromise) return loadPromise;
  loadPromise = apiGet<StationFacility[] | { list?: unknown; items?: unknown }>('/accessibility/stations')
    .then((data) => {
      const list = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && Array.isArray((data as { list?: unknown }).list)
          ? (data as { list: unknown[] }).list
          : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
            ? (data as { items: unknown[] }).items
          : [];
      const facilities = list
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map(normalizeFacility)
        .filter((item): item is StationFacility => item !== null);
      if (facilities.length === 0) return false;
      facilityMap = new Map(facilities.map(f => [normalizeFacilityName(f.stationName), f]));
      facilitySource = 'backend';
      facilityListeners.forEach(listener => listener());
      return true;
    })
    .catch(() => {
      // 请求失败不能永久缓存失败结果；用户进入无障碍规划时允许重新拉取。
      loadPromise = null;
      return false;
    });
  return loadPromise;
}

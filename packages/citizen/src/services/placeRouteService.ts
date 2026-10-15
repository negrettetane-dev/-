// ===== 智途云枢 · 设施「去这里」统一服务 =====
// 停车场 / 充电站 → 校验真实起点 → 使用设施真实坐标 → 写 store → 返回路线请求快照。
// 调用方拿快照跳 /travel/result，结果页只规划一次。
// 起点真值在 travelLocationStore，终点真值在 travelPlanStore；不另建设施专用位置状态。

import { useTravelLocationStore, type UnifiedLocation } from '../stores/travelLocationStore';
import { useTravelPlanStore, createRouteRequestSnapshot, type RouteRequestSnapshot } from '../stores/travelPlanStore';
import { geocodeLocation, searchLocationCandidates } from './locationService';
import type { PlaceDestination } from '../types/facility';

/** 业务错误码：页面据此显示中文提示，不匹配 Axios/高德原始错误字符串 */
export class PlaceNavError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PlaceNavError';
  }
}

/**
 * 打开前往某设施的路由预览。
 * 返回 RouteRequestSnapshot，由调用方 navigate('/travel/result', { state: snapshot })。
 * 流程：校验设施 → 校验/定位起点 → 设施坐标（position→geocode→搜索候选）→ 写 store → 生成快照。
 */
export async function openRouteToPlace(place: PlaceDestination): Promise<RouteRequestSnapshot> {
  // 1. 校验设施
  if (!place?.id || !place.name) throw new PlaceNavError('DESTINATION_INVALID', '该设施信息不完整');

  // 2. 起点：读 store；无坐标则定位；定位后重读，避免闭包旧状态
  let origin = useTravelLocationStore.getState().origin;
  if (!origin.lng || !origin.lat) {
    await useTravelLocationStore.getState().locate().catch(() => undefined);
    origin = useTravelLocationStore.getState().origin;
  }
  if (!origin.lng || !origin.lat) throw new PlaceNavError('ORIGIN_MISSING', '无法获取您的当前位置，请允许定位后重试');

  // 3. 设施坐标：优先 position；缺失时 geocode 地址 → 搜索候选名称；仍失败则禁止进入结果页
  let lng = place.lng;
  let lat = place.lat;
  if (lng == null || lat == null) {
    try {
      const g = await geocodeLocation(place.address || place.name);
      lng = g.lng;
      lat = g.lat;
    } catch {
      const cands = await searchLocationCandidates(place.name).catch(() => [] as UnifiedLocation[]);
      if (cands[0]) {
        lng = cands[0].lng;
        lat = cands[0].lat;
      }
    }
  }
  if (lng == null || lat == null) throw new PlaceNavError('GEOCODE_FAILED', '该设施位置数据不完整，暂时无法规划路线');

  // 4. 写 store：起点 + 终点（source='facility'）+ 模式（停车=driving，充电=ev，底层均映射 drive）
  useTravelLocationStore.getState().setOrigin(origin);
  useTravelPlanStore.getState().setDestination({
    name: place.name,
    address: place.address || place.name,
    lng,
    lat,
    source: 'facility',
  });
  const isCharging = place.type === 'charging';
  useTravelPlanStore.getState().setMode(isCharging ? 'ev' : 'driving');
  useTravelPlanStore.getState().setProfile(isCharging ? 'ev' : 'standard');

  // 5. 生成路线请求快照（含目的地坐标，结果页刷新可恢复）
  const snapshot = createRouteRequestSnapshot();
  if (!snapshot) throw new PlaceNavError('ROUTE_NOT_FOUND', '路线信息不完整，请稍后重试');
  return snapshot;
}

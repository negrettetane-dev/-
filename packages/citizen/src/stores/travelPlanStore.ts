// ===== 智途云枢 · 出行规划草稿唯一 Store =====
// origin 已由 travelLocationStore 统一管理；本 store 负责其余全部规划草稿（destination/waypoints/mode/profile/strategy/departure）。
// origin 与 destination 同构（均为 UnifiedLocation），页面只读 store，不再各自维护真值。
// 提交规划时生成 routeRequestSnapshot 供结果页使用；草稿只在明确动作下清空（logout / 手动清空）。

import { create } from 'zustand';
import { useTravelLocationStore, type UnifiedLocation } from './travelLocationStore';
import {
  computeDepartureState,
  isValidDepartureAt,
  restoreDepartureState,
  type DepartureMode,
  type DepartureState,
} from '../utils/departureTime';
import type { TravelMode, TravelProfile } from '../types/travelPlan';
import { fromLegacyRouteMode } from '../types/travelMode';

const PLAN_KEY = 'zhitu_travel_plan';
const SNAPSHOT_KEY = 'zhitu_route_request';

/** 提交规划时的路线请求快照（结果页只读此快照，不写回草稿） */
export interface RouteRequestSnapshot {
  origin: string;
  originCoords: { lng: number; lat: number } | null;
  destination: string;
  waypoints: string[];
  mode: TravelMode;
  profile: TravelProfile;
  strategy: string;
  departureMode: DepartureMode;
  departureAt: string;
  departureTimeLabel: string;
  /** 旧版兼容字段（中文标签），仅用于旧链接/旧导航 */
  departureTime?: string;
}

interface TravelPlanDraft {
  destination: UnifiedLocation | null;
  waypoints: string[];
  mode: TravelMode;
  profile: TravelProfile;
  strategy: string;
  departure: DepartureState;
}

interface TravelPlanState extends TravelPlanDraft {
  setDestination: (dest: UnifiedLocation) => void;
  setWaypoints: (waypoints: string[]) => void;
  setMode: (mode: TravelMode) => void;
  setProfile: (profile: TravelProfile) => void;
  setStrategy: (strategy: string) => void;
  setDeparture: (departure: DepartureState) => void;
  /** 交换起点/终点完整对象 + 反转途经点 */
  swap: () => void;
  /** 仅在明确动作下调用（logout 等），返回规划页后草稿清空 */
  clear: () => void;
}

function readDraft(): Partial<TravelPlanDraft> | null {
  try {
    const raw = sessionStorage.getItem(PLAN_KEY);
    return raw ? JSON.parse(raw) as Partial<TravelPlanDraft> : null;
  } catch { return null; }
}

function persist(state: TravelPlanDraft): void {
  try {
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

const INITIAL_DRAFT: TravelPlanDraft = (() => {
  const draft = readDraft();
  if (draft?.mode && draft.profile && draft.departure) {
    return {
      destination: draft.destination ?? null,
      waypoints: Array.isArray(draft.waypoints) ? draft.waypoints : [],
      mode: fromLegacyRouteMode(draft.mode, draft.profile),
      profile: draft.profile,
      strategy: draft.strategy || '推荐',
      departure: (draft.departure?.departureMode && isValidDepartureAt(draft.departure.departureAt))
        ? draft.departure
        : restoreDepartureState(),
    };
  }
  return {
    destination: null,
    waypoints: [] as string[],
    mode: 'driving',
    profile: 'standard',
    strategy: '推荐',
    departure: restoreDepartureState(),
  };
})();

export const useTravelPlanStore = create<TravelPlanState>((set, get) => ({
  ...INITIAL_DRAFT,

  setDestination: (destination) => {
    const next = { ...get(), destination };
    persist(next);
    set({ destination });
  },

  setWaypoints: (waypoints) => {
    const next = { ...get(), waypoints };
    persist(next);
    set({ waypoints });
  },

  setMode: (mode) => {
    const next = { ...get(), mode };
    persist(next);
    set({ mode });
  },

  setProfile: (profile) => {
    const next = { ...get(), profile };
    persist(next);
    set({ profile });
  },

  setStrategy: (strategy) => {
    const next = { ...get(), strategy };
    persist(next);
    set({ strategy });
  },

  setDeparture: (departure) => {
    const next = { ...get(), departure };
    persist(next);
    set({ departure });
  },

  swap: () => {
    const origin = useTravelLocationStore.getState().origin;
    const destination = get().destination;
    const reversed = [...get().waypoints].reverse();
    // 直接交换完整对象（坐标随对象交换）；途经点反转
    useTravelLocationStore.getState().setOrigin(
      destination || { name: '请选择终点', address: '', lng: null, lat: null, source: 'manual' as const },
    );
    useTravelPlanStore.getState().setDestination(origin);
    useTravelPlanStore.getState().setWaypoints(reversed);
  },

  clear: () => {
    sessionStorage.removeItem(PLAN_KEY);
    set({
      destination: null,
      waypoints: [],
      mode: 'driving',
      profile: 'standard',
      strategy: '推荐',
      departure: computeDepartureState('now'),
    });
  },
}));

// ===== 路线请求快照读写 =====

export function createRouteRequestSnapshot(): RouteRequestSnapshot | null {
  const { origin } = useTravelLocationStore.getState();
  const { destination, waypoints, mode, profile, strategy, departure } = useTravelPlanStore.getState();
  if (!origin.name?.trim() || !destination?.name?.trim()) return null;
  const snapshot: RouteRequestSnapshot = {
    origin: origin.name.trim(),
    originCoords: origin.lng != null && origin.lat != null ? { lng: origin.lng, lat: origin.lat } : null,
    destination: destination.name.trim(),
    waypoints: waypoints.map(point => point.trim()).filter(Boolean),
    mode,
    profile,
    strategy,
    departureMode: departure.departureMode,
    departureAt: departure.departureAt,
    departureTimeLabel: departure.departureTimeLabel,
  };
  try { sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch { /* ignore */ }
  return snapshot;
}

/** 结果页刷新时从 sessionStorage 恢复快照；无效返回 null */
export function readRouteRequestSnapshot(): RouteRequestSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as RouteRequestSnapshot;
    if (!s || !s.origin || !s.destination) return null;
    return s;
  } catch { return null; }
}

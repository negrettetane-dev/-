// ===== 智途云枢 · 导航上下文 Store（长辈模式专用） =====
// 保存完整导航上下文到 sessionStorage，避免进入导航页/刷新后路线丢失。
// 起点真值在 travelLocationStore，目的地真值在 travelPlanStore；
// 此处只保存「本次已规划好的导航快照」，不做二次规划。

import { create } from 'zustand';
import type { UnifiedLocation } from './travelLocationStore';
import type { PlannedRoute } from '../services/routePlanningService';

export type ElderlyDisplayMode = 'driving' | 'transit' | 'walking';
export type ElderlyRouteMode = 'drive' | 'bus' | 'walk';

export interface NavigationContext {
  origin: UnifiedLocation;
  destination: UnifiedLocation;
  displayMode: ElderlyDisplayMode;
  routeMode: ElderlyRouteMode;
  route: PlannedRoute;
  source: 'elderly';
  returnPath: '/elderly';
  createdAt: number;
}

const NAV_KEY = 'zhitu_elderly_navigation';

function readContext(): NavigationContext | null {
  try {
    const raw = sessionStorage.getItem(NAV_KEY);
    if (!raw) return null;
    const ctx = JSON.parse(raw) as NavigationContext;
    if (!ctx?.origin || !ctx?.destination || !ctx?.route) return null;
    return ctx;
  } catch { return null; }
}

interface NavigationState {
  context: NavigationContext | null;
  setContext: (ctx: NavigationContext) => void;
  clearContext: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  context: readContext(),

  setContext: (ctx) => {
    try { sessionStorage.setItem(NAV_KEY, JSON.stringify(ctx)); } catch { /* ignore */ }
    set({ context: ctx });
  },

  clearContext: () => {
    try { sessionStorage.removeItem(NAV_KEY); } catch { /* ignore */ }
    set({ context: null });
  },
}));

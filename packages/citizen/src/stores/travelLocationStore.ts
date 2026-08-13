// ===== 智途云枢 · 出行起点唯一来源 Store =====
// 页面标题、地图 Marker、路线规划、导航起点必须统一读取此处的 origin。
// 真实定位、搜索起点、地图选点都通过 setOrigin 更新，禁止各自维护起点。

import { create } from 'zustand';
import { getCurrentResolvedLocation, normalizeLocationError } from '../services/locationService';

export interface UnifiedLocation {
  name: string;
  address: string;
  lng: number | null;
  lat: number | null;
  source: 'geolocation' | 'manual' | 'map-select' | 'poi-search' | 'demo';
  timestamp?: number;
}

export type LocationStatus =
  | 'idle'
  | 'locating'
  | 'success'
  | 'denied'
  | 'timeout'
  | 'error'
  | 'manual-required';

const CACHE_KEY = 'travel_origin';

function readCache(): UnifiedLocation | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as UnifiedLocation;
    if (!obj || typeof obj !== 'object' || obj.lng == null || obj.lat == null) return null;
    return obj;
  } catch { return null; }
}

function writeCache(origin: UnifiedLocation | null): void {
  try {
    if (origin && origin.lng != null && origin.lat != null) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(origin));
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch { /* ignore */ }
}

const EMPTY: UnifiedLocation = {
  name: '请选择起点',
  address: '',
  lng: null,
  lat: null,
  source: 'manual',
};

interface TravelLocationState {
  origin: UnifiedLocation;
  status: LocationStatus;
  error: string;
  /** 请求序号：防止连续定位/换点被旧结果覆盖 */
  locateSeq: number;
  setOrigin: (origin: UnifiedLocation) => void;
  locate: () => Promise<void>;
  clear: () => void;
}

export const useTravelLocationStore = create<TravelLocationState>((set, get) => ({
  origin: (() => {
    const cached = readCache();
    return cached || { ...EMPTY };
  })(),
  status: (() => {
    const cached = readCache();
    return cached ? 'success' : 'idle';
  })(),
  error: '',
  locateSeq: 0,

  setOrigin: (origin) => {
    writeCache(origin);
    set({ origin, status: origin.lng != null && origin.lat != null ? 'success' : 'manual-required', error: '' });
  },

  locate: async () => {
    const seq = get().locateSeq + 1;
    set({ locateSeq: seq, status: 'locating', error: '' });
    try {
      const resolved = await getCurrentResolvedLocation();
      if (seq !== get().locateSeq) return; // 已被新请求覆盖
      const origin: UnifiedLocation = {
        name: '当前位置',
        address: resolved.address,
        lng: resolved.lng,
        lat: resolved.lat,
        source: 'geolocation',
        timestamp: Date.now(),
      };
      writeCache(origin);
      set({ origin, status: 'success', error: '' });
    } catch (e) {
      if (seq !== get().locateSeq) return;
      const msg = normalizeLocationError(e);
      set({
        status: msg.includes('拒绝') ? 'denied' : msg.includes('超时') ? 'timeout' : 'error',
        error: msg,
      });
      // 定位失败不覆盖已有 origin；若无已有位置则要求手动选择
      if (get().origin.lng == null) set({ status: 'manual-required', error: `${msg}，请手动选择起点` });
    }
  },

  clear: () => {
    writeCache(null);
    set({ origin: { ...EMPTY }, status: 'idle', error: '' });
  },
}));

// 退出登录时清理起点缓存（在 authStore.logout 调用）
export function clearTravelOriginCache(): void {
  writeCache(null);
}

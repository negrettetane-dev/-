// ===== 智途云枢 · 出行规划统一状态模型 =====
// 4 种基础路线 + 2 种增强预设（新能源=drive+ev，无障碍=bus+accessible）

export type TravelMode = 'drive' | 'bus' | 'bike' | 'walk';
export type TravelProfile = 'standard' | 'ev' | 'accessible';

export interface TravelPlanState {
  mode: TravelMode;
  profile: TravelProfile;
  strategy?: string;
  departureTime?: string;
  origin?: string;
  destination?: string;
}

export const VALID_MODES: TravelMode[] = ['drive', 'bus', 'bike', 'walk'];
export const VALID_PROFILES: TravelProfile[] = ['standard', 'ev', 'accessible'];

/** 六个入口的元信息 */
export const TRAVEL_ENTRIES: {
  key: string;
  label: string;
  icon: string;
  mode: TravelMode;
  profile: TravelProfile;
  query: string;
}[] = [
  { key: 'ev', label: '新能源', icon: '⚡', mode: 'drive', profile: 'ev', query: '?mode=drive&profile=ev' },
  { key: 'drive', label: '驾车', icon: '🚗', mode: 'drive', profile: 'standard', query: '?mode=drive' },
  { key: 'bus', label: '公交地铁', icon: '🚌', mode: 'bus', profile: 'standard', query: '?mode=bus' },
  { key: 'bike', label: '骑行', icon: '🚲', mode: 'bike', profile: 'standard', query: '?mode=bike' },
  { key: 'walk', label: '步行', icon: '🚶', mode: 'walk', profile: 'standard', query: '?mode=walk' },
  { key: 'accessible', label: '无障碍', icon: '♿', mode: 'bus', profile: 'accessible', query: '?mode=bus&profile=accessible' },
];

/** 解析并校验 URL 参数，非法回退默认 */
export function parseTravelPlanParams(search: string): { mode: TravelMode; profile: TravelProfile } {
  const params = new URLSearchParams(search);
  const rawMode = params.get('mode');
  const rawProfile = params.get('profile');
  const mode = VALID_MODES.includes(rawMode as TravelMode) ? (rawMode as TravelMode) : 'drive';
  const profile = VALID_PROFILES.includes(rawProfile as TravelProfile) ? (rawProfile as TravelProfile) : 'standard';
  return { mode, profile };
}

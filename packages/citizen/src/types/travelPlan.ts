import type { TravelMode } from './travelMode';

/** 规划页对外只使用 canonical mode；底层路线协议的转换集中在 travelMode.ts。 */
export type { TravelMode } from './travelMode';
export type TravelProfile = 'standard' | 'ev' | 'accessible';

export interface TravelPlanState {
  mode: TravelMode;
  profile: TravelProfile;
  strategy?: string;
  departureTime?: string;
  origin?: string;
  destination?: string;
}

export const VALID_MODES: TravelMode[] = ['ev', 'driving', 'transit', 'riding', 'walking', 'accessible'];
export const VALID_PROFILES: TravelProfile[] = ['standard', 'ev', 'accessible'];

export const TRAVEL_ENTRIES: Array<{
  key: TravelMode;
  label: string;
  icon: string;
  mode: TravelMode;
  profile: TravelProfile;
  query: string;
}> = [
  { key: 'ev', label: '新能源', icon: '⚡', mode: 'ev', profile: 'ev', query: '?mode=ev' },
  { key: 'driving', label: '驾车', icon: '🚗', mode: 'driving', profile: 'standard', query: '?mode=driving' },
  { key: 'transit', label: '公交地铁', icon: '🚌', mode: 'transit', profile: 'standard', query: '?mode=transit' },
  { key: 'riding', label: '骑行', icon: '🚲', mode: 'riding', profile: 'standard', query: '?mode=riding' },
  { key: 'walking', label: '步行', icon: '🚶', mode: 'walking', profile: 'standard', query: '?mode=walking' },
  { key: 'accessible', label: '无障碍', icon: '♿', mode: 'accessible', profile: 'accessible', query: '?mode=accessible' },
];

export function parseTravelPlanParams(search: string): { mode: TravelMode; profile: TravelProfile } {
  const params = new URLSearchParams(search);
  const mode = VALID_MODES.includes(params.get('mode') as TravelMode)
    ? params.get('mode') as TravelMode
    : 'driving';
  const profile = mode === 'ev' ? 'ev' : mode === 'accessible' ? 'accessible' : 'standard';
  return { mode, profile };
}

/** 用户可见的统一出行模式。底层路线服务仍使用 legacy route mode。 */
export type TravelMode = 'ev' | 'driving' | 'transit' | 'riding' | 'walking' | 'accessible';
export type LegacyRouteMode = 'drive' | 'bus' | 'bike' | 'walk';

export const TRAVEL_MODES: TravelMode[] = ['ev', 'driving', 'transit', 'riding', 'walking', 'accessible'];

export const MODE_META: Record<TravelMode, { label: string; icon: string }> = {
  ev: { label: '新能源', icon: '⚡' },
  driving: { label: '驾车', icon: '🚗' },
  transit: { label: '公交地铁', icon: '🚌' },
  riding: { label: '骑行', icon: '🚲' },
  walking: { label: '步行', icon: '🚶' },
  accessible: { label: '无障碍', icon: '♿' },
};

export function toLegacyRouteMode(mode: TravelMode): LegacyRouteMode {
  if (mode === 'transit' || mode === 'accessible') return 'bus';
  if (mode === 'riding') return 'bike';
  if (mode === 'walking') return 'walk';
  return 'drive';
}

export function parseTravelMode(value: string | null | undefined): TravelMode | null {
  if (value && TRAVEL_MODES.includes(value as TravelMode)) return value as TravelMode;
  return null;
}

/** 将旧草稿/历史记录里的 route mode 转为用户层 canonical mode。 */
export function fromLegacyRouteMode(mode: string | null | undefined, profile?: string | null): TravelMode {
  if (TRAVEL_MODES.includes(mode as TravelMode)) return mode as TravelMode;
  if (profile === 'ev') return 'ev';
  if (profile === 'accessible') return 'accessible';
  if (mode === 'bus') return 'transit';
  if (mode === 'bike') return 'riding';
  if (mode === 'walk') return 'walking';
  return 'driving';
}

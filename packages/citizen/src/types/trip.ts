export type TripMode = 'drive' | 'bus' | 'bike' | 'walk';
export type TripProfile = 'standard' | 'ev' | 'accessible';
export type TripStatus = 'in_progress' | 'completed' | 'cancelled';
export type TripDataSource = 'real' | 'estimated' | 'demo';

export interface TripLocation {
  name: string;
  address: string;
  lng: number;
  lat: number;
}

export interface Trip {
  id: string;
  clientSessionId: string;
  mode: TripMode;
  profile: TripProfile;
  origin: TripLocation;
  destination: TripLocation;
  startedAt: string;
  endedAt: string | null;
  estimatedDistance: number;
  estimatedDuration: number;
  actualDistance: number | null;
  actualDuration: number | null;
  status: TripStatus;
  routeProvider: 'amap';
  providerRouteId?: string;
  path?: [number, number][];
  carbonSaved: number;
  earnedPoints: number;
  dataSource: TripDataSource;
  createdAt: string;
}

export interface CreateTripRequest {
  clientSessionId: string;
  mode: TripMode;
  profile: TripProfile;
  origin: TripLocation;
  destination: TripLocation;
  routeSnapshot: {
    estimatedDistance: number;
    estimatedDuration: number;
    routeProvider: 'amap';
    providerRouteId?: string;
    path?: [number, number][];
  };
  dataSource: TripDataSource;
}

export const TRIP_MODE_META: Record<TripMode, { label: string; icon: string }> = {
  drive: { label: '驾车', icon: '🚗' },
  bus: { label: '公交地铁', icon: '🚌' },
  bike: { label: '骑行', icon: '🚲' },
  walk: { label: '步行', icon: '🚶' },
};

export function getTripDisplayMeta(trip: Pick<Trip, 'mode' | 'profile'>) {
  if (trip.profile === 'ev') return { label: '新能源', icon: '⚡' };
  if (trip.profile === 'accessible') return { label: '无障碍', icon: '♿' };
  return TRIP_MODE_META[trip.mode];
}

// ===== 智途云枢 · 公交/地铁统一类型 =====

export type DataSource = 'api' | 'mock';
export type TransitMode = 'bus' | 'metro';

export interface TransitStation {
  id: string;
  name: string;
  sequence: number;
  longitude?: number;
  latitude?: number;
  transferLines?: string[];
}

export interface TransitLine {
  id: string;
  mode: TransitMode;
  name: string;
  direction: string;
  from: string;
  to: string;
  first?: string;
  last?: string;
  color?: string;
  fare?: number;
  status?: 'normal' | 'delayed' | 'maintenance';
  stations: TransitStation[];
  source: DataSource;
  city?: string;
  path?: [number, number][];
  outboundPath?: [number, number][];
  inboundPath?: [number, number][];
}

export interface ArrivalInfo {
  lineId: string;
  stationId: string;
  lineName: string;
  vehicleId?: string;
  nextArrivalSeconds: number;
  followingArrivalSeconds: number;
  crowdLevel: 'empty' | 'normal' | 'crowded' | 'full';
  updatedAt: number;
  source: DataSource;
}

export interface TransitSearchResult {
  type: 'line' | 'station';
  mode: TransitMode;
  id: string;
  name: string;
  subtitle?: string;
  transferLines?: string[];
}

export interface NearbyStation {
  id: string;
  name: string;
  mode: TransitMode;
  lines: string[];
  distance: number;
  lat: number;
  lng: number;
}

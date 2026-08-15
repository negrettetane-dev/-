import { apiGet, apiPost } from './apiClient';
import type { CreateTripRequest, Trip, TripMode, TripStatus } from '../types/trip';

export interface TripQuery {
  mode?: TripMode;
  status?: TripStatus;
}

export async function createTrip(request: CreateTripRequest): Promise<Trip> {
  return apiPost<Trip>('/trips', request);
}

export async function getMyTrips(query: TripQuery = {}): Promise<Trip[]> {
  const data = await apiGet<unknown>('/travel-history', {
    page: 1,
    page_size: 100,
  });
  return extractHistoryRows(data)
    .map(normalizeHistoryTrip)
    .filter((trip): trip is Trip => Boolean(trip))
    .filter(trip => !query.mode || trip.mode === query.mode)
    .filter(trip => !query.status || trip.status === query.status);
}

export async function getTrip(tripId: string): Promise<Trip> {
  // 后端提供 GET /api/trips/{trip_id}，仅本人可查（越权返回 404）
  return apiGet<Trip>(`/trips/${encodeURIComponent(tripId)}`);
}

export async function completeTrip(tripId: string): Promise<Trip> {
  return apiPost<Trip>(`/trips/${encodeURIComponent(tripId)}/complete`);
}

export async function cancelTrip(tripId: string): Promise<Trip> {
  return apiPost<Trip>(`/trips/${encodeURIComponent(tripId)}/cancel`);
}

type HistoryRow = Record<string, unknown>;

function extractHistoryRows(data: unknown): HistoryRow[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (!isRecord(data)) return [];
  for (const key of ['list', 'items', 'records', 'history', 'rows']) {
    const value = data[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

/** 读取一个地点：优先后端 camelCase 的 origin/destination 对象，兼容旧扁平 snake_case 字段 */
function readLocation(row: HistoryRow, key: 'origin' | 'destination'): Trip['origin'] {
  const nested = row[key];
  const prefix = key === 'origin' ? 'start' : 'end';
  if (isRecord(nested)) {
    const obj = nested as HistoryRow;
    return {
      name: stringValue(obj.name) || (key === 'origin' ? '起点' : '终点'),
      address: stringValue(obj.address),
      lng: numberValue(obj.lng),
      lat: numberValue(obj.lat),
    };
  }
  return {
    name: stringValue(row[`${key}_name`] ?? row[`${prefix}_name`] ?? nested) || (key === 'origin' ? '起点' : '终点'),
    address: stringValue(row[`${key}_address`] ?? row[`${prefix}_address`]),
    lng: numberValue(row[`${key}_lng`] ?? row[`${prefix}_lng`]),
    lat: numberValue(row[`${key}_lat`] ?? row[`${prefix}_lat`]),
  };
}

function normalizeHistoryTrip(row: HistoryRow): Trip | null {
  const id = stringValue(row.id ?? row.trip_id ?? row.history_id ?? row.log_id);
  if (!id) return null;

  const mode = normalizeMode(row.mode ?? row.transport_type ?? row.travel_mode);
  const startedAt = dateValue(row.startedAt ?? row.started_at ?? row.start_time ?? row.createdAt ?? row.created_at);
  const endedAt = nullableDateValue(row.endedAt ?? row.ended_at ?? row.end_time ?? row.completedAt ?? row.completed_at);
  const estimatedDistance = numberValue(row.estimatedDistance ?? row.estimated_distance ?? row.distance ?? row.distance_meters);
  const estimatedDuration = numberValue(row.estimatedDuration ?? row.estimated_duration ?? row.duration ?? row.duration_seconds);

  const dataSourceRaw = row.dataSource ?? row.data_source;
  const dataSource: Trip['dataSource'] =
    dataSourceRaw === 'estimated' || dataSourceRaw === 'demo' ? dataSourceRaw : 'real';

  return {
    id,
    clientSessionId: stringValue(row.clientSessionId ?? row.client_session_id) || `history_${id}`,
    mode,
    profile: row.profile === 'ev' || row.profile === 'accessible' ? row.profile : 'standard',
    origin: readLocation(row, 'origin'),
    destination: readLocation(row, 'destination'),
    startedAt,
    endedAt,
    estimatedDistance,
    estimatedDuration,
    actualDistance: nullableNumberValue(row.actualDistance ?? row.actual_distance),
    actualDuration: nullableNumberValue(row.actualDuration ?? row.actual_duration),
    status: normalizeStatus(row.status, endedAt),
    routeProvider: 'amap',
    providerRouteId: stringValue(row.providerRouteId ?? row.provider_route_id) || undefined,
    carbonSaved: numberValue(row.carbonSaved ?? row.carbon_saved),
    earnedPoints: numberValue(row.earnedPoints ?? row.earned_points ?? row.points),
    dataSource,
    createdAt: dateValue(row.createdAt ?? row.created_at ?? startedAt),
  };
}

function isRecord(value: unknown): value is HistoryRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumberValue(value: unknown): number | null {
  return value == null ? null : numberValue(value);
}

function dateValue(value: unknown): string {
  const date = value ? new Date(value as string | number) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function nullableDateValue(value: unknown): string | null {
  return value == null ? null : dateValue(value);
}

function normalizeMode(value: unknown): TripMode {
  const mode = stringValue(value).toLowerCase();
  // 兼容 legacy（drive/bus/bike/walk）与用户层 canonical（driving/transit/riding/walking）
  if (mode.includes('transit') || mode.includes('bus') || mode.includes('metro') || mode.includes('subway') || mode.includes('公交') || mode.includes('地铁')) return 'bus';
  if (mode.includes('riding') || mode.includes('bike') || mode.includes('cycle') || mode.includes('骑')) return 'bike';
  if (mode.includes('walking') || mode.includes('walk') || mode.includes('步行')) return 'walk';
  return 'drive';
}

function normalizeStatus(value: unknown, endedAt: string | null): TripStatus {
  const status = stringValue(value).toLowerCase();
  if (status === 'cancelled' || status === 'canceled' || status.includes('取消')) return 'cancelled';
  if (status === 'in_progress' || status === 'active' || status.includes('进行')) return 'in_progress';
  return endedAt || status === 'completed' || status.includes('完成') ? 'completed' : 'completed';
}

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
  const trips = await getMyTrips();
  const trip = trips.find(item => item.id === tripId);
  if (!trip) throw new Error('出行记录不存在或您无权查看');
  return trip;
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
  for (const key of ['list', 'items', 'records', 'history']) {
    const value = data[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function normalizeHistoryTrip(row: HistoryRow): Trip | null {
  const id = stringValue(row.id ?? row.history_id ?? row.log_id);
  if (!id) return null;

  const mode = normalizeMode(row.mode ?? row.transport_type ?? row.travel_mode);
  const startedAt = dateValue(row.started_at ?? row.start_time ?? row.created_at ?? row.createdAt);
  const endedAt = nullableDateValue(row.ended_at ?? row.end_time ?? row.completed_at);
  const estimatedDistance = numberValue(row.estimated_distance ?? row.distance ?? row.distance_meters);
  const estimatedDuration = numberValue(row.estimated_duration ?? row.duration ?? row.duration_seconds);

  return {
    id,
    clientSessionId: stringValue(row.client_session_id) || `history_${id}`,
    mode,
    profile: row.profile === 'ev' || row.profile === 'accessible' ? row.profile : 'standard',
    origin: {
      name: stringValue(row.origin_name ?? row.start_name ?? row.origin) || '起点',
      address: stringValue(row.origin_address ?? row.start_address ?? row.start_name) || '',
      lng: numberValue(row.origin_lng ?? row.start_lng),
      lat: numberValue(row.origin_lat ?? row.start_lat),
    },
    destination: {
      name: stringValue(row.destination_name ?? row.end_name ?? row.destination) || '终点',
      address: stringValue(row.destination_address ?? row.end_address ?? row.end_name) || '',
      lng: numberValue(row.destination_lng ?? row.end_lng),
      lat: numberValue(row.destination_lat ?? row.end_lat),
    },
    startedAt,
    endedAt,
    estimatedDistance,
    estimatedDuration,
    actualDistance: nullableNumberValue(row.actual_distance),
    actualDuration: nullableNumberValue(row.actual_duration),
    status: normalizeStatus(row.status, endedAt),
    routeProvider: 'amap',
    providerRouteId: stringValue(row.provider_route_id) || undefined,
    carbonSaved: numberValue(row.carbon_saved),
    earnedPoints: numberValue(row.earned_points ?? row.points),
    dataSource: row.data_source === 'estimated' || row.data_source === 'demo' ? row.data_source : 'real',
    createdAt: dateValue(row.created_at ?? startedAt),
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
  if (mode.includes('bus') || mode.includes('metro') || mode.includes('公交') || mode.includes('地铁')) return 'bus';
  if (mode.includes('bike') || mode.includes('cycle') || mode.includes('骑')) return 'bike';
  if (mode.includes('walk') || mode.includes('步行')) return 'walk';
  return 'drive';
}

function normalizeStatus(value: unknown, endedAt: string | null): TripStatus {
  const status = stringValue(value).toLowerCase();
  if (status === 'cancelled' || status === 'canceled' || status.includes('取消')) return 'cancelled';
  if (status === 'in_progress' || status === 'active' || status.includes('进行')) return 'in_progress';
  return endedAt || status === 'completed' || status.includes('完成') ? 'completed' : 'completed';
}

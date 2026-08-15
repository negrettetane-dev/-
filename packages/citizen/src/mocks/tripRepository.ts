import type { CreateTripRequest, Trip, TripMode } from '../types/trip';

const keyFor = (userId: string) => `zhitu_mock_trips:${userId}`;

function read(userId: string): Trip[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? JSON.parse(raw) as Trip[] : [];
  } catch {
    return [];
  }
}

function write(userId: string, trips: Trip[]) {
  localStorage.setItem(keyFor(userId), JSON.stringify(trips));
}

function rewardFor(mode: TripMode, distance: number) {
  if (mode === 'drive') return { carbonSaved: 0, earnedPoints: 0 };
  const km = distance / 1000;
  const factor = mode === 'bus' ? 65 : mode === 'bike' ? 120 : 150;
  return {
    carbonSaved: Math.round(km * factor),
    earnedPoints: Math.max(1, Math.min(100, Math.round(km * (mode === 'bus' ? 2 : 4)))),
  };
}

export function listMockTrips(userId: string): Trip[] {
  return read(userId).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export function findMockTrip(userId: string, tripId: string): Trip | null {
  return read(userId).find(trip => trip.id === tripId) ?? null;
}

export function createMockTrip(userId: string, request: CreateTripRequest): Trip {
  const trips = read(userId);
  const existing = trips.find(trip => trip.clientSessionId === request.clientSessionId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const trip: Trip = {
    id: `trip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    clientSessionId: request.clientSessionId,
    mode: request.mode,
    profile: request.profile,
    origin: request.origin,
    destination: request.destination,
    startedAt: now,
    endedAt: null,
    estimatedDistance: request.routeSnapshot.estimatedDistance,
    estimatedDuration: request.routeSnapshot.estimatedDuration,
    actualDistance: null,
    actualDuration: null,
    status: 'in_progress',
    routeProvider: request.routeSnapshot.routeProvider,
    providerRouteId: request.routeSnapshot.providerRouteId,
    path: request.routeSnapshot.path,
    carbonSaved: 0,
    earnedPoints: 0,
    dataSource: request.dataSource,
    createdAt: now,
  };
  write(userId, [trip, ...trips]);
  return trip;
}

export function finishMockTrip(userId: string, tripId: string, status: 'completed' | 'cancelled'): Trip | null {
  const trips = read(userId);
  const index = trips.findIndex(trip => trip.id === tripId);
  if (index < 0) return null;
  const current = trips[index];
  if (current.status !== 'in_progress') return current;
  const endedAt = new Date().toISOString();
  const reward = status === 'completed' ? rewardFor(current.mode, current.estimatedDistance) : { carbonSaved: 0, earnedPoints: 0 };
  const updated: Trip = {
    ...current,
    status,
    endedAt,
    actualDistance: status === 'completed' ? current.estimatedDistance : null,
    actualDuration: status === 'completed' ? current.estimatedDuration : null,
    ...reward,
  };
  trips[index] = updated;
  write(userId, trips);
  return updated;
}

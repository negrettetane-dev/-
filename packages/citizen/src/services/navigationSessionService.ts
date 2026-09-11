import type { PlannedRoute } from './routePlanningService';
import type { UnifiedLocation } from '../stores/travelLocationStore';
import type { TravelStage, TravelStageNavigationSnapshot } from '../types/travelStage';
import { apiGet, apiPatch, apiPost } from './apiClient';

export type NavigationSyncState = 'synced' | 'pending' | 'offline' | 'error';
export type NavigationServerStatus = 'navigating' | 'paused' | 'completed' | 'ended';

export interface NavigationSessionInput {
  clientSessionId: string;
  routeFingerprint: string;
  routeMode: PlannedRoute['mode'];
  origin: UnifiedLocation;
  destination: UnifiedLocation;
  route: PlannedRoute;
  stages: TravelStage[];
}

export interface NavigationLocationInput {
  lng: number;
  lat: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface NavigationSessionRemote {
  serverSessionId: string;
  clientSessionId: string;
  routeFingerprint: string;
  routeMode: PlannedRoute['mode'];
  origin: UnifiedLocation;
  destination: UnifiedLocation;
  route: PlannedRoute;
  stages: TravelStage[];
  currentStageIndex: number;
  navStatus: NavigationServerStatus;
  completedStageIds: string[];
  updatedAt: number;
  version?: number;
}

export interface NavigationLocationResponse {
  accepted?: boolean;
  offRoute?: boolean;
  off_route?: boolean;
  arrivedAtStage?: boolean;
  arrived_at_stage?: boolean;
  distanceToStageEndMeters?: number | null;
  distance_to_stage_end_meters?: number | null;
}

export interface NavigationSessionResponse {
  sessionId?: string;
  serverSessionId?: string;
  clientSessionId?: string;
  routeFingerprint?: string;
  routeMode?: PlannedRoute['mode'];
  origin?: UnifiedLocation;
  destination?: UnifiedLocation;
  route?: PlannedRoute;
  routeSnapshot?: PlannedRoute;
  stages?: TravelStage[];
  currentStageIndex?: number;
  current_stage_index?: number;
  status?: NavigationServerStatus;
  navStatus?: NavigationServerStatus;
  nav_status?: NavigationServerStatus;
  completedStageIds?: string[];
  completed_stage_ids?: string[];
  updatedAt?: number | string;
  updated_at?: number | string;
  version?: number;
}

function numberTime(value: unknown): number {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeStage(stage: any, index: number): TravelStage {
  return {
    ...stage,
    id: String(stage.id || stage.stageId || stage.stage_id || `stage-${index}`),
    index,
    kind: stage.kind || stage.type || 'walk',
    name: stage.name || stage.title || '路线阶段',
    distanceMeters: stage.distanceMeters ?? stage.distance_meters ?? stage.distance ?? null,
    durationSeconds: stage.durationSeconds ?? stage.duration_seconds ?? stage.duration ?? null,
    nextAction: stage.nextAction || stage.next_action || '继续前进',
    status: stage.status || 'pending',
    startCoord: stage.startCoord || stage.start_coord,
    endCoord: stage.endCoord || stage.end_coord,
    lineName: stage.lineName || stage.line_name,
    lineId: stage.lineId || stage.line_id,
    fromStation: stage.fromStation || stage.from_station,
    fromStationId: stage.fromStationId || stage.from_station_id,
    toStation: stage.toStation || stage.to_station,
    toStationId: stage.toStationId || stage.to_station_id,
    stationCount: stage.stationCount ?? stage.station_count,
    autoComplete: Boolean(stage.autoComplete ?? stage.auto_complete),
    requiresConfirmation: Boolean(stage.requiresConfirmation ?? stage.requires_confirmation),
  };
}

export function normalizeNavigationSession(data: NavigationSessionResponse, fallback?: NavigationSessionInput): NavigationSessionRemote {
  const stages = (data.stages || fallback?.stages || []).map(normalizeStage);
  const completedStageIds = data.completedStageIds || data.completed_stage_ids || stages.filter(stage => stage.status === 'completed').map(stage => stage.id);
  const rawCurrentStageIndex = data.currentStageIndex ?? data.current_stage_index ?? Math.max(0, stages.findIndex(stage => !completedStageIds.includes(stage.id)));
  const currentStageIndex = stages.length ? Math.min(Math.max(0, rawCurrentStageIndex), stages.length - 1) : 0;
  return {
    serverSessionId: String(data.serverSessionId || data.sessionId || fallback?.clientSessionId || ''),
    clientSessionId: String(data.clientSessionId || fallback?.clientSessionId || ''),
    routeFingerprint: String(data.routeFingerprint || fallback?.routeFingerprint || ''),
    routeMode: data.routeMode || fallback?.routeMode || 'walk',
    origin: data.origin || fallback?.origin || ({} as UnifiedLocation),
    destination: data.destination || fallback?.destination || ({} as UnifiedLocation),
    route: data.route || data.routeSnapshot || fallback?.route || ({} as PlannedRoute),
    stages,
    currentStageIndex: currentStageIndex < 0 ? 0 : currentStageIndex,
    navStatus: data.navStatus || data.nav_status || data.status || 'navigating',
    completedStageIds,
    updatedAt: numberTime(data.updatedAt ?? data.updated_at),
    version: data.version,
  };
}

function toPayload(input: NavigationSessionInput) {
  return {
    clientSessionId: input.clientSessionId,
    client_session_id: input.clientSessionId,
    routeFingerprint: input.routeFingerprint,
    routeMode: input.routeMode,
    origin: input.origin,
    destination: input.destination,
    route: input.route,
    routeSnapshot: input.route,
    stages: input.stages,
    currentStageIndex: 0,
    status: 'navigating',
  };
}

export async function createNavigationSession(input: NavigationSessionInput): Promise<NavigationSessionRemote> {
  const data = await apiPost<NavigationSessionResponse>('/navigation-sessions', toPayload(input));
  return normalizeNavigationSession(data, input);
}

export async function getNavigationSession(sessionId: string, fallback?: NavigationSessionInput): Promise<NavigationSessionRemote> {
  const data = await apiGet<NavigationSessionResponse>(`/navigation-sessions/${encodeURIComponent(sessionId)}`);
  return normalizeNavigationSession(data, fallback);
}

export async function patchNavigationProgress(sessionId: string, patch: { currentStageIndex: number; completedStageIds: string[]; status: NavigationServerStatus; completionSource?: string; location?: NavigationLocationInput }, fallback?: NavigationSessionInput): Promise<NavigationSessionRemote> {
  const data = await apiPatch<NavigationSessionResponse>(`/navigation-sessions/${encodeURIComponent(sessionId)}/progress`, patch);
  return normalizeNavigationSession(data, fallback);
}

export async function pauseNavigationSession(sessionId: string): Promise<NavigationSessionRemote> {
  return normalizeNavigationSession(await apiPost<NavigationSessionResponse>(`/navigation-sessions/${encodeURIComponent(sessionId)}/pause`));
}

export async function resumeNavigationSession(sessionId: string): Promise<NavigationSessionRemote> {
  return normalizeNavigationSession(await apiPost<NavigationSessionResponse>(`/navigation-sessions/${encodeURIComponent(sessionId)}/resume`));
}

export async function endNavigationSession(sessionId: string, reason = 'user_exit'): Promise<NavigationSessionRemote> {
  return normalizeNavigationSession(await apiPost<NavigationSessionResponse>(`/navigation-sessions/${encodeURIComponent(sessionId)}/end`, { reason }));
}

export async function reportNavigationLocation(sessionId: string, location: NavigationLocationInput, currentStageIndex: number): Promise<NavigationLocationResponse> {
  const data = await apiPost<NavigationLocationResponse>(`/navigation-sessions/${encodeURIComponent(sessionId)}/locations`, {
    eventId: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `location_${Date.now()}`,
    stageIndex: currentStageIndex,
    ...location,
  });
  return data;
}

export async function reportNavigationOffRoute(sessionId: string, payload: { stageId: string; location: NavigationLocationInput; distanceFromRouteMeters?: number }): Promise<NavigationSessionRemote | null> {
  const data = await apiPost<NavigationSessionResponse | null>(`/navigation-sessions/${encodeURIComponent(sessionId)}/off-route`, payload);
  return data ? normalizeNavigationSession(data) : null;
}

export async function replanNavigationSession(sessionId: string, payload: unknown): Promise<NavigationSessionRemote> {
  return normalizeNavigationSession(await apiPost<NavigationSessionResponse>(`/navigation-sessions/${encodeURIComponent(sessionId)}/replan`, payload));
}

export function snapshotFromRemote(remote: NavigationSessionRemote, input: NavigationSessionInput, existing?: TravelStageNavigationSnapshot): TravelStageNavigationSnapshot {
  return {
    version: 1,
    sessionId: existing?.sessionId || input.clientSessionId,
    serverSessionId: remote.serverSessionId,
    clientSessionId: remote.clientSessionId || input.clientSessionId,
    routeFingerprint: remote.routeFingerprint || input.routeFingerprint,
    origin: remote.origin || input.origin,
    destination: remote.destination || input.destination,
    routeMode: remote.routeMode || input.routeMode,
    route: remote.route || input.route,
    stages: remote.stages.length ? remote.stages : input.stages,
    currentStageIndex: remote.currentStageIndex,
    navStatus: remote.navStatus,
    reminderKeys: existing?.reminderKeys || [],
    updatedAt: remote.updatedAt,
    syncState: 'synced',
    lastSyncAt: Date.now(),
    lastError: undefined,
  } as TravelStageNavigationSnapshot;
}

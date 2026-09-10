import type { UnifiedLocation } from '../stores/travelLocationStore';
import type { PlannedRoute } from '../services/routePlanningService';

export type TravelStageKind = 'walk' | 'bus' | 'metro' | 'transfer' | 'arrive';
export type TravelStageStatus = 'pending' | 'current' | 'completed';
export type StageCompletionSource = 'manual' | 'location' | 'confirmation' | 'system';

export interface TravelStage {
  id: string;
  index: number;
  kind: TravelStageKind;
  name: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  nextAction: string;
  status: TravelStageStatus;
  completionSource?: StageCompletionSource;
  completedAt?: number;
  startCoord?: [number, number];
  endCoord?: [number, number];
  path?: [number, number][];
  lineName?: string;
  fromStation?: string;
  toStation?: string;
  stationCount?: number;
  autoComplete: boolean;
  requiresConfirmation: boolean;
}

export interface TravelStageNavigationSnapshot {
  version: 1;
  sessionId: string;
  routeFingerprint: string;
  origin: UnifiedLocation;
  destination: UnifiedLocation;
  routeMode: PlannedRoute['mode'];
  route: PlannedRoute;
  stages: TravelStage[];
  currentStageIndex: number;
  navStatus: 'navigating' | 'paused' | 'completed' | 'ended';
  reminderKeys: string[];
  updatedAt: number;
  serverSessionId?: string;
  clientSessionId?: string;
  syncState?: 'synced' | 'pending' | 'offline' | 'error';
  lastSyncAt?: number;
  lastError?: string;
  lastLocationAt?: number;
}

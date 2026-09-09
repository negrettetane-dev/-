import type { ChargingQrPayload } from './chargingScanService';

export type ChargingSessionStatus = 'ready' | 'starting' | 'charging' | 'stopping' | 'completed';

export interface ChargingSessionStation {
  stationId?: string;
  stationName?: string;
  operator?: string;
  address?: string;
}

export interface ChargingSession {
  id: string;
  payload: ChargingQrPayload;
  station: ChargingSessionStation;
  status: ChargingSessionStatus;
  createdAt: number;
  startedAt?: number;
  stoppedAt?: number;
}

export interface ChargingSessionMetrics {
  elapsedSeconds: number;
  energyKwh: number;
  amount: number;
  powerKw: number;
}

const DEMO_SESSION_KEY = 'zhitu_demo_charging_session';
const DEMO_ENERGY_PER_SECOND = 0.012;

export function createChargingSession(payload: ChargingQrPayload, station: ChargingSessionStation): ChargingSession {
  const session: ChargingSession = {
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    station,
    status: 'ready',
    createdAt: Date.now(),
  };
  sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getChargingSession(): ChargingSession | null {
  const raw = sessionStorage.getItem(DEMO_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChargingSession;
  } catch {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    return null;
  }
}

export function updateChargingSession(session: ChargingSession): ChargingSession {
  sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearChargingSession(): void {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}

export function getChargingMetrics(session: ChargingSession, now = Date.now()): ChargingSessionMetrics {
  const startedAt = session.startedAt ?? now;
  const endAt = session.stoppedAt ?? now;
  const elapsedSeconds = session.status === 'ready' || session.status === 'starting'
    ? 0
    : Math.max(0, Math.floor((endAt - startedAt) / 1000));
  const energyKwh = Number((elapsedSeconds * DEMO_ENERGY_PER_SECOND).toFixed(2));
  const amount = Number((energyKwh * session.payload.price.amount).toFixed(2));
  return {
    elapsedSeconds,
    energyKwh,
    amount,
    powerKw: session.payload.powerKw,
  };
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分 ${String(remainingSeconds).padStart(2, '0')}秒`;
}

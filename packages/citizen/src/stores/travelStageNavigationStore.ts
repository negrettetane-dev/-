import { create } from 'zustand';
import type { TravelStage, StageCompletionSource, TravelStageNavigationSnapshot } from '../types/travelStage';
import {
  createNavigationSession,
  patchNavigationProgress,
  pauseNavigationSession,
  resumeNavigationSession,
  endNavigationSession,
  reportNavigationLocation,
  snapshotFromRemote,
  type NavigationLocationInput,
  type NavigationSessionInput,
  type NavigationSyncState,
} from '../services/navigationSessionService';

const SESSION_KEY = 'zhitu_travel_stage_navigation';
const LAST_KEY = 'zhitu_travel_stage_navigation_last';

function readSnapshot(): TravelStageNavigationSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as TravelStageNavigationSnapshot;
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.stages) || !snapshot.routeFingerprint) return null;
    return snapshot;
  } catch { return null; }
}

function writeSnapshot(snapshot: TravelStageNavigationSnapshot | null) {
  try {
    if (!snapshot) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    const serialized = JSON.stringify(snapshot);
    sessionStorage.setItem(SESSION_KEY, serialized);
    localStorage.setItem(LAST_KEY, serialized);
  } catch { /* ignore storage failures */ }
}

function markCurrent(stages: TravelStage[], index: number): TravelStage[] {
  return stages.map((stage, stageIndex) => ({
    ...stage,
    status: stage.status === 'completed' ? 'completed' : stageIndex === index ? 'current' : 'pending',
  }));
}

function updateSnapshot(snapshot: TravelStageNavigationSnapshot, patch: Partial<TravelStageNavigationSnapshot>) {
  const next = { ...snapshot, ...patch, updatedAt: Date.now() };
  writeSnapshot(next);
  return next;
}

function syncFailure(snapshot: TravelStageNavigationSnapshot, error: unknown): TravelStageNavigationSnapshot {
  const message = error instanceof Error ? error.message : '云端同步失败';
  return updateSnapshot(snapshot, { syncState: snapshot.serverSessionId ? 'error' : 'offline', lastError: message });
}

interface TravelStageNavigationState {
  snapshot: TravelStageNavigationSnapshot | null;
  startNavigation: (input: Omit<TravelStageNavigationSnapshot, 'version' | 'navStatus' | 'reminderKeys' | 'updatedAt' | 'currentStageIndex'>) => Promise<void>;
  completeCurrentStage: (source: StageCompletionSource, location?: NavigationLocationInput) => Promise<void>;
  confirmCurrentStage: () => Promise<void>;
  pauseNavigation: () => Promise<void>;
  resumeNavigation: () => Promise<void>;
  endNavigation: (reason?: string) => Promise<void>;
  reportLocation: (location: NavigationLocationInput) => Promise<void>;
  addReminder: (key: string) => void;
  restoreIfMatching: (routeFingerprint: string) => boolean;
  clear: () => void;
}

function makeInput(input: Omit<TravelStageNavigationSnapshot, 'version' | 'navStatus' | 'reminderKeys' | 'updatedAt' | 'currentStageIndex'>): NavigationSessionInput {
  return {
    clientSessionId: input.clientSessionId || input.sessionId,
    routeFingerprint: input.routeFingerprint,
    routeMode: input.routeMode,
    origin: input.origin,
    destination: input.destination,
    route: input.route,
    stages: input.stages,
  };
}

export const useTravelStageNavigationStore = create<TravelStageNavigationState>((set, get) => ({
  snapshot: readSnapshot(),

  startNavigation: async (input) => {
    const stages = markCurrent(input.stages.map(stage => ({ ...stage, status: 'pending' })), 0);
    const base: TravelStageNavigationSnapshot = {
      ...input,
      version: 1,
      clientSessionId: input.clientSessionId || input.sessionId,
      stages,
      currentStageIndex: 0,
      navStatus: 'navigating',
      reminderKeys: [],
      syncState: 'pending',
      updatedAt: Date.now(),
    };
    writeSnapshot(base);
    set({ snapshot: base });

    try {
      const remote = await createNavigationSession(makeInput(base));
      const synced = snapshotFromRemote(remote, makeInput(base), base);
      writeSnapshot(synced);
      set({ snapshot: synced });
    } catch (error) {
      const offline = syncFailure(base, error);
      set({ snapshot: offline });
    }
  },

  completeCurrentStage: async (source, location) => {
    const current = get().snapshot;
    if (!current || current.navStatus !== 'navigating') return;
    const stage = current.stages[current.currentStageIndex];
    if (!stage || stage.status === 'completed') return;
    const stages = current.stages.map((item, index) => index === current.currentStageIndex
      ? { ...item, status: 'completed' as const, completionSource: source, completedAt: Date.now() }
      : item);
    const isLast = current.currentStageIndex >= stages.length - 1;
    const nextIndex = isLast ? current.currentStageIndex : current.currentStageIndex + 1;
    const optimistic = updateSnapshot(current, {
      stages: isLast ? stages : markCurrent(stages, nextIndex),
      currentStageIndex: nextIndex,
      navStatus: isLast ? 'completed' : 'navigating',
      syncState: current.serverSessionId ? 'pending' : current.syncState,
      lastLocationAt: location?.timestamp,
    });
    set({ snapshot: optimistic });

    if (!optimistic.serverSessionId) return;
    try {
      const remote = await patchNavigationProgress(optimistic.serverSessionId, {
        currentStageIndex: optimistic.currentStageIndex,
        completedStageIds: optimistic.stages.filter(item => item.status === 'completed').map(item => item.id),
        status: optimistic.navStatus,
        completionSource: source,
        location,
      });
      const synced = snapshotFromRemote(remote, makeInput(optimistic), optimistic);
      writeSnapshot(synced);
      set({ snapshot: synced });
    } catch (error) {
      set({ snapshot: syncFailure(optimistic, error) });
    }
  },

  confirmCurrentStage: async () => get().completeCurrentStage('confirmation'),

  pauseNavigation: async () => {
    const current = get().snapshot;
    if (!current || current.navStatus !== 'navigating') return;
    const optimistic = updateSnapshot(current, { navStatus: 'paused', syncState: current.serverSessionId ? 'pending' : current.syncState });
    set({ snapshot: optimistic });
    if (!optimistic.serverSessionId) return;
    try {
      const synced = snapshotFromRemote(await pauseNavigationSession(optimistic.serverSessionId), makeInput(optimistic), optimistic);
      writeSnapshot(synced); set({ snapshot: synced });
    } catch (error) { set({ snapshot: syncFailure(optimistic, error) }); }
  },

  resumeNavigation: async () => {
    const current = get().snapshot;
    if (!current || current.navStatus !== 'paused') return;
    const optimistic = updateSnapshot(current, { navStatus: 'navigating', syncState: current.serverSessionId ? 'pending' : current.syncState });
    set({ snapshot: optimistic });
    if (!optimistic.serverSessionId) return;
    try {
      const synced = snapshotFromRemote(await resumeNavigationSession(optimistic.serverSessionId), makeInput(optimistic), optimistic);
      writeSnapshot(synced); set({ snapshot: synced });
    } catch (error) { set({ snapshot: syncFailure(optimistic, error) }); }
  },

  endNavigation: async (reason = 'user_exit') => {
    const current = get().snapshot;
    if (!current) return;
    const optimistic = updateSnapshot(current, { navStatus: current.navStatus === 'completed' ? 'completed' : 'ended', syncState: current.serverSessionId ? 'pending' : current.syncState });
    set({ snapshot: optimistic });
    if (!optimistic.serverSessionId) return;
    try {
      const synced = snapshotFromRemote(await endNavigationSession(optimistic.serverSessionId, reason), makeInput(optimistic), optimistic);
      writeSnapshot(synced); set({ snapshot: synced });
    } catch (error) { set({ snapshot: syncFailure(optimistic, error) }); }
  },

  reportLocation: async (location) => {
    const current = get().snapshot;
    if (!current || !current.serverSessionId || current.navStatus !== 'navigating') return;
    const optimistic = updateSnapshot(current, { lastLocationAt: location.timestamp, syncState: 'pending' });
    set({ snapshot: optimistic });
    try {
      await reportNavigationLocation(current.serverSessionId, location, current.currentStageIndex);
      const synced = updateSnapshot(get().snapshot || optimistic, { syncState: 'synced', lastSyncAt: Date.now(), lastError: undefined });
      set({ snapshot: synced });
    } catch (error) { set({ snapshot: syncFailure(optimistic, error) }); }
  },

  addReminder: (key) => {
    const current = get().snapshot;
    if (!current || current.reminderKeys.includes(key)) return;
    const next = updateSnapshot(current, { reminderKeys: [...current.reminderKeys, key] });
    set({ snapshot: next });
  },

  restoreIfMatching: (routeFingerprint) => {
    const current = get().snapshot;
    if (!current || current.routeFingerprint !== routeFingerprint || current.navStatus === 'completed') return false;
    const next = current.navStatus === 'ended' ? updateSnapshot(current, { navStatus: 'paused' }) : current;
    writeSnapshot(next); set({ snapshot: next }); return true;
  },

  clear: () => {
    writeSnapshot(null);
    try { localStorage.removeItem(LAST_KEY); } catch { /* ignore */ }
    set({ snapshot: null });
  },
}));

export type { NavigationSyncState };

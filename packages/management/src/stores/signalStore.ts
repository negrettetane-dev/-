import { create } from 'zustand';
import type { MockIntersection } from '../mocks/mockData';
import type { IntersectionDetail, SignalPhase } from '../services/signalService';
import { signalService } from '../services/signalService';

interface SignalState {
  intersections: MockIntersection[];
  selectedIntersection: IntersectionDetail | null;
  loading: boolean;

  fetchList: () => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  updatePhases: (phases: SignalPhase[]) => Promise<void>;
}

export const useSignalStore = create<SignalState>((set, get) => ({
  intersections: [],
  selectedIntersection: null,
  loading: false,

  fetchList: async () => {
    set({ loading: true });
    try { set({ intersections: await signalService.getList(), loading: false }); }
    catch { set({ intersections: [], loading: false }); }
  },

  fetchById: async (id: string) => {
    set({ loading: true });
    try { set({ selectedIntersection: await signalService.getById(id), loading: false }); }
    catch { set({ selectedIntersection: null, loading: false }); }
  },

  updatePhases: async (phases) => {
    set({ loading: true });
    const id = get().selectedIntersection?.id || '';
    if (id) await signalService.updatePhases(id, phases);
    set((state) => ({
      selectedIntersection: state.selectedIntersection
        ? { ...state.selectedIntersection, phases }
        : null,
      loading: false,
    }));
  },
}));

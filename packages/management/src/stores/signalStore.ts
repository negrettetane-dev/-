import { create } from 'zustand';
import type { MockIntersection } from '../mocks/mockData';
import type { IntersectionDetail, SignalPhase } from '../services/signalService';
import { generateIntersections, generatePhases } from '../mocks/mockData';

interface SignalState {
  intersections: MockIntersection[];
  selectedIntersection: IntersectionDetail | null;
  loading: boolean;

  fetchList: () => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  updatePhases: (phases: SignalPhase[]) => Promise<void>;
}

export const useSignalStore = create<SignalState>((set) => ({
  intersections: [],
  selectedIntersection: null,
  loading: false,

  fetchList: async () => {
    set({ loading: true });
    await new Promise((r) => setTimeout(r, 400));
    set({ intersections: generateIntersections(), loading: false });
  },

  fetchById: async (id: string) => {
    set({ loading: true });
    await new Promise((r) => setTimeout(r, 300));
    const intersections = generateIntersections();
    const found = intersections.find((i) => i.id === id) || intersections[0];
    const phases = generatePhases(found.id, found.phaseCount);
    set({ selectedIntersection: { ...found, phases }, loading: false });
  },

  updatePhases: async (phases) => {
    set({ loading: true });
    await new Promise((r) => setTimeout(r, 300));
    set((state) => ({
      selectedIntersection: state.selectedIntersection
        ? { ...state.selectedIntersection, phases }
        : null,
      loading: false,
    }));
  },
}));

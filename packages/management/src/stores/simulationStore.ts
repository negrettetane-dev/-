import { create } from 'zustand';
import type { MockScenario } from '../mocks/mockData';
import type { SimulationResults } from '../services/simulationService';
import { SIMULATION_SCENARIOS } from '../mocks/mockData';

type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed';

interface SimulationState {
  scenarios: MockScenario[];
  selectedScenario: MockScenario | null;
  status: SimulationStatus;
  sessionId: string | null;
  results: SimulationResults | null;
  progress: number; // 0-100

  fetchScenarios: () => Promise<void>;
  selectScenario: (id: string) => void;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  resetResults: () => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  scenarios: SIMULATION_SCENARIOS,
  selectedScenario: null,
  status: 'idle',
  sessionId: null,
  results: null,
  progress: 0,

  fetchScenarios: async () => {
    await new Promise((r) => setTimeout(r, 300));
    set({ scenarios: SIMULATION_SCENARIOS });
  },

  selectScenario: (id) => {
    const found = SIMULATION_SCENARIOS.find((s) => s.id === id) || null;
    set({ selectedScenario: found, results: null, progress: 0, status: 'idle' });
  },

  start: async () => {
    const { selectedScenario } = get();
    if (!selectedScenario) return;
    set({ status: 'running', sessionId: `sim-${Date.now()}`, progress: 0 });

    // Simulate progress over ~5 seconds
    const duration = selectedScenario.duration / 30; // scale down for demo
    const interval = setInterval(() => {
      const state = get();
      if (state.status !== 'running') {
        clearInterval(interval);
        return;
      }
      const newProgress = Math.min(state.progress + (100 / duration) * 0.5, 100);
      if (newProgress >= 100) {
        clearInterval(interval);
        set({
          progress: 100,
          status: 'completed',
          results: {
            avgSpeedImprovement: 15 + Math.random() * 15,
            travelTimeReduction: 18 + Math.random() * 15,
            queueLengthReduction: 25 + Math.random() * 20,
            congestionIndexChange: -(1 + Math.random() * 3),
            fuelSaving: `约${Math.floor(8 + Math.random() * 20)}千升/月`,
          },
        });
      } else {
        set({ progress: newProgress });
      }
    }, 200);
  },

  pause: () => set({ status: 'paused' }),
  resume: () => set({ status: 'running' }),
  stop: () => set({ status: 'idle', results: null, progress: 0, sessionId: null }),
  resetResults: () => set({ results: null, progress: 0, status: 'idle' }),
}));

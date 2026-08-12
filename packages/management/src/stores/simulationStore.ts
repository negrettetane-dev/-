import { create } from 'zustand';
import type { MockScenario } from '../mocks/mockData';
import type { SimulationResults } from '../services/simulationService';
import { SIMULATION_SCENARIOS } from '../mocks/mockData';
import { simulationService } from '../services/simulationService';

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
    try { set({ scenarios: await simulationService.getScenarios() }); }
    catch { set({ scenarios: [] }); }
  },

  selectScenario: (id) => {
    const found = get().scenarios.find((s) => s.id === id) || null;
    set({ selectedScenario: found, results: null, progress: 0, status: 'idle' });
  },

  start: async () => {
    const { selectedScenario } = get();
    if (!selectedScenario) return;
    const result = await simulationService.start(selectedScenario.id, selectedScenario.parameters);
    set({ status: 'running', sessionId: result.sessionId, progress: 0 });

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
        const sessionId = get().sessionId;
        if (sessionId) {
          void simulationService.getResults(sessionId)
            .then(results => set({ progress: 100, status: 'completed', results }))
            .catch(() => set({ progress: 100, status: 'completed' }));
        }
      } else {
        set({ progress: newProgress });
      }
    }, 200);
  },

  pause: () => { void simulationService.pause(); set({ status: 'paused' }); },
  resume: () => set({ status: 'running' }),
  stop: () => { void simulationService.stop(); set({ status: 'idle', results: null, progress: 0, sessionId: null }); },
  resetResults: () => set({ results: null, progress: 0, status: 'idle' }),
}));

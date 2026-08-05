import { create } from 'zustand';
import type { MockIncident } from '../mocks/mockData';
import { generateIncidents } from '../mocks/mockData';

interface IncidentState {
  incidents: MockIncident[];
  selectedIncident: MockIncident | null;
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  filters: {
    status: string | null;
    severity: string | null;
    search: string;
  };

  fetchList: () => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  setFilters: (filters: Partial<IncidentState['filters']>) => void;
  setPage: (page: number) => void;
  updateStatus: (id: string, status: string) => Promise<void>;
}

export const useIncidentStore = create<IncidentState>((set, get) => ({
  incidents: [],
  selectedIncident: null,
  loading: false,
  total: 0,
  page: 1,
  pageSize: 10,
  filters: { status: null, severity: null, search: '' },

  fetchList: async () => {
    set({ loading: true });
    const { filters, page, pageSize } = get();
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 400));
    let list = generateIncidents();
    if (filters.status) list = list.filter((i) => i.status === filters.status);
    if (filters.severity) list = list.filter((i) => i.severity === filters.severity);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(
        (i) => i.title.includes(s) || i.roadName.includes(s) || i.id.includes(s),
      );
    }
    const total = list.length;
    const paged = list.slice((page - 1) * pageSize, page * pageSize);
    set({ incidents: paged, total, loading: false });
  },

  fetchById: async (id: string) => {
    set({ loading: true });
    await new Promise((r) => setTimeout(r, 300));
    const all = generateIncidents();
    const found = all.find((i) => i.id === id) || all[0];
    set({ selectedIncident: found, loading: false });
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      page: 1,
    }));
    get().fetchList();
  },

  setPage: (page) => {
    set({ page });
    get().fetchList();
  },

  updateStatus: async (id: string, status: string) => {
    await new Promise((r) => setTimeout(r, 300));
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === id ? { ...i, status: status as MockIncident['status'] } : i,
      ),
      selectedIncident:
        state.selectedIncident?.id === id
          ? { ...state.selectedIncident, status: status as MockIncident['status'] }
          : state.selectedIncident,
    }));
  },
}));

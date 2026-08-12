import { create } from 'zustand';
import type { MockIncident } from '../mocks/mockData';
import { incidentService } from '../services/incidentService';

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
    try {
      const data = await incidentService.getList({ page, pageSize, status: filters.status || '', severity: filters.severity || '' });
      const list = filters.search ? data.list.filter(i => `${i.title}${i.roadName}${i.id}`.includes(filters.search)) : data.list;
      set({ incidents: list, total: data.total, loading: false });
    } catch { set({ incidents: [], total: 0, loading: false }); }
  },

  fetchById: async (id: string) => {
    set({ loading: true });
    try { set({ selectedIncident: await incidentService.getById(id), loading: false }); }
    catch { set({ selectedIncident: null, loading: false }); }
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
    await incidentService.update(id, { status });
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

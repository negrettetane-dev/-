import { create } from 'zustand';
import type { MockDevice } from '../mocks/mockData';
import { deviceService } from '../services/deviceService';

interface DeviceState {
  devices: MockDevice[];
  selectedDevice: MockDevice | null;
  loading: boolean;
  total: number;
  filters: {
    status: string | null;
    type: string | null;
    search: string;
  };

  fetchList: () => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  setFilters: (filters: Partial<DeviceState['filters']>) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  selectedDevice: null,
  loading: false,
  total: 0,
  filters: { status: null, type: null, search: '' },

  fetchList: async () => {
    set({ loading: true });
    const { filters } = get();
    try {
      const data = await deviceService.getList({ page: 1, pageSize: 100, status: filters.status || '', type: filters.type || '' });
      const list = filters.search ? data.list.filter(d => `${d.name}${d.roadName}${d.id}`.includes(filters.search)) : data.list;
      set({ devices: list, total: data.total, loading: false });
    } catch { set({ devices: [], total: 0, loading: false }); }
  },

  fetchById: async (id: string) => {
    set({ loading: true });
    try { set({ selectedDevice: await deviceService.getById(id), loading: false }); }
    catch { set({ selectedDevice: null, loading: false }); }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
    get().fetchList();
  },
}));

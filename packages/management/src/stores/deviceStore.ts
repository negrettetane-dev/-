import { create } from 'zustand';
import type { MockDevice } from '../mocks/mockData';
import { generateDevices } from '../mocks/mockData';

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
    await new Promise((r) => setTimeout(r, 400));
    let list = generateDevices();
    if (filters.status) list = list.filter((d) => d.status === filters.status);
    if (filters.type) list = list.filter((d) => d.type === filters.type);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      list = list.filter((d) => d.name.includes(s) || d.roadName.includes(s) || d.id.includes(s));
    }
    set({ devices: list, total: list.length, loading: false });
  },

  fetchById: async (id: string) => {
    set({ loading: true });
    await new Promise((r) => setTimeout(r, 300));
    const all = generateDevices();
    const found = all.find((d) => d.id === id) || all[0];
    set({ selectedDevice: found, loading: false });
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
    get().fetchList();
  },
}));

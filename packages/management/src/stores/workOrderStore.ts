import { create } from 'zustand';
import type { MockWorkOrder } from '../mocks/mockData';
import { generateWorkOrders } from '../mocks/mockData';

interface WorkOrderState {
  workOrders: MockWorkOrder[];
  selectedWorkOrder: MockWorkOrder | null;
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  filters: {
    status: string | null;
  };

  fetchList: () => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  setFilters: (filters: Partial<WorkOrderState['filters']>) => void;
  setPage: (page: number) => void;
  updateStatus: (id: string, status: string) => Promise<void>;
}

export const useWorkOrderStore = create<WorkOrderState>((set, get) => ({
  workOrders: [],
  selectedWorkOrder: null,
  loading: false,
  total: 0,
  page: 1,
  pageSize: 10,
  filters: { status: null },

  fetchList: async () => {
    set({ loading: true });
    const { filters, page, pageSize } = get();
    await new Promise((r) => setTimeout(r, 400));
    let list = generateWorkOrders();
    if (filters.status) list = list.filter((w) => w.status === filters.status);
    const total = list.length;
    const paged = list.slice((page - 1) * pageSize, page * pageSize);
    set({ workOrders: paged, total, loading: false });
  },

  fetchById: async (id: string) => {
    set({ loading: true });
    await new Promise((r) => setTimeout(r, 300));
    const all = generateWorkOrders();
    const found = all.find((w) => w.id === id || w.workOrderNo === id) || all[0];
    set({ selectedWorkOrder: found, loading: false });
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters }, page: 1 }));
    get().fetchList();
  },

  setPage: (page) => {
    set({ page });
    get().fetchList();
  },

  updateStatus: async (id: string, status: string) => {
    await new Promise((r) => setTimeout(r, 300));
    set((state) => ({
      workOrders: state.workOrders.map((w) =>
        w.id === id ? { ...w, status: status as MockWorkOrder['status'], updateTime: Date.now() } : w,
      ),
      selectedWorkOrder:
        state.selectedWorkOrder?.id === id
          ? { ...state.selectedWorkOrder, status: status as MockWorkOrder['status'], updateTime: Date.now() }
          : state.selectedWorkOrder,
    }));
  },
}));

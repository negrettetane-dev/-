import { create } from 'zustand';
import type { MockWorkOrder } from '../mocks/mockData';
import { workOrderService } from '../services/workOrderService';

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
    try {
      const data = await workOrderService.getList({ page, pageSize, status: filters.status || '' });
      set({ workOrders: data.list, total: data.total, loading: false });
    } catch { set({ workOrders: [], total: 0, loading: false }); }
  },

  fetchById: async (id: string) => {
    set({ loading: true });
    try { set({ selectedWorkOrder: await workOrderService.getById(id), loading: false }); }
    catch { set({ selectedWorkOrder: null, loading: false }); }
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
    await workOrderService.update(id, { status });
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

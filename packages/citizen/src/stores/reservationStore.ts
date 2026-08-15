import { create } from 'zustand';
import type { CustomBusReservation } from '../services/customBusReservationService';

const PENDING_KEY = 'zhitu_pending_custom_bus_reservation';
const LAST_KEY = 'zhitu_last_custom_bus_reservation';

export interface PendingReservation {
  routeId: string;
  scheduleId: string;
  routeName: string;
  departureTime: string;
  boardingPoint: string;
  boardingPointId: string;
  destination: string;
  price: number;
  passengerCount: number;
  redirect: string;
}

function readPending(): PendingReservation | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) as PendingReservation : null;
  } catch {
    return null;
  }
}

function readLast(): CustomBusReservation | null {
  try {
    const raw = sessionStorage.getItem(LAST_KEY);
    return raw ? JSON.parse(raw) as CustomBusReservation : null;
  } catch {
    return null;
  }
}

interface ReservationState {
  pendingReservation: PendingReservation | null;
  /** 最近一次预约成功的记录（sessionStorage 持久化，供刷新后恢复成功页） */
  lastReservation: CustomBusReservation | null;
  reservationsCache: unknown[];
  setPendingReservation: (reservation: PendingReservation) => void;
  clearPendingReservation: () => void;
  setLastReservation: (reservation: CustomBusReservation | null) => void;
  clearLastReservation: () => void;
  setReservationsCache: (reservations: unknown[]) => void;
  clearUserReservationData: () => void;
}

export const useReservationStore = create<ReservationState>((set) => ({
  pendingReservation: readPending(),
  lastReservation: readLast(),
  reservationsCache: [],

  setPendingReservation: (reservation) => {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(reservation));
    set({ pendingReservation: reservation });
  },

  clearPendingReservation: () => {
    sessionStorage.removeItem(PENDING_KEY);
    set({ pendingReservation: null });
  },

  setLastReservation: (reservation) => {
    if (reservation) {
      sessionStorage.setItem(LAST_KEY, JSON.stringify(reservation));
    } else {
      sessionStorage.removeItem(LAST_KEY);
    }
    set({ lastReservation: reservation });
  },

  clearLastReservation: () => {
    sessionStorage.removeItem(LAST_KEY);
    set({ lastReservation: null });
  },

  setReservationsCache: (reservations) => set({ reservationsCache: reservations }),

  clearUserReservationData: () => {
    sessionStorage.removeItem(PENDING_KEY);
    sessionStorage.removeItem(LAST_KEY);
    set({ pendingReservation: null, lastReservation: null, reservationsCache: [] });
  },
}));

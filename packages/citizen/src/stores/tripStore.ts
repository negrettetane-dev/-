import { create } from 'zustand';
import type { CreateTripRequest, Trip } from '../types/trip';
import * as tripService from '../services/tripService';

interface TripState {
  trips: Trip[];
  activeTrip: Trip | null;
  loading: boolean;
  error: string;
  loadTrips: () => Promise<void>;
  startTrip: (request: CreateTripRequest) => Promise<Trip>;
  completeActiveTrip: () => Promise<Trip | null>;
  cancelActiveTrip: () => Promise<Trip | null>;
  reset: () => void;
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  activeTrip: null,
  loading: false,
  error: '',

  loadTrips: async () => {
    set({ loading: true, error: '' });
    try {
      const trips = await tripService.getMyTrips();
      set({ trips, loading: false });
    } catch (error) {
      console.error('Trip history load failed:', error);
      set({ trips: [], loading: false, error: '出行记录暂时无法加载' });
    }
  },

  startTrip: async (request) => {
    const trip = await tripService.createTrip(request);
    set(state => ({ activeTrip: trip, trips: [trip, ...state.trips.filter(item => item.id !== trip.id)] }));
    return trip;
  },

  completeActiveTrip: async () => {
    const active = get().activeTrip;
    if (!active) return null;
    const trip = await tripService.completeTrip(active.id);
    set(state => ({ activeTrip: null, trips: state.trips.map(item => item.id === trip.id ? trip : item) }));
    return trip;
  },

  cancelActiveTrip: async () => {
    const active = get().activeTrip;
    if (!active) return null;
    const trip = await tripService.cancelTrip(active.id);
    set(state => ({ activeTrip: null, trips: state.trips.map(item => item.id === trip.id ? trip : item) }));
    return trip;
  },

  reset: () => set({ trips: [], activeTrip: null, loading: false, error: '' }),
}));

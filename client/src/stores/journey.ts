import { create } from 'zustand';
import type { Stop, Route, Bus, JourneyStep, JourneyFilters } from '../types/transit';

interface JourneyState {
  step: JourneyStep;
  userLocation: { lat: number; lng: number; accuracy?: number } | null;
  originStop: Stop | null;
  destStop: Stop | null;
  destination: { name: string; lat?: number; lng?: number; stopId?: string } | null;
  selectedStop: Stop | null;
  selectedRoute: Route | null;
  selectedBus: Bus | null;
  trackedBusId: string | null;
  trackingThresholdMin: 2 | 5 | 10;
  filters: JourneyFilters;
  locatingError: string | null;

  // Actions
  setStep: (step: JourneyStep) => void;
  setUserLocation: (loc: { lat: number; lng: number; accuracy?: number } | null) => void;
  setOriginStop: (stop: Stop | null) => void;
  setDestStop: (stop: Stop | null) => void;
  setDestination: (dest: { name: string; lat?: number; lng?: number; stopId?: string } | null) => void;
  selectStop: (stop: Stop | null) => void;
  selectRoute: (route: Route | null) => void;
  selectBus: (bus: Bus | null) => void;
  startTracking: (busId: string, thresholdMin?: 2 | 5 | 10) => void;
  stopTracking: () => void;
  toggleFilter: (key: keyof JourneyFilters) => void;
  setLocatingError: (err: string | null) => void;
  reset: () => void;
}

const initialFilters: JourneyFilters = {
  ac: false,
  nonAc: false,
  electric: false,
  notCrowded: false,
  within10m: false,
};

export const useJourneyStore = create<JourneyState>((set) => ({
  step: 'welcome',
  userLocation: null,
  originStop: null,
  destStop: null,
  destination: null,
  selectedStop: null,
  selectedRoute: null,
  selectedBus: null,
  trackedBusId: null,
  trackingThresholdMin: 2,
  filters: initialFilters,
  locatingError: null,

  setStep: (step) => set({ step }),
  setUserLocation: (userLocation) => set({ userLocation }),
  setOriginStop: (originStop) => set({ originStop }),
  setDestStop: (destStop) => set({ destStop }),
  setDestination: (destination) => set({ destination }),
  selectStop: (selectedStop) => set({ selectedStop }),
  selectRoute: (selectedRoute) => set({ selectedRoute }),
  selectBus: (selectedBus) => set({ selectedBus }),
  startTracking: (busId, thresholdMin = 2) =>
    set({ trackedBusId: busId, trackingThresholdMin: thresholdMin, step: 'tracking' }),
  stopTracking: () => set({ trackedBusId: null, step: 'nearby' }),
  toggleFilter: (key) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: !state.filters[key],
      },
    })),
  setLocatingError: (locatingError) => set({ locatingError }),
  reset: () =>
    set({
      step: 'welcome',
      userLocation: null,
      originStop: null,
      destStop: null,
      destination: null,
      selectedStop: null,
      selectedRoute: null,
      selectedBus: null,
      trackedBusId: null,
      locatingError: null,
      filters: initialFilters,
    }),
}));

import { create } from 'zustand';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface MapState {
  map: MapLibreMap | null;
  setMap: (map: MapLibreMap | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  map: null,
  setMap: (map) => set({ map }),
}));

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';

// Configure self-hosted worker to guarantee zero worker loading errors in Vite
if (typeof window !== 'undefined' && (maplibregl as any).setWorkerUrl) {
  (maplibregl as any).setWorkerUrl('/maplibre-gl-worker.mjs');
}
import lightStyle from './style.light.json';
import darkStyle from './style.dark.json';
import { useTheme } from '../hooks/useTheme';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useMapStore } from '../stores/map';

const MapContext = createContext<MapLibreMap | null>(null);

export function useMap(): MapLibreMap | null {
  const contextMap = useContext(MapContext);
  const storeMap = useMapStore((s) => s.map);
  return contextMap || storeMap;
}

interface MapContainerProps {
  children?: ReactNode;
  className?: string;
  onMapReady?: (map: MapLibreMap) => void;
}

export default function MapContainer({
  children,
  className = '',
  onMapReady,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const { theme } = useTheme();
  const breakpoint = useBreakpoint();
  const mapRef = useRef<MapLibreMap | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialStyle = theme === 'dark' ? (darkStyle as any) : (lightStyle as any);

    const mapInstance = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: [77.5946, 12.9716], // Bengaluru (near Majestic)
      zoom: 12.5,
      pitch: 0,
      maxPitch: 0,
      dragRotate: false, // 2D only
      touchPitch: false,
      attributionControl: {
        compact: true,
      },
    });

    // Disable rotation on touch
    mapInstance.touchZoomRotate.disableRotation();

    mapInstance.on('load', () => {
      mapRef.current = mapInstance;
      setMap(mapInstance);
      useMapStore.getState().setMap(mapInstance);
      onMapReady?.(mapInstance);
    });

    return () => {
      mapInstance.remove();
      mapRef.current = null;
      setMap(null);
      useMapStore.getState().setMap(null);
    };
  }, []);

  // Update theme style dynamically
  useEffect(() => {
    if (!map) return;
    const nextStyle = theme === 'dark' ? (darkStyle as any) : (lightStyle as any);
    map.setStyle(nextStyle);
  }, [theme, map]);

  // Update map padding based on viewport breakpoint
  useEffect(() => {
    if (!map) return;
    if (breakpoint === 'desktop') {
      // 384px panel + 16px edge + 16px breathing room
      map.setPadding({ top: 16, right: 16, bottom: 16, left: 416 });
    } else if (breakpoint === 'tablet') {
      // 340px panel + 16px edge + 16px breathing room
      map.setPadding({ top: 16, right: 16, bottom: 16, left: 372 });
    } else {
      // Mobile: floating search card on top (~200px), sheet peek (112px) below
      map.setPadding({ top: 208, right: 16, bottom: 128, left: 16 });
    }
  }, [breakpoint, map]);

  return (
    <MapContext.Provider value={map}>
      <div className={`relative w-full h-full overflow-hidden ${className}`}>
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        {children}
      </div>
    </MapContext.Provider>
  );
}

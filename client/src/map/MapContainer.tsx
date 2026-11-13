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

const MapContext = createContext<MapLibreMap | null>(null);

export function useMap(): MapLibreMap | null {
  return useContext(MapContext);
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
      onMapReady?.(mapInstance);
    });

    return () => {
      mapInstance.remove();
      mapRef.current = null;
      setMap(null);
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
      // 384px panel + 24px margins = 408px left padding
      map.setPadding({ top: 24, right: 24, bottom: 24, left: 412 });
    } else if (breakpoint === 'tablet') {
      // 340px panel + 24px margins
      map.setPadding({ top: 24, right: 24, bottom: 24, left: 368 });
    } else {
      // Mobile: bottom sheet peek (~112px)
      map.setPadding({ top: 24, right: 16, bottom: 128, left: 16 });
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

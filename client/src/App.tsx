import { useEffect, useState, useMemo, useCallback } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import MapContainer, { useMap } from './map/MapContainer';
import Panel from './components/Panel';
import BottomSheet from './components/BottomSheet';
import DemoDataPill from './components/DemoDataPill';
import MapControls from './components/MapControls';
import WelcomeCard from './components/screens/WelcomeCard';
import LocatingCard from './components/screens/LocatingCard';
import NearbyPanel from './components/screens/NearbyPanel';
import DestinationPanel from './components/screens/DestinationPanel';
import BusDetailPanel from './components/screens/BusDetailPanel';
import TrackingBar from './components/TrackingBar';
import type { SearchItem } from './components/SearchField';

import { useBreakpoint } from './hooks/useBreakpoint';
import { useJourneyStore } from './stores/journey';
import { fetchRoutes, fetchStops, fetchBuses } from './services/api';
import {
  setBusCatalog,
  setupVehicleMapLayers,
  setTrackedBus,
} from './services/vehicleStore';
import { connectSocket, disconnectSocket, subscribeToRoute } from './services/socket';
import type { Stop, Route, Bus } from './types/transit';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      retry: 1,
    },
  },
});

function BusTwinApp() {
  const map = useMap();
  const breakpoint = useBreakpoint();
  const [isLocating, setIsLocating] = useState(false);

  const {
    step,
    setStep,
    setUserLocation,
    setDestination,
    selectedStop,
    selectStop,
    selectedRoute,
    selectRoute,
    selectedBus,
    selectBus,
    trackedBusId,
    stopTracking,
    setLocatingError,
  } = useJourneyStore();

  // Queries for static transit data
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ['routes'],
    queryFn: fetchRoutes,
  });

  const { data: stops = [] } = useQuery<Stop[]>({
    queryKey: ['stops'],
    queryFn: fetchStops,
  });

  const { data: buses = [] } = useQuery<Bus[]>({
    queryKey: ['buses'],
    queryFn: fetchBuses,
  });

  // Load bus catalog into vehicle store
  useEffect(() => {
    if (buses.length > 0) {
      setBusCatalog(buses);
    }
  }, [buses]);

  // Connect socket and initialize map layers
  useEffect(() => {
    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    setupVehicleMapLayers(map);
  }, [map]);

  // Sync tracked bus ID to vehicleStore
  useEffect(() => {
    setTrackedBus(trackedBusId);
  }, [trackedBusId]);

  // Prepare searchable items from stops and routes
  const searchItems = useMemo<SearchItem[]>(() => {
    const list: SearchItem[] = [
      {
        id: 'recent-1',
        label: 'Majestic (Kempegowda Bus Station)',
        subtitle: 'Central Transit Hub',
        group: 'Recent',
        type: 'place',
        data: { lat: 12.9771, lng: 77.5726 },
      },
      {
        id: 'recent-2',
        label: 'ITPL Bus Stop, Whitefield',
        subtitle: 'Tech Corridor',
        group: 'Recent',
        type: 'place',
        data: { lat: 12.9863, lng: 77.7288 },
      },
      {
        id: 'saved-1',
        label: 'Electronic City Phase 1',
        subtitle: 'Saved Location',
        group: 'Saved',
        type: 'place',
        data: { lat: 12.8452, lng: 77.6602 },
      },
      {
        id: 'saved-2',
        label: 'Central Silk Board',
        subtitle: 'Key Junction',
        group: 'Saved',
        type: 'place',
        data: { lat: 12.9172, lng: 77.6227 },
      },
    ];

    // Add unique routes
    routes.slice(0, 30).forEach((r) => {
      list.push({
        id: `route-${r._id}`,
        label: `${r.routeNo} — ${r.origin} ➔ ${r.destination}`,
        subtitle: `${r.type} · ${r.lengthM ? Math.round(r.lengthM / 1000) + ' km' : ''}`,
        group: 'Routes',
        type: 'route',
        data: r,
      });
    });

    // Add major stops
    stops.slice(0, 40).forEach((s) => {
      list.push({
        id: `stop-${s._id}`,
        label: s.name,
        subtitle: `Zone: ${s.zone || 'Bengaluru'} · ${s.routeIds?.length || 0} routes`,
        group: 'Bus stops',
        type: 'stop',
        data: s,
      });
    });

    return list;
  }, [routes, stops]);

  // Geolocation handler
  const handleLocateMe = useCallback(() => {
    setIsLocating(true);
    setLocatingError(null);
    setStep('locating');

    if (!navigator.geolocation) {
      setLocatingError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setIsLocating(false);

        // Check if within Bengaluru bounding box (12.7-13.2 N, 77.3-77.9 E)
        const isWithinBengaluru =
          latitude >= 12.7 && latitude <= 13.2 && longitude >= 77.3 && longitude <= 77.9;

        if (!isWithinBengaluru) {
          setLocatingError('You appear to be outside Bengaluru.');
          return;
        }

        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        setStep('nearby');

        if (map) {
          map.flyTo({
            center: [longitude, latitude],
            zoom: 15.5,
            duration: 900,
          });
        }
      },
      (err) => {
        setIsLocating(false);
        setLocatingError(
          err.code === 1
            ? 'Location permission denied. Please search or pick a hub.'
            : 'Could not determine your exact position.'
        );
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [map, setLocatingError, setStep, setUserLocation]);

  const handleUseMajestic = useCallback(() => {
    const majesticCoords = { lat: 12.9771, lng: 77.5726 };
    setUserLocation(majesticCoords);
    setStep('nearby');
    if (map) {
      map.flyTo({
        center: [majesticCoords.lng, majesticCoords.lat],
        zoom: 14.5,
        duration: 900,
      });
    }
  }, [map, setStep, setUserLocation]);

  // Handle Search Item Selection
  const handleSelectSearchItem = useCallback(
    (item: SearchItem) => {
      if (item.type === 'route') {
        const route = item.data as Route;
        selectRoute(route);
        subscribeToRoute(route._id);

        if (map && route.geometry?.coordinates?.length) {
          const firstCoord = route.geometry.coordinates[0];
          map.flyTo({
            center: firstCoord,
            zoom: 13.5,
            duration: 800,
          });
        }
        setStep('destination');
      } else if (item.type === 'stop') {
        const stop = item.data as Stop;
        selectStop(stop);
        if (map && stop.loc?.coordinates) {
          map.flyTo({
            center: stop.loc.coordinates,
            zoom: 15,
            duration: 800,
          });
        }
        setStep('nearby');
      } else {
        // Place
        const coords = item.data;
        setDestination({ name: item.label, lat: coords?.lat, lng: coords?.lng });
        if (map && coords?.lng && coords?.lat) {
          map.flyTo({
            center: [coords.lng, coords.lat],
            zoom: 14,
            duration: 800,
          });
        }
        setStep('destination');
      }
    },
    [map, selectRoute, selectStop, setDestination, setStep]
  );

  // Handle Selecting a Bus
  const handleSelectBus = useCallback(
    (bus: Bus, route: Route, stop: Stop) => {
      selectBus(bus);
      selectRoute(route);
      selectStop(stop);
      setStep('busDetail');

      if (map && stop.loc?.coordinates) {
        map.flyTo({
          center: stop.loc.coordinates,
          zoom: 15,
          duration: 600,
        });
      }
    },
    [map, selectBus, selectRoute, selectStop, setStep]
  );

  // Render panel content based on current journey state
  const renderPanelContent = () => {
    switch (step) {
      case 'welcome':
        return (
          <WelcomeCard
            onLocateClick={handleLocateMe}
            onSearchClick={() => setStep('nearby')}
          />
        );
      case 'locating':
        return (
          <LocatingCard
            onSearchFallback={() => setStep('nearby')}
            onUseMajestic={handleUseMajestic}
          />
        );
      case 'nearby':
        return (
          <NearbyPanel
            stops={stops}
            routes={routes}
            buses={buses}
            searchItems={searchItems}
            onSelectSearchItem={handleSelectSearchItem}
            onSelectBus={handleSelectBus}
            onFocusStop={(stop) => {
              selectStop(stop);
              if (map && stop.loc?.coordinates) {
                map.flyTo({ center: stop.loc.coordinates, zoom: 15.5 });
              }
            }}
          />
        );
      case 'destination':
        return (
          <DestinationPanel
            onBack={() => setStep('nearby')}
            onSelectBus={handleSelectBus}
            routes={routes}
            stops={stops}
            buses={buses}
          />
        );
      case 'busDetail':
        if (!selectedBus || !selectedRoute || !selectedStop) {
          return (
            <div className="py-4 text-center text-sm text-[var(--text-2)]">
              No bus selected.
            </div>
          );
        }
        return (
          <BusDetailPanel
            onBack={() => setStep('nearby')}
            onNotifyClick={() => setStep('tracking')}
            bus={selectedBus}
            route={selectedRoute}
            stop={selectedStop}
          />
        );
      case 'tracking':
      case 'arriving':
      case 'done':
      case 'missed':
        if (!selectedBus || !selectedRoute || !selectedStop) {
          return null;
        }
        return (
          <div className="flex flex-col gap-3">
            <TrackingBar
              bus={selectedBus}
              route={selectedRoute}
              stop={selectedStop}
              onStopTracking={stopTracking}
            />
            <button
              type="button"
              onClick={() => setStep('nearby')}
              className="text-xs text-[var(--text-2)] hover:text-[var(--text)] underline text-center"
            >
              Explore other buses
            </button>
          </div>
        );
    }
  };

  const isDesktopOrTablet = breakpoint === 'desktop' || breakpoint === 'tablet';

  return (
    <div className="relative w-screen h-dvh overflow-hidden select-none bg-[var(--paper)]">
      {/* Full-Bleed Map */}
      <MapContainer className="w-full h-full">
        {/* Floating Demo Data Pill (Top Right) */}
        <DemoDataPill />

        {/* Floating Map Controls (Bottom Right) */}
        <MapControls
          onZoomIn={() => map?.zoomIn()}
          onZoomOut={() => map?.zoomOut()}
          onLocate={handleLocateMe}
          isLocating={isLocating}
          className={
            !isDesktopOrTablet
              ? 'bottom-[136px]' // Float above mobile bottom sheet peek
              : 'bottom-3 right-3'
          }
        />

        {/* Desktop / Tablet Floating Panel */}
        {isDesktopOrTablet && (
          <Panel
            title={
              step === 'welcome'
                ? 'Bus Twin'
                : step === 'nearby'
                ? 'Nearby Buses'
                : undefined
            }
          >
            {renderPanelContent()}
          </Panel>
        )}

        {/* Mobile Bottom Sheet */}
        {!isDesktopOrTablet && (
          <BottomSheet>
            <div className="pt-2">
              {renderPanelContent()}
            </div>
          </BottomSheet>
        )}
      </MapContainer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BusTwinApp />
    </QueryClientProvider>
  );
}

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import MapContainer from '../map/MapContainer';
import Panel from '../components/Panel';
import BottomSheet from '../components/BottomSheet';
import DemoDataPill from '../components/DemoDataPill';
import MapControls from '../components/MapControls';
import DualStopSearch from '../components/DualStopSearch';
import FilterBar from '../components/FilterBar';
import BusRow from '../components/BusRow';
import BusDetailPanel from '../components/screens/BusDetailPanel';

import { useBreakpoint } from '../hooks/useBreakpoint';
import { useJourneyStore } from '../stores/journey';
import { useMapStore } from '../stores/map';
import { fetchRoutes, fetchStops, fetchBuses } from '../services/api';
import {
  setBusCatalog,
  setRoutesCatalog,
  setStopsCatalog,
  setVehicleFilters,
  setupVehicleMapLayers,
  setTrackedBus,
  setSelectedRouteLine,
  updateUserLocationMarker,
  setOnBusClickListener,
  calculateBMTCFare,
  getBusLiveEta,
  isStopUpcoming,
} from '../services/vehicleStore';
import { connectSocket, disconnectSocket, subscribeToRoute } from '../services/socket';
import { getDistanceMetres } from '../utils/geo';
import type { Stop, Route, Bus } from '../types/transit';
import { normalizeBusType } from '../types/transit';

export default function HomePage() {
  const map = useMapStore((s) => s.map);
  const breakpoint = useBreakpoint();
  const [isLocating, setIsLocating] = useState(false);
  const [, setTick] = useState(0);

  const {
    step,
    setStep,
    userLocation,
    setUserLocation,
    originStop,
    setOriginStop,
    destStop,
    setDestStop,
    selectedStop,
    selectStop,
    selectedRoute,
    selectRoute,
    selectedBus,
    selectBus,
    trackedBusId,
    setLocatingError,
    filters,
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

  // Re-calculate live ETAs every 1.5s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(interval);
  }, []);

  // Load catalogs into vehicle store
  useEffect(() => {
    if (buses.length > 0) setBusCatalog(buses);
  }, [buses]);

  useEffect(() => {
    if (routes.length > 0) setRoutesCatalog(routes);
  }, [routes]);

  useEffect(() => {
    if (stops.length > 0) setStopsCatalog(stops);
  }, [stops]);

  // Sync active filters to vehicle store (filters out buses from map)
  useEffect(() => {
    setVehicleFilters(filters);
  }, [filters]);

  // Connect socket and initialize map layers
  useEffect(() => {
    connectSocket();
    return () => disconnectSocket();
  }, []);

  useEffect(() => {
    if (!map) return;
    setupVehicleMapLayers(map);
  }, [map]);

  // Sync tracked bus ID and stop coordinates for pulse animation & camera
  useEffect(() => {
    const targetStopCoords = (originStop || selectedStop)?.loc?.coordinates;
    setTrackedBus(trackedBusId, targetStopCoords);
  }, [trackedBusId, selectedStop, originStop]);

  // Sync selected route highlight line
  useEffect(() => {
    if (selectedRoute?.geometry?.coordinates) {
      setSelectedRouteLine(selectedRoute.geometry.coordinates);
    } else {
      setSelectedRouteLine([]);
    }
  }, [selectedRoute]);

  // Sync user location marker
  useEffect(() => {
    if (userLocation) {
      updateUserLocationMarker(userLocation.lng, userLocation.lat, 45);
    }
  }, [userLocation]);

  // Auto-set originStop based on user's GPS proximity on first locate
  useEffect(() => {
    if (userLocation && !originStop && stops.length > 0) {
      let nearest: Stop | null = null;
      let minDist = Infinity;
      for (const s of stops) {
        if (s.loc?.coordinates) {
          const d = getDistanceMetres(userLocation.lat, userLocation.lng, s.loc.coordinates[1], s.loc.coordinates[0]);
          if (d < minDist) {
            minDist = d;
            nearest = s;
          }
        }
      }
      if (nearest && minDist < 3000) {
        setOriginStop(nearest);
      }
    }
  }, [userLocation, originStop, stops, setOriginStop]);

  // Geolocation handler
  const handleLocateMe = useCallback(() => {
    setIsLocating(true);
    setLocatingError(null);

    if (!navigator.geolocation) {
      setLocatingError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading } = pos.coords;
        setIsLocating(false);

        // Check if within Bengaluru bounding box (12.7-13.2 N, 77.3-77.9 E)
        const isWithinBengaluru =
          latitude >= 12.7 && latitude <= 13.2 && longitude >= 77.3 && longitude <= 77.9;

        if (!isWithinBengaluru) {
          setLocatingError('You appear to be outside Bengaluru.');
          return;
        }

        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        updateUserLocationMarker(longitude, latitude, heading || 45);

        // Find nearest stop to set as originStop
        let nearest: Stop | null = null;
        let minDist = Infinity;
        for (const s of stops) {
          if (s.loc?.coordinates) {
            const d = getDistanceMetres(latitude, longitude, s.loc.coordinates[1], s.loc.coordinates[0]);
            if (d < minDist) {
              minDist = d;
              nearest = s;
            }
          }
        }
        if (nearest) {
          setOriginStop(nearest);
        }

        if (map) {
          map.flyTo({
            center: [longitude, latitude],
            zoom: 15.5,
            duration: 800,
          });
        }
      },
      (err) => {
        setIsLocating(false);
        setLocatingError(
          err.code === 1
            ? 'Location permission denied. Please select your stop above.'
            : 'Could not determine your exact position.'
        );
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [map, setLocatingError, setUserLocation, setOriginStop, stops]);

  // Handle selecting a particular bus (highlights bus + opens right detail panel)
  const handleSelectBus = useCallback(
    (bus: Bus, route: Route, stop: Stop) => {
      selectBus(bus);
      selectRoute(route);
      selectStop(stop);
      setStep('busDetail');
      subscribeToRoute(route._id);

      // Highlight tracked bus and route line on the map
      setTrackedBus(bus._id, stop.loc?.coordinates);
      if (route.geometry?.coordinates) {
        setSelectedRouteLine(route.geometry.coordinates);
      }

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

  // Map marker click listener (Clicking any bus on the map selects and highlights it)
  useEffect(() => {
    setOnBusClickListener((busId: string) => {
      const bus = buses.find((b) => b._id === busId);
      if (!bus) return;
      const route = routes.find((r) => r._id === bus.routeId);
      if (!route) return;

      const stopPool = stops.filter((s) => s.routeIds?.includes(route._id));
      const targetStop = originStop || stopPool[0] || stops[0] || {
        _id: 'S0001',
        name: 'Kempegowda Bus Station',
        loc: { type: 'Point', coordinates: [77.5726, 12.9771] },
        routeIds: [route._id],
      };

      handleSelectBus(bus, route, targetStop);
    });

    return () => setOnBusClickListener(null);
  }, [buses, routes, stops, originStop, handleSelectBus]);

  // Find all connecting buses that have BOTH originStop and destStop in their route
  const candidateBuses = useMemo(() => {
    const activeOrigin = originStop;
    const activeDest = destStop;

    // Case 1: Both origin and destination stops selected
    if (activeOrigin && activeDest) {
      // Find routes that contain BOTH stops with origin appearing BEFORE destination
      const connectingRoutes = routes.filter((r) => {
        if (!r.stops || r.stops.length === 0) {
          // Fallback check against stop's routeIds
          return activeOrigin.routeIds?.includes(r._id) && activeDest.routeIds?.includes(r._id);
        }
        const oIdx = r.stops.findIndex((s) => s.stopId === activeOrigin._id);
        const dIdx = r.stops.findIndex((s) => s.stopId === activeDest._id);
        return oIdx !== -1 && dIdx !== -1 && oIdx < dIdx;
      });

      // Gather buses on these routes
      const results: { bus: Bus; route: Route; stop: Stop; etaMin: number; fare: number; walkMin: number }[] = [];
      const boardCoords: [number, number] = activeOrigin.loc.coordinates;
      const destCoords: [number, number] = activeDest.loc.coordinates;

      connectingRoutes.forEach((route) => {
        const routeBuses = buses.filter((b) => b.routeId === route._id);
        routeBuses.forEach((bus) => {
          // Once a bus reaches the bus stop, boolean variable is set to false.
          // Buses departing from the selected boarding bus stop are NOT shown as arriving in 5 mins!
          const isUpcoming = isStopUpcoming(bus._id, activeOrigin._id);
          if (!isUpcoming) return;

          const live = getBusLiveEta(bus._id, boardCoords, activeOrigin._id);
          if (!live || live.isDeparted) return;

          const etaMin = live.etaMinutes;
          const { fare } = calculateBMTCFare(boardCoords, destCoords, normalizeBusType(bus.type));

          results.push({
            bus,
            route,
            stop: activeOrigin,
            etaMin,
            fare,
            walkMin: 3,
          });
        });
      });

      // Apply active filters and sort strictly by ascending time of arrival
      return results
        .filter(({ bus, etaMin }) => {
          const bType = normalizeBusType(bus.type);
          if (filters.ac && bType !== 'AC') return false;
          if (filters.nonAc && bType !== 'NonAC') return false;
          if (filters.electric && bType !== 'Electric') return false;
          if (filters.within10m && etaMin > 10) return false;
          return true;
        })
        .sort((a, b) => a.etaMin - b.etaMin);
    }

    // Case 2: Only originStop selected -> show all departing buses from this stop
    if (activeOrigin) {
      const stopRoutes = routes.filter((r) => activeOrigin.routeIds?.includes(r._id));
      const results: { bus: Bus; route: Route; stop: Stop; etaMin: number; fare: number; walkMin: number }[] = [];
      const boardCoords = activeOrigin.loc.coordinates;

      stopRoutes.forEach((route) => {
        const routeBuses = buses.filter((b) => b.routeId === route._id);
        routeBuses.forEach((bus) => {
          // Once a bus reaches the bus stop, boolean is false: do not show departing buses as arriving in 5 mins
          const isUpcoming = isStopUpcoming(bus._id, activeOrigin._id);
          if (!isUpcoming) return;

          const live = getBusLiveEta(bus._id, boardCoords, activeOrigin._id);
          if (!live || live.isDeparted) return;

          const etaMin = live.etaMinutes;
          const fare = normalizeBusType(bus.type) === 'AC' ? 35 : normalizeBusType(bus.type) === 'Electric' ? 20 : 15;

          results.push({
            bus,
            route,
            stop: activeOrigin,
            etaMin,
            fare,
            walkMin: 3,
          });
        });
      });

      return results
        .filter(({ bus, etaMin }) => {
          const bType = normalizeBusType(bus.type);
          if (filters.ac && bType !== 'AC') return false;
          if (filters.nonAc && bType !== 'NonAC') return false;
          if (filters.electric && bType !== 'Electric') return false;
          if (filters.within10m && etaMin > 10) return false;
          return true;
        })
        .sort((a, b) => a.etaMin - b.etaMin);
    }

    // Case 3: Neither selected -> return top buses around Bengaluru center or Electronic City
    return [];
  }, [originStop, destStop, routes, buses, filters]);

  const isDesktopOrTablet = breakpoint === 'desktop' || breakpoint === 'tablet';
  const showDetail = step === 'busDetail' && selectedBus && selectedRoute && selectedStop;

  const panelTitle =
    originStop && destStop ? `${originStop.name} to ${destStop.name}` : originStop ? `Buses at ${originStop.name}` : 'Find a bus';

  const summary =
    originStop && destStop
      ? `${candidateBuses.length} direct ${candidateBuses.length === 1 ? 'bus' : 'buses'} · soonest first`
      : originStop
      ? 'Departing from this stop · soonest first'
      : null;

  const emptyMessage =
    originStop && destStop
      ? 'No direct buses match right now. Try removing a filter.'
      : originStop
      ? 'Now pick where you’re going, or tap any bus on the map.'
      : 'Pick where you are and where you’re going. Buses show up here, soonest first.';

  const search = (
    <DualStopSearch
      stops={stops}
      originStop={originStop}
      destStop={destStop}
      onSelectOrigin={(stop) => {
        setOriginStop(stop);
        if (stop?.loc?.coordinates && map) map.flyTo({ center: stop.loc.coordinates, zoom: 15 });
      }}
      onSelectDest={(stop) => setDestStop(stop)}
    />
  );

  const results = (
    <div className="flex flex-col gap-4">
      {summary && <p className="text-xs text-[var(--text-3)]">{summary}</p>}
      {candidateBuses.length === 0 ? (
        <p className="py-6 text-base text-[var(--text-2)]">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {candidateBuses.map(({ bus, route, stop, etaMin, fare, walkMin }) => (
            <BusRow
              key={bus._id}
              routeNo={route.routeNo}
              type={normalizeBusType(bus.type)}
              destination={route.destination}
              etaMinutes={etaMin}
              walkMinutes={walkMin}
              fare={fare}
              crowding={bus.capacity > 45 ? 'medium' : 'low'}
              isCatchable={etaMin >= walkMin - 1}
              tracked={selectedBus?._id === bus._id}
              onClick={() => handleSelectBus(bus, route, stop)}
            />
          ))}
        </div>
      )}
    </div>
  );

  const detail = showDetail ? (
    <BusDetailPanel
      onBack={() => setStep('nearby')}
      onNotifyClick={() => setStep('tracking')}
      bus={selectedBus!}
      route={selectedRoute!}
      stop={selectedStop!}
      allStops={stops}
    />
  ) : null;

  // Map controls + the Demo-data pill slide left when the detail panel is open.
  const controlsShift = isDesktopOrTablet
    ? showDetail
      ? 'sm:right-[364px] lg:right-[408px]'
      : ''
    : 'bottom-[128px]';
  const pillShift = isDesktopOrTablet
    ? showDetail
      ? 'sm:right-[412px] lg:right-[456px]'
      : ''
    : 'bottom-[128px]';

  return (
    <div className="relative w-screen h-dvh overflow-hidden select-none bg-[var(--paper)]">
      <MapContainer className="w-full h-full">
        <DemoDataPill className={pillShift} />

        <MapControls
          onZoomIn={() => map?.zoomIn({ duration: 300 })}
          onZoomOut={() => map?.zoomOut({ duration: 300 })}
          onLocate={handleLocateMe}
          isLocating={isLocating}
          className={controlsShift}
        />

        {/* Left panel: plan the trip, then pick a bus */}
        {isDesktopOrTablet && (
          <Panel
            position="left"
            brand
            title={panelTitle}
            toolbar={
              <>
                {search}
                <FilterBar />
              </>
            }
          >
            {results}
          </Panel>
        )}

        {/* Right panel: one bus in detail. Replaces nothing, never stacks a third panel. */}
        {isDesktopOrTablet && detail && <Panel position="right">{detail}</Panel>}

        {/* Mobile: floating search card + bottom sheet */}
        {!isDesktopOrTablet && (
          <>
            <div className="fixed top-[72px] left-4 right-4 z-30 panel-surface dots p-4">{search}</div>
            <BottomSheet>
              <div className="flex flex-col gap-4 pt-2">
                {detail ?? (
                  <>
                    <FilterBar />
                    {results}
                  </>
                )}
              </div>
            </BottomSheet>
          </>
        )}
      </MapContainer>
    </div>
  );
}

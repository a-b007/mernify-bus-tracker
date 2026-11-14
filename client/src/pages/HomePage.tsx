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
} from '../services/vehicleStore';
import { connectSocket, disconnectSocket, subscribeToRoute } from '../services/socket';
import { getDistanceMetres } from '../utils/geo';
import type { Stop, Route, Bus } from '../types/transit';
import { normalizeBusType } from '../types/transit';
import { MapPin, NavigationArrow } from '@phosphor-icons/react';

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
          const live = getBusLiveEta(bus._id, boardCoords);
          const etaMin = live ? live.etaMinutes : 6;
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

      stopRoutes.forEach((route, rIdx) => {
        const routeBuses = buses.filter((b) => b.routeId === route._id);
        routeBuses.slice(0, 3).forEach((bus, bIdx) => {
          const live = getBusLiveEta(bus._id, boardCoords);
          const etaMin = live ? live.etaMinutes : 4 + rIdx * 3 + bIdx * 4;
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

  return (
    <div className="relative w-screen h-dvh overflow-hidden select-none bg-[var(--paper)]">
      {/* Full-Bleed Interactive Map */}
      <MapContainer className="w-full h-full">
        {/* Floating Demo Data Pill (Top Right) */}
        <DemoDataPill />

        {/* Center-Top Floating Dual Search & Filter Bar */}
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-3 flex flex-col items-center gap-2 pointer-events-none">
          <div className="pointer-events-auto w-full">
            <DualStopSearch
              stops={stops}
              originStop={originStop}
              destStop={destStop}
              onSelectOrigin={(stop) => {
                setOriginStop(stop);
                if (stop?.loc?.coordinates && map) {
                  map.flyTo({ center: stop.loc.coordinates, zoom: 15 });
                }
              }}
              onSelectDest={(stop) => {
                setDestStop(stop);
              }}
            />
          </div>

          {/* Quick Filters Pill Bar */}
          <div className="pointer-events-auto">
            <FilterBar />
          </div>
        </div>

        {/* Map Controls (Bottom Right) */}
        <MapControls
          onZoomIn={() => map?.zoomIn({ duration: 300 })}
          onZoomOut={() => map?.zoomOut({ duration: 300 })}
          onLocate={handleLocateMe}
          isLocating={isLocating}
          className={!isDesktopOrTablet ? 'bottom-[136px]' : 'bottom-3 right-3'}
        />

        {/* Left Floating Panel: Bus Search Results & Recommendations */}
        {isDesktopOrTablet && (
          <Panel
            position="left"
            className="top-36"
            title={
              originStop && destStop
                ? `${originStop.name.split(' ')[0]} ➔ ${destStop.name.split(' ')[0]}`
                : originStop
                ? `Buses at ${originStop.name.split(' ')[0]}`
                : 'Direct Connecting Buses'
            }
          >
            <div className="flex flex-col gap-3">
              {/* Header Info Banner */}
              {originStop && destStop ? (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin size={14} weight="fill" className="text-emerald-600 shrink-0" />
                      <span className="truncate">{originStop.name}</span>
                      <span>➔</span>
                      <span className="truncate">{destStop.name}</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {candidateBuses.length} direct buses · In increasing order of arrival
                  </div>
                </div>
              ) : originStop ? (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#243044] border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-[var(--text)]">
                    Boarding at: {originStop.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Select a destination stop above to find connecting buses, or pick any bus below:
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-[#243044] border border-slate-200 dark:border-slate-700 text-center space-y-2">
                  <NavigationArrow size={24} className="text-emerald-500 mx-auto" />
                  <div className="text-sm font-bold text-[var(--text)]">
                    Plan Your BMTC Journey
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Select your current stop & destination above to see direct buses sorted by arrival time.
                  </div>
                </div>
              )}

              {/* Bus Results List (Sorted strictly ascending by arrival time) */}
              <div className="flex flex-col divide-y divide-[var(--border)] max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {candidateBuses.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {originStop && destStop
                      ? 'No direct buses found matching active filters. Try toggling filters.'
                      : 'Pick stops in the dual search box above to display live buses.'}
                  </div>
                ) : (
                  candidateBuses.map(({ bus, route, stop, etaMin, fare, walkMin }) => {
                    const isSelected = selectedBus?._id === bus._id;
                    return (
                      <div
                        key={bus._id}
                        className={`transition-all rounded-lg ${
                          isSelected ? 'ring-2 ring-amber-500 bg-amber-500/10' : ''
                        }`}
                      >
                        <BusRow
                          routeNo={route.routeNo}
                          type={normalizeBusType(bus.type)}
                          destination={route.destination}
                          etaMinutes={etaMin}
                          walkMinutes={walkMin}
                          fare={fare}
                          crowding={bus.capacity > 45 ? 'medium' : 'low'}
                          isCatchable={etaMin >= walkMin - 1}
                          onClick={() => handleSelectBus(bus, route, stop)}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Panel>
        )}

        {/* Right Floating Panel: Bus Details, Live Tracking & Weekly Historical Analysis */}
        {isDesktopOrTablet && step === 'busDetail' && selectedBus && selectedRoute && selectedStop && (
          <Panel
            position="right"
            title={`Bus ${selectedRoute.routeNo} (${selectedBus._id})`}
            onClose={() => setStep('nearby')}
          >
            <BusDetailPanel
              onBack={() => setStep('nearby')}
              onNotifyClick={() => setStep('tracking')}
              bus={selectedBus}
              route={selectedRoute}
              stop={selectedStop}
              allStops={stops}
            />
          </Panel>
        )}

        {/* Mobile Bottom Sheet for Bus Results & Tracking */}
        {!isDesktopOrTablet && (
          <BottomSheet>
            <div className="pt-2 px-1 flex flex-col gap-3">
              {step === 'busDetail' && selectedBus && selectedRoute && selectedStop ? (
                <BusDetailPanel
                  onBack={() => setStep('nearby')}
                  onNotifyClick={() => setStep('tracking')}
                  bus={selectedBus}
                  route={selectedRoute}
                  stop={selectedStop}
                  allStops={stops}
                />
              ) : (
                <>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {originStop && destStop
                      ? `Connecting Buses (${candidateBuses.length})`
                      : 'Nearby Departures'}
                  </div>
                  <div className="flex flex-col divide-y divide-[var(--border)] max-h-[50vh] overflow-y-auto">
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
                        onClick={() => handleSelectBus(bus, route, stop)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </BottomSheet>
        )}
      </MapContainer>
    </div>
  );
}

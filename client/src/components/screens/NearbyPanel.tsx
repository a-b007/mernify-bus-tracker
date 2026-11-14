import { useState, useEffect, useMemo } from 'react';
import { MapPin } from '@phosphor-icons/react';
import SearchField, { type SearchItem } from '../SearchField';
import FilterBar from '../FilterBar';
import BusRow from '../BusRow';
import { useJourneyStore } from '../../stores/journey';
import { getBusLiveEta } from '../../services/vehicleStore';
import { getDistanceMetres } from '../../utils/geo';
import type { Stop, Route, Bus } from '../../types/transit';
import { normalizeBusType } from '../../types/transit';

interface NearbyPanelProps {
  stops: Stop[];
  routes: Route[];
  buses: Bus[];
  searchItems: SearchItem[];
  onSelectSearchItem: (item: SearchItem) => void;
  onSelectBus: (bus: Bus, route: Route, stop: Stop) => void;
  onFocusStop: (stop: Stop | null) => void;
}

export default function NearbyPanel({
  stops,
  routes,
  buses,
  searchItems,
  onSelectSearchItem,
  onSelectBus,
  onFocusStop,
}: NearbyPanelProps) {
  const { filters, selectedStop, userLocation } = useJourneyStore();
  const [, setTick] = useState(0);

  // Re-calculate live ETAs every 1.5s as buses move on the map
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;

  // Real proximity calculation: sort all stops by geodesic distance from user's current GPS location
  const stopsWithProximity = useMemo(() => {
    if (!userLat || !userLng || stops.length === 0) {
      return stops.map((s, idx) => ({
        stop: s,
        distM: 200 + idx * 150,
        walkDistM: 200 + idx * 150,
        walkMin: Math.max(1, Math.round((200 + idx * 150) / 75)),
      }));
    }

    return stops
      .filter((s) => s.loc?.coordinates && s.loc.coordinates.length >= 2)
      .map((s) => {
        const distM = getDistanceMetres(
          userLat,
          userLng,
          s.loc.coordinates[1],
          s.loc.coordinates[0]
        );
        const walkDistM = Math.round(distM);
        const walkMin = Math.max(1, Math.round(walkDistM / 75)); // ~4.5 km/h walking speed
        return {
          stop: s,
          distM,
          walkDistM,
          walkMin,
        };
      })
      .sort((a, b) => a.distM - b.distM);
  }, [stops, userLat, userLng]);

  // If a stop is specifically selected/focused, show that stop;
  // otherwise show the closest 4 stops to the user
  const displayStopsWithDistance = useMemo(() => {
    if (selectedStop) {
      const match = stopsWithProximity.find((item) => item.stop._id === selectedStop._id);
      if (match) return [match];
      const distM =
        selectedStop.loc?.coordinates && userLat && userLng
          ? getDistanceMetres(
              userLat,
              userLng,
              selectedStop.loc.coordinates[1],
              selectedStop.loc.coordinates[0]
            )
          : 225;
      const walkDistM = Math.round(distM);
      const walkMin = Math.max(1, Math.round(walkDistM / 75));
      return [{ stop: selectedStop, distM, walkDistM, walkMin }];
    }
    return stopsWithProximity.slice(0, 4);
  }, [selectedStop, stopsWithProximity, userLat, userLng]);

  return (
    <div className="flex flex-col gap-3">
      {/* Universal Search at Top */}
      <SearchField
        placeholder="Where to? (e.g. ITPL, Indiranagar, 335E)"
        items={searchItems}
        onSelect={onSelectSearchItem}
      />

      {/* Filter Bar */}
      <FilterBar />

      {/* When a specific stop is selected, offer a button to view all nearby stops */}
      {selectedStop && (
        <button
          type="button"
          onClick={() => onFocusStop(null)}
          className="text-xs text-[var(--primary-600)] dark:text-[var(--primary-400)] hover:underline self-start px-1 font-medium transition-colors"
        >
          ← Show all nearby stops around me
        </button>
      )}

      {/* Stops and Bus Departures */}
      <div className="flex flex-col gap-4 mt-1">
        {displayStopsWithDistance.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-2)]">
            Loading stops around you…
          </div>
        ) : (
          displayStopsWithDistance.map(({ stop, walkDistM, walkMin }) => {
            const stopRoutes = routes.filter((r) => stop.routeIds?.includes(r._id));
            const formattedDist =
              walkDistM < 1000 ? `${walkDistM} m` : `${(walkDistM / 1000).toFixed(1)} km`;

            // Live calculated buses for these routes
            const candidateBuses = stopRoutes.flatMap((route, rIdx) => {
              const routeBuses = buses.filter((b) => b.routeId === route._id);
              return routeBuses.slice(0, 2).map((bus, bIdx) => {
                const live = stop.loc?.coordinates
                  ? getBusLiveEta(bus._id, stop.loc.coordinates)
                  : null;
                const etaMin = live ? live.etaMinutes : (3 + (rIdx * 3) + (bIdx * 5));
                return {
                  bus,
                  route,
                  stop,
                  etaMin,
                };
              });
            });

            // Apply active filters and sort by arrival time
            const filteredBuses = candidateBuses
              .filter(({ bus, etaMin }) => {
                const bType = normalizeBusType(bus.type);
                if (filters.ac && bType !== 'AC') return false;
                if (filters.nonAc && bType !== 'NonAC') return false;
                if (filters.electric && bType !== 'Electric') return false;
                if (filters.within10m && etaMin > 10) return false;
                return true;
              })
              .sort((a, b) => a.etaMin - b.etaMin);

            return (
              <div key={stop._id} className="flex flex-col gap-1">
                {/* Stop Group Header */}
                <div
                  role="button"
                  onClick={() => onFocusStop(stop)}
                  className="flex items-center justify-between py-1.5 px-2 rounded-[var(--r-sm)] hover:bg-[var(--surface-2)] cursor-pointer select-none transition-colors duration-[var(--dur-1)]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin size={16} weight="fill" className="text-[var(--primary-700)] shrink-0" />
                    <span className="text-sm font-semibold text-[var(--text)] truncate">
                      {stop.name}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-3)] shrink-0 ml-2">
                    {walkMin} min walk · {formattedDist}
                  </span>
                </div>

                {/* Bus Rows */}
                <div className="flex flex-col divide-y divide-[var(--border)]">
                  {filteredBuses.length === 0 ? (
                    <div className="py-2 px-3 text-xs text-[var(--text-3)] italic">
                      No buses matching active filters
                    </div>
                  ) : (
                    filteredBuses.slice(0, 3).map(({ bus, route, etaMin }) => (
                      <BusRow
                        key={bus._id}
                        routeNo={route.routeNo}
                        type={normalizeBusType(bus.type)}
                        destination={route.destination}
                        etaMinutes={etaMin}
                        walkMinutes={walkMin}
                        fare={normalizeBusType(bus.type) === 'AC' ? 35 : normalizeBusType(bus.type) === 'Electric' ? 20 : 15}
                        crowding={bus.capacity > 45 ? 'medium' : 'low'}
                        isCatchable={etaMin >= walkMin - 1}
                        onClick={() => onSelectBus(bus, route, stop)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

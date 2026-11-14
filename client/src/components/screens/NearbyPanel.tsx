import { useState, useEffect } from 'react';
import { MapPin } from '@phosphor-icons/react';
import SearchField, { type SearchItem } from '../SearchField';
import FilterBar from '../FilterBar';
import BusRow from '../BusRow';
import { useJourneyStore } from '../../stores/journey';
import { getBusLiveEta } from '../../services/vehicleStore';
import type { Stop, Route, Bus } from '../../types/transit';
import { normalizeBusType } from '../../types/transit';

interface NearbyPanelProps {
  stops: Stop[];
  routes: Route[];
  buses: Bus[];
  searchItems: SearchItem[];
  onSelectSearchItem: (item: SearchItem) => void;
  onSelectBus: (bus: Bus, route: Route, stop: Stop) => void;
  onFocusStop: (stop: Stop) => void;
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
  const { filters, selectedStop } = useJourneyStore();
  const [, setTick] = useState(0);

  // Re-calculate live ETAs every 1.5s as buses move on the map
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // If a stop is focused, show only that stop; otherwise show nearest 3-5 stops
  const displayStops = selectedStop ? [selectedStop] : stops.slice(0, 4);

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

      {/* Stops and Bus Departures */}
      <div className="flex flex-col gap-4 mt-1">
        {displayStops.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-2)]">
            Loading stops around you…
          </div>
        ) : (
          displayStops.map((stop, stopIndex) => {
            const stopRoutes = routes.filter((r) => stop.routeIds?.includes(r._id));
            const walkMin = 3 + stopIndex * 2;
            const walkDistM = walkMin * 75;

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
                    {walkMin} min walk · {walkDistM} m
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

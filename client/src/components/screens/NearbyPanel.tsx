import { useState, useEffect, useMemo } from 'react';
import { MapPin, ArrowLeft } from '@phosphor-icons/react';
import SearchField, { type SearchItem } from '../SearchField';
import FilterBar from '../FilterBar';
import BusRow from '../BusRow';
import { useJourneyStore } from '../../stores/journey';
import { getBusLiveEta, isStopUpcoming } from '../../services/vehicleStore';
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
    <div className="flex flex-col gap-4">
      <SearchField placeholder="Where to? (e.g. ITPL, Indiranagar, 335E)" items={searchItems} onSelect={onSelectSearchItem} />

      <FilterBar />

      {selectedStop && (
        <button type="button" onClick={() => onFocusStop(null)} className="btn btn-ghost btn-sm self-start -ml-3 !text-[var(--primary-700)]">
          <ArrowLeft size={16} aria-hidden="true" />
          All stops near me
        </button>
      )}

      <div className="flex flex-col gap-6">
        {displayStopsWithDistance.length === 0 ? (
          <p className="py-8 text-center text-base text-[var(--text-2)]">Finding stops around you…</p>
        ) : (
          displayStopsWithDistance.map(({ stop, walkDistM, walkMin }) => {
            const stopRoutes = routes.filter((r) => stop.routeIds?.includes(r._id));
            const formattedDist = walkDistM < 1000 ? `${walkDistM} m` : `${(walkDistM / 1000).toFixed(1)} km`;

            const candidateBuses = stopRoutes.flatMap((route) => {
              const routeBuses = buses.filter((b) => b.routeId === route._id);
              return routeBuses
                .filter((bus) => isStopUpcoming(bus._id, stop._id))
                .slice(0, 3)
                .map((bus) => {
                  const live = stop.loc?.coordinates ? getBusLiveEta(bus._id, stop.loc.coordinates, stop._id) : null;
                  if (live?.isDeparted) return null;
                  const etaMin = live ? live.etaMinutes : 5;
                  return { bus, route, stop, etaMin };
                })
                .filter((item): item is { bus: Bus; route: Route; stop: Stop; etaMin: number } => item !== null);
            });

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
              <section key={stop._id} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onFocusStop(stop)}
                  className="flex items-center justify-between gap-4 text-left cursor-pointer"
                >
                  <h3 className="flex items-center gap-2 text-sm min-w-0">
                    <MapPin size={16} weight="fill" className="text-[var(--primary-700)] shrink-0" aria-hidden="true" />
                    <span className="truncate">{stop.name}</span>
                  </h3>
                  <span className="text-xs text-[var(--text-3)] shrink-0 tabular-nums">
                    {walkMin} min walk · {formattedDist}
                  </span>
                </button>

                <div className="flex flex-col divide-y divide-[var(--border)]">
                  {filteredBuses.length === 0 ? (
                    <p className="py-3 text-sm text-[var(--text-3)]">No buses match your filters here.</p>
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
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

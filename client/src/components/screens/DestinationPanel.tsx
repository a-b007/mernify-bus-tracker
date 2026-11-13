import { ArrowLeft } from '@phosphor-icons/react';
import FilterBar from '../FilterBar';
import BusRow from '../BusRow';
import { useJourneyStore } from '../../stores/journey';
import type { Stop, Route, Bus } from '../../types/transit';
import { normalizeBusType } from '../../types/transit';

interface DestinationPanelProps {
  onBack: () => void;
  onSelectBus: (bus: Bus, route: Route, stop: Stop) => void;
  routes: Route[];
  stops: Stop[];
  buses: Bus[];
}

export default function DestinationPanel({
  onBack,
  onSelectBus,
  routes,
  stops,
  buses,
}: DestinationPanelProps) {
  const { destination, filters } = useJourneyStore();

  const destName = destination?.name || 'Selected Destination';

  // Find routes heading toward or containing this destination
  const matchingRoutes = routes.filter((r) =>
    r.destination.toLowerCase().includes(destName.toLowerCase()) ||
    r.origin.toLowerCase().includes(destName.toLowerCase())
  );

  const displayRoutes = matchingRoutes.length > 0 ? matchingRoutes : routes.slice(0, 4);

  return (
    <div className="flex flex-col gap-3">
      {/* Header bar */}
      <div className="flex items-center gap-2 pb-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to nearby"
          className="flex items-center justify-center w-8 h-8 rounded-[var(--r-md)] hover:bg-[var(--surface-2)] text-[var(--text-2)] transition-colors duration-[var(--dur-1)]"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-[var(--text-3)] font-medium">Buses to</span>
          <span className="text-sm font-semibold text-[var(--text)] truncate">{destName}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar />

      {/* Route & Bus Options */}
      <div className="flex flex-col gap-2 divide-y divide-[var(--border)]">
        {displayRoutes.map((route, idx) => {
          const routeBuses = buses.filter((b) => b.routeId === route._id);
          const candidateBus = routeBuses[0] || {
            _id: `B_gen_${idx}`,
            regNo: `KA-01-F-${1000 + idx}`,
            routeId: route._id,
            type: route.type,
            capacity: 50,
            depot: 'Central',
            destination: route.destination,
          };

          const boardingStop = stops[0] || {
            _id: 'S0001',
            name: 'Kempegowda Bus Station',
            loc: { type: 'Point', coordinates: [77.5726, 12.9771] },
            routeIds: [route._id],
          };

          const etaMin = 4 + idx * 5;

          const rType = normalizeBusType(route.type);
          if (filters.ac && rType !== 'AC') return null;
          if (filters.nonAc && rType !== 'NonAC') return null;
          if (filters.electric && rType !== 'Electric') return null;
          if (filters.within10m && etaMin > 10) return null;

          return (
            <div key={route._id} className="pt-2 first:pt-0">
              <div className="text-[11px] text-[var(--text-3)] mb-1 px-1">
                Board at {boardingStop.name} · 4 min walk
              </div>
              <BusRow
                routeNo={route.routeNo}
                type={rType}
                destination={route.destination}
                etaMinutes={etaMin}
                walkMinutes={4}
                isCatchable={true}
                onClick={() => onSelectBus(candidateBus, route, boardingStop)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

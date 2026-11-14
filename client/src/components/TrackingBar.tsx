import { X } from '@phosphor-icons/react';
import RouteChip from './RouteChip';
import { useJourneyStore } from '../stores/journey';
import { useLiveBusEta } from '../hooks/useLiveEta';
import type { Route, Bus, Stop } from '../types/transit';
import { normalizeBusType } from '../types/transit';

interface TrackingBarProps {
  bus: Bus;
  route: Route;
  stop: Stop;
  onStopTracking: () => void;
  className?: string;
}

export default function TrackingBar({ bus, route, stop, onStopTracking, className = '' }: TrackingBarProps) {
  const { trackingThresholdMin } = useJourneyStore();
  const eta = useLiveBusEta(bus._id, stop);

  const secondsRemaining = eta.etaSeconds;
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;

  const isDone = eta.status === 'arrived' || secondsRemaining === 0;
  const isArriving = !isDone && (eta.status === 'arriving' || secondsRemaining < 60);
  const isApproaching = !isDone && !isArriving && (eta.status === 'approaching' || secondsRemaining <= trackingThresholdMin * 60);

  const tone = isDone
    ? 'bg-[var(--primary-600)] text-[var(--on-primary)] border-[var(--primary-700)]'
    : isArriving
    ? 'bg-[var(--amber-500)] text-[var(--on-amber)] border-[var(--amber-500)]'
    : isApproaching
    ? 'bg-[var(--amber-100)] text-[var(--text)] border-[var(--amber-500)]'
    : 'bg-[var(--surface-solid)] text-[var(--text)] border-[var(--border)]';

  return (
    <div
      role="region"
      aria-live="polite"
      className={`flex items-center justify-between gap-4 p-4 rounded-[var(--r-md)] border shadow-[var(--shadow-panel)] select-none transition-colors duration-[var(--dur-2)] ${tone} ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <RouteChip routeNo={route.routeNo} type={normalizeBusType(bus.type)} tracked />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate">
            {isDone
              ? `Reached ${stop.name}`
              : isArriving
              ? `Arriving now · ${eta.distanceM} m away`
              : isApproaching
              ? `Arriving in ${mins} min ${secs} s · head to ${stop.name}`
              : `${eta.stopsAway} stops away · ${eta.distanceM} m`}
          </span>
          <span className="text-xs opacity-80 truncate">
            Towards {route.destination} · {eta.speedKmh} km/h
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-md font-semibold tabular-nums">{isDone ? 'Arrived' : `${mins}:${secs < 10 ? '0' : ''}${secs}`}</span>
        <button type="button" onClick={onStopTracking} aria-label="Stop tracking" className="icon-btn !w-8 !h-8 !text-current">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

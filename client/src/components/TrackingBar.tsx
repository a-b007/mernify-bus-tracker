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

export default function TrackingBar({
  bus,
  route,
  stop,
  onStopTracking,
  className = '',
}: TrackingBarProps) {
  const { trackingThresholdMin } = useJourneyStore();
  const eta = useLiveBusEta(bus._id, stop);

  const secondsRemaining = eta.etaSeconds;
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;

  // Escalation logic based on live physical tracking:
  // arrived: distance < 60m or seconds === 0
  // arriving: distance < 250m or seconds < 60
  // approaching: seconds <= threshold * 60
  const isDone = eta.status === 'arrived' || secondsRemaining === 0;
  const isArriving = !isDone && (eta.status === 'arriving' || secondsRemaining < 60);
  const isApproaching = !isDone && !isArriving && (eta.status === 'approaching' || secondsRemaining <= trackingThresholdMin * 60);

  const getContainerStyle = () => {
    if (isDone) {
      return 'bg-[var(--primary-600)] text-white border-[var(--primary-700)]';
    }
    if (isArriving) {
      return 'bg-[var(--amber-500)] text-[var(--text)] border-[var(--amber-500)]';
    }
    if (isApproaching) {
      return 'bg-[var(--amber-100)] text-[var(--text)] border-[var(--amber-500)]';
    }
    return 'bg-[var(--surface)] backdrop-blur-md text-[var(--text)] border-[var(--border)]';
  };

  return (
    <div
      role="region"
      aria-live="polite"
      className={[
        'p-3.5 rounded-[var(--r-md)] border shadow-[var(--shadow-panel)]',
        'flex items-center justify-between gap-3 select-none transition-colors duration-[var(--dur-2)]',
        getContainerStyle(),
        className,
      ].join(' ')}
    >
      <div className="flex items-center gap-3 min-w-0">
        <RouteChip routeNo={route.routeNo} type={normalizeBusType(bus.type)} tracked={true} />
        <div className="flex flex-col min-w-0">
          <div className="text-xs font-semibold truncate">
            {isDone
              ? `Reached ${stop.name}`
              : isArriving
              ? `Arriving now · ${eta.distanceM} m away`
              : isApproaching
              ? `Arriving in ${mins}m ${secs}s · head to ${stop.name}`
              : `Tracking bus · ${eta.stopsAway} stops away (${eta.distanceM} m)`}
          </div>
          <div className="text-[11px] opacity-80 truncate">
            towards {route.destination} · {eta.speedKmh} km/h
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div
          className="text-sm font-bold tabular-nums"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {isDone ? 'Arrived' : `${mins}:${secs < 10 ? '0' : ''}${secs}`}
        </div>

        <button
          type="button"
          onClick={onStopTracking}
          aria-label="Stop tracking"
          className="p-1 rounded-[var(--r-sm)] hover:bg-black/10 transition-colors"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}

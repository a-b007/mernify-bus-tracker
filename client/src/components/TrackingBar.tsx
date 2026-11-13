import { useState, useEffect } from 'react';
import { X } from '@phosphor-icons/react';
import RouteChip from './RouteChip';
import { useJourneyStore } from '../stores/journey';
import type { Route, Bus, Stop } from '../types/transit';

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
  const [secondsRemaining, setSecondsRemaining] = useState(180); // 3 minutes initially
  const { trackingThresholdMin } = useJourneyStore();

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;

  // Escalation logic per DESIGN.md §2:
  // approaching: seconds <= threshold * 60
  // arriving: seconds < 60
  // done: seconds === 0
  const isArriving = secondsRemaining < 60 && secondsRemaining > 0;
  const isApproaching = secondsRemaining <= trackingThresholdMin * 60 && secondsRemaining >= 60;
  const isDone = secondsRemaining === 0;

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
    return 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)]';
  };

  return (
    <div
      role="region"
      aria-live="polite"
      className={[
        'p-3 rounded-[var(--r-md)] border shadow-[var(--shadow-panel)]',
        'flex items-center justify-between gap-3 select-none transition-colors duration-[var(--dur-2)]',
        getContainerStyle(),
        className,
      ].join(' ')}
    >
      <div className="flex items-center gap-3 min-w-0">
        <RouteChip routeNo={route.routeNo} type={bus.type} tracked={true} />
        <div className="flex flex-col min-w-0">
          <div className="text-xs font-semibold truncate">
            {isDone
              ? `Reached ${stop.name}`
              : isArriving
              ? 'Arriving now · at boarding stop'
              : isApproaching
              ? `Arriving in ${mins}m ${secs}s · head to ${stop.name}`
              : `Tracking bus · 2 stops away`}
          </div>
          <div className="text-[11px] opacity-80 truncate">
            towards {route.destination}
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

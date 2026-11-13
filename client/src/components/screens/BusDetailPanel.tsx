import { useState } from 'react';
import { ArrowLeft, Bell, CaretDown, CaretUp } from '@phosphor-icons/react';
import RouteChip from '../RouteChip';
import { useJourneyStore } from '../../stores/journey';
import type { Stop, Route, Bus } from '../../types/transit';
import { normalizeBusType } from '../../types/transit';

interface BusDetailPanelProps {
  onBack: () => void;
  onNotifyClick: () => void;
  bus: Bus;
  route: Route;
  stop: Stop;
}

export default function BusDetailPanel({
  onBack,
  onNotifyClick,
  bus,
  route,
  stop,
}: BusDetailPanelProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [notifyThreshold, setNotifyThreshold] = useState<2 | 5 | 10>(2);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { startTracking } = useJourneyStore();

  const handleNotifyConfirm = () => {
    startTracking(bus._id, notifyThreshold);
    onNotifyClick();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex items-center justify-center w-8 h-8 rounded-[var(--r-md)] hover:bg-[var(--surface-2)] text-[var(--text-2)] transition-colors duration-[var(--dur-1)]"
        >
          <ArrowLeft size={18} />
        </button>

        <RouteChip routeNo={route.routeNo} type={normalizeBusType(bus.type)} />
        <span className="text-sm font-semibold text-[var(--text)] truncate">
          towards {route.destination}
        </span>
      </div>

      {/* Hero ETA Block */}
      <div className="p-4 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span
              className="text-[36px] leading-[40px] font-semibold text-[var(--text)] tracking-tight"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              4 min
            </span>
            <span className="text-xs text-[var(--text-2)]">· 3 stops away</span>
          </div>
          <span className="text-xs text-[var(--primary-700)] font-medium">On time</span>
        </div>

        {/* Walking hint */}
        <p className="text-xs text-[var(--text-2)] font-medium mt-1">
          Leave in 2 min to catch it at {stop.name}.
        </p>
      </div>

      {/* Primary Action: Notify Me */}
      {!isPickerOpen ? (
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className={[
            'flex items-center justify-center gap-2 w-full h-[44px] px-4',
            'bg-[var(--primary-600)] text-white text-sm font-medium rounded-[var(--r-md)]',
            'hover:bg-[var(--primary-700)] active:bg-[var(--primary-800)]',
            'shadow-sm transition-colors duration-[var(--dur-1)]',
          ].join(' ')}
        >
          <Bell size={18} weight="bold" />
          <span>Notify me when it's close</span>
        </button>
      ) : (
        <div className="p-3 bg-[var(--amber-100)]/40 border border-[var(--amber-500)] rounded-[var(--r-md)] flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-[var(--text)]">Alert me before arrival:</span>
          <div className="flex gap-2">
            {([2, 5, 10] as const).map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setNotifyThreshold(mins)}
                className={[
                  'flex-1 py-1.5 text-xs font-semibold rounded-[var(--r-sm)] border select-none transition-colors duration-[var(--dur-1)]',
                  notifyThreshold === mins
                    ? 'bg-[var(--amber-500)] text-[var(--text)] border-[var(--amber-500)]'
                    : 'bg-[var(--surface)] text-[var(--text-2)] border-[var(--border)] hover:bg-[var(--surface-2)]',
                ].join(' ')}
              >
                {mins} min
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleNotifyConfirm}
            className="w-full py-2 bg-[var(--primary-600)] text-white text-xs font-semibold rounded-[var(--r-sm)] hover:bg-[var(--primary-700)] transition-colors duration-[var(--dur-1)]"
          >
            Start Tracking
          </button>
        </div>
      )}

      {/* Collapsible Fleet Details */}
      <div className="border-t border-[var(--border)] pt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center justify-between text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
        >
          <span>Vehicle & Depot details</span>
          {showDetails ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </button>

        {showDetails && (
          <div className="grid grid-cols-2 gap-2 text-xs py-1 text-[var(--text-2)]">
            <div>
              <span className="text-[var(--text-3)] block">Reg No:</span>
              <span className="font-mono text-[var(--text)]">{bus.regNo}</span>
            </div>
            <div>
              <span className="text-[var(--text-3)] block">Depot:</span>
              <span className="text-[var(--text)]">{bus.depot}</span>
            </div>
            <div>
              <span className="text-[var(--text-3)] block">Capacity:</span>
              <span className="text-[var(--text)]">{bus.capacity} seats</span>
            </div>
            <div>
              <span className="text-[var(--text-3)] block">Speed:</span>
              <span className="text-[var(--text)]">28 km/h (live)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

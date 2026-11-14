import RouteChip from './RouteChip';
import type { BusType } from '../types/transit';

interface BusRowProps {
  routeNo: string;
  type: BusType;
  destination: string;
  etaMinutes: number;
  walkMinutes?: number;
  fare?: number;
  crowding?: 'low' | 'medium' | 'high';
  isCatchable?: boolean;
  tracked?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function BusRow({
  routeNo,
  type,
  destination,
  etaMinutes,
  walkMinutes = 4,
  fare,
  crowding = 'low',
  isCatchable = true,
  tracked = false,
  onClick,
  className = '',
}: BusRowProps) {
  const getCrowdingInfo = () => {
    switch (crowding) {
      case 'low':
        return { label: 'Seats available', dotClass: 'bg-[var(--sage-400)]' };
      case 'medium':
        return { label: 'Standing room', dotClass: 'bg-[var(--amber-500)]' };
      case 'high':
        return { label: 'Very crowded', dotClass: 'bg-[var(--red-600)]' };
    }
  };

  const crowd = getCrowdingInfo();

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={[
        'flex items-center justify-between p-3 min-h-[56px] rounded-[var(--r-md)] border border-transparent select-none cursor-pointer',
        'hover:bg-[var(--surface-2)] active:bg-[var(--primary-50)]',
        'transition-colors duration-[var(--dur-1)]',
        !isCatchable ? 'opacity-50' : '',
        tracked ? 'border-[var(--amber-500)] bg-[var(--amber-100)]/30' : '',
        className,
      ].join(' ')}
    >
      <div className="flex items-center gap-3 min-w-0">
        <RouteChip routeNo={routeNo} type={type} tracked={tracked} />
        <div className="flex flex-col min-w-0">
          <div className="text-sm font-medium text-[var(--text)] truncate">
            towards {destination}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-2)] mt-0.5">
            <span className="inline-flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${crowd.dotClass}`} />
              {crowd.label}
            </span>
            {walkMinutes !== undefined && (
              <>
                <span>•</span>
                <span>{walkMinutes} min walk</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 pl-3">
        {fare !== undefined && (
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 mb-0.5 shadow-sm">
            ₹{fare}
          </span>
        )}
        {isCatchable ? (
          <>
            <span
              className="text-base font-semibold text-[var(--text)]"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {etaMinutes <= 0 ? 'Due' : `${etaMinutes} min`}
            </span>
            <span className="text-[11px] text-[var(--text-3)]">ETA</span>
          </>
        ) : (
          <span className="text-[11px] text-[var(--red-600)] font-medium text-right leading-tight max-w-[90px]">
            Leaves before you arrive
          </span>
        )}
      </div>
    </div>
  );
}

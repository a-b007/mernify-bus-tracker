import { Armchair, Users, UsersThree } from '@phosphor-icons/react';
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

const CROWD = {
  low: { label: 'Seats available', Icon: Armchair, color: 'text-[var(--primary-700)]' },
  medium: { label: 'Standing room', Icon: Users, color: 'text-[var(--amber-500)]' },
  high: { label: 'Very crowded', Icon: UsersThree, color: 'text-[var(--red-600)]' },
} as const;

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
  const crowd = CROWD[crowding];

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
        'flex items-center justify-between gap-4 min-h-16 px-3 py-3 -mx-3 rounded-[var(--r-md)] select-none cursor-pointer',
        'transition-colors duration-[var(--dur-1)] active:bg-[var(--primary-50)] hover:bg-[var(--surface-2)]',
        tracked ? 'bg-[var(--amber-100)]' : '',
        className,
      ].join(' ')}
    >
      <div className={`flex items-center gap-3 min-w-0 ${isCatchable ? '' : 'opacity-60'}`}>
        <RouteChip routeNo={routeNo} type={type} tracked={tracked} />
        <div className="flex flex-col min-w-0">
          <span className="text-base font-medium text-[var(--text)] truncate">Towards {destination}</span>
          <span className="flex items-center gap-2 text-xs text-[var(--text-2)]">
            <crowd.Icon size={14} className={crowd.color} aria-hidden="true" />
            <span className="truncate">{crowd.label}</span>
            {walkMinutes !== undefined && <span className="shrink-0 text-[var(--text-3)]">{walkMinutes} min walk</span>}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 text-right">
        {isCatchable ? (
          <>
            <span className="text-md font-semibold tabular-nums text-[var(--text)]">
              {etaMinutes <= 0 ? 'Due' : `${etaMinutes} min`}
            </span>
            {fare !== undefined && <span className="text-xs text-[var(--text-3)] tabular-nums">₹{fare}</span>}
          </>
        ) : (
          <span className="text-xs font-medium text-[var(--red-600)] max-w-24 leading-4">Leaves before you arrive</span>
        )}
      </div>
    </div>
  );
}

import { Snowflake, Lightning, Users, Clock } from '@phosphor-icons/react';
import { useJourneyStore } from '../stores/journey';
import type { JourneyFilters } from '../types/transit';

const FILTERS: { key: keyof JourneyFilters; label: string; Icon?: typeof Snowflake }[] = [
  { key: 'ac', label: 'AC', Icon: Snowflake },
  { key: 'nonAc', label: 'Non-AC' },
  { key: 'electric', label: 'Electric', Icon: Lightning },
  { key: 'notCrowded', label: 'Not crowded', Icon: Users },
  { key: 'within10m', label: 'Within 10 min', Icon: Clock },
];

export default function FilterBar({ className = '' }: { className?: string }) {
  const { filters, toggleFilter } = useJourneyStore();

  return (
    <div
      role="group"
      aria-label="Filter buses"
      className={`flex items-center gap-2 overflow-x-auto no-scrollbar [mask-image:linear-gradient(90deg,#000_calc(100%-24px),transparent)] pr-6 ${className}`}
    >
      {FILTERS.map(({ key, label, Icon }) => (
        <button key={key} type="button" className="chip" aria-pressed={filters[key]} onClick={() => toggleFilter(key)}>
          {Icon && <Icon size={16} weight={filters[key] ? 'fill' : 'regular'} aria-hidden="true" />}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

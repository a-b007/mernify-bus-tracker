import { Snowflake, Lightning, Users, Clock } from '@phosphor-icons/react';
import { useJourneyStore } from '../stores/journey';

export default function FilterBar() {
  const { filters, toggleFilter } = useJourneyStore();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-2 no-scrollbar text-xs">
      {/* AC Filter */}
      <button
        type="button"
        onClick={() => toggleFilter('ac')}
        className={[
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-pill)] border select-none transition-colors duration-[var(--dur-1)] shrink-0',
          filters.ac
            ? 'bg-[var(--primary-700)] text-white border-[var(--primary-700)]'
            : 'bg-[var(--paper)] text-[var(--text-2)] border-[var(--border)] hover:bg-[var(--surface-2)]',
        ].join(' ')}
      >
        <Snowflake size={13} weight="regular" />
        <span>AC</span>
      </button>

      {/* Non-AC Filter */}
      <button
        type="button"
        onClick={() => toggleFilter('nonAc')}
        className={[
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-pill)] border select-none transition-colors duration-[var(--dur-1)] shrink-0',
          filters.nonAc
            ? 'bg-[var(--text)] text-[var(--paper)] border-[var(--text)]'
            : 'bg-[var(--paper)] text-[var(--text-2)] border-[var(--border)] hover:bg-[var(--surface-2)]',
        ].join(' ')}
      >
        <span>Non-AC</span>
      </button>

      {/* Electric Filter */}
      <button
        type="button"
        onClick={() => toggleFilter('electric')}
        className={[
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-pill)] border select-none transition-colors duration-[var(--dur-1)] shrink-0',
          filters.electric
            ? 'bg-[var(--text)] text-[var(--paper)] border-[var(--text)]'
            : 'bg-[var(--paper)] text-[var(--text-2)] border-[var(--border)] hover:bg-[var(--surface-2)]',
        ].join(' ')}
      >
        <Lightning size={13} weight="regular" />
        <span>Electric</span>
      </button>

      {/* Not Crowded Filter */}
      <button
        type="button"
        onClick={() => toggleFilter('notCrowded')}
        className={[
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-pill)] border select-none transition-colors duration-[var(--dur-1)] shrink-0',
          filters.notCrowded
            ? 'bg-[var(--sage-400)] text-white border-[var(--sage-400)]'
            : 'bg-[var(--paper)] text-[var(--text-2)] border-[var(--border)] hover:bg-[var(--surface-2)]',
        ].join(' ')}
      >
        <Users size={13} weight="regular" />
        <span>Not crowded</span>
      </button>

      {/* Within 10 min */}
      <button
        type="button"
        onClick={() => toggleFilter('within10m')}
        className={[
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-pill)] border select-none transition-colors duration-[var(--dur-1)] shrink-0',
          filters.within10m
            ? 'bg-[var(--amber-500)] text-[var(--text)] border-[var(--amber-500)]'
            : 'bg-[var(--paper)] text-[var(--text-2)] border-[var(--border)] hover:bg-[var(--surface-2)]',
        ].join(' ')}
      >
        <Clock size={13} weight="regular" />
        <span>≤ 10 min</span>
      </button>
    </div>
  );
}

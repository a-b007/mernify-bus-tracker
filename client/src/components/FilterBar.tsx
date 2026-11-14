import { Snowflake, Lightning, Users, Clock } from '@phosphor-icons/react';
import { useJourneyStore } from '../stores/journey';

export default function FilterBar() {
  const { filters, toggleFilter } = useJourneyStore();

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto py-1.5 no-scrollbar text-xs"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {/* AC Filter */}
      <button
        type="button"
        onClick={() => toggleFilter('ac')}
        className={[
          'inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-pill)] border select-none transition-all duration-[var(--dur-1)] shrink-0 cursor-pointer',
          filters.ac
            ? 'bg-[#00C4B4] text-[#042F2E] border-[#00A89A] font-bold shadow-xs'
            : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)] font-medium',
        ].join(' ')}
      >
        <Snowflake size={13} weight="bold" />
        <span>AC</span>
      </button>

      {/* Non-AC Filter */}
      <button
        type="button"
        onClick={() => toggleFilter('nonAc')}
        className={[
          'inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-pill)] border select-none transition-all duration-[var(--dur-1)] shrink-0 cursor-pointer',
          filters.nonAc
            ? 'bg-[#FFB800] text-[#0F172A] border-[#E5A700] font-bold shadow-xs'
            : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)] font-medium',
        ].join(' ')}
      >
        <span>Non-AC</span>
      </button>

      {/* Electric Filter */}
      <button
        type="button"
        onClick={() => toggleFilter('electric')}
        className={[
          'inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-pill)] border select-none transition-all duration-[var(--dur-1)] shrink-0 cursor-pointer',
          filters.electric
            ? 'bg-[#0E90FF] text-white border-[#0070E0] font-bold shadow-xs'
            : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)] font-medium',
        ].join(' ')}
      >
        <Lightning size={13} weight="fill" />
        <span>Electric</span>
      </button>

      {/* Not Crowded Filter */}
      <button
        type="button"
        onClick={() => toggleFilter('notCrowded')}
        className={[
          'inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-pill)] border select-none transition-all duration-[var(--dur-1)] shrink-0 cursor-pointer',
          filters.notCrowded
            ? 'bg-[#2F675B] text-white border-[#428E7E] font-semibold shadow-xs'
            : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)] font-medium',
        ].join(' ')}
      >
        <Users size={13} weight="bold" />
        <span>Not crowded</span>
      </button>

      {/* Within 10 min */}
      <button
        type="button"
        onClick={() => toggleFilter('within10m')}
        className={[
          'inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-pill)] border select-none transition-all duration-[var(--dur-1)] shrink-0 cursor-pointer',
          filters.within10m
            ? 'bg-[#D97706] text-white border-[#F59E0B] font-semibold shadow-xs'
            : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)] font-medium',
        ].join(' ')}
      >
        <Clock size={13} weight="bold" />
        <span>≤ 10 min</span>
      </button>
    </div>
  );
}

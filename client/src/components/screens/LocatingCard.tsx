import { WarningCircle, ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import { useJourneyStore } from '../../stores/journey';

interface LocatingCardProps {
  onSearchFallback: () => void;
  onUseMajestic: () => void;
}

export default function LocatingCard({ onSearchFallback, onUseMajestic }: LocatingCardProps) {
  const { locatingError } = useJourneyStore();

  return (
    <div className="flex flex-col gap-4 py-2">
      {!locatingError ? (
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--primary-600)] border-t-transparent animate-spin" />
          <span className="text-sm font-medium text-[var(--text)]">Finding you…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 p-3 rounded-[var(--r-md)] bg-[var(--red-100)] text-[var(--text)] border border-[var(--red-600)]">
            <WarningCircle size={20} weight="fill" className="text-[var(--red-600)] shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold block">{locatingError}</span>
              Bengaluru coordinates (~12.8-13.1 N, ~77.4-77.8 E) are needed for local live buses.
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={onUseMajestic}
              className={[
                'flex items-center justify-between w-full h-[40px] px-3',
                'bg-[var(--primary-600)] text-white text-xs font-medium rounded-[var(--r-md)]',
                'hover:bg-[var(--primary-700)] transition-colors duration-[var(--dur-1)]',
              ].join(' ')}
            >
              <span>Explore Kempegowda (Majestic) Bus Station</span>
              <ArrowRight size={16} weight="bold" />
            </button>

            <button
              type="button"
              onClick={onSearchFallback}
              className={[
                'flex items-center justify-center gap-1.5 w-full h-[40px] px-3',
                'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] text-xs font-medium rounded-[var(--r-md)]',
                'hover:bg-[var(--border)] transition-colors duration-[var(--dur-1)]',
              ].join(' ')}
            >
              <MagnifyingGlass size={16} />
              <span>Search a place instead</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

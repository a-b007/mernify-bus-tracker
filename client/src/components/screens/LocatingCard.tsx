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
        <div className="flex items-center gap-3 py-4">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--primary-600)] border-t-transparent animate-spin" />
          <span className="text-sm font-semibold text-[var(--text)]">Finding your location…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 p-3 rounded-[var(--r-md)] bg-[var(--red-100)] text-[var(--text)] border border-[var(--red-600)] shadow-xs">
            <WarningCircle size={20} weight="fill" className="text-[var(--red-600)] shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold block text-[var(--text)]">{locatingError}</span>
              Bengaluru coordinates (~12.8–13.1° N, ~77.4–77.8° E) are needed for local live buses.
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              onClick={onUseMajestic}
              className={[
                'flex items-center justify-between w-full h-[44px] px-3.5 cursor-pointer',
                'bg-[var(--primary-600)] text-white text-xs font-semibold rounded-[var(--r-md)]',
                'hover:bg-[var(--primary-700)] active:bg-[var(--primary-800)]',
                'shadow-sm transition-all duration-[var(--dur-1)]',
              ].join(' ')}
            >
              <span>Explore Kempegowda (Majestic) Bus Station</span>
              <ArrowRight size={16} weight="bold" />
            </button>

            <button
              type="button"
              onClick={onSearchFallback}
              className={[
                'flex items-center justify-center gap-2 w-full h-[44px] px-3.5 cursor-pointer',
                'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] text-xs font-semibold rounded-[var(--r-md)]',
                'hover:border-[var(--border-strong)] active:bg-[var(--surface-2-solid)]',
                'transition-all duration-[var(--dur-1)] shadow-xs',
              ].join(' ')}
            >
              <MagnifyingGlass size={16} weight="bold" />
              <span>Search a place instead</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

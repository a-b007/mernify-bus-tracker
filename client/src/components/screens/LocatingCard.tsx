import { WarningCircle, ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import { useJourneyStore } from '../../stores/journey';

interface LocatingCardProps {
  onSearchFallback: () => void;
  onUseMajestic: () => void;
}

export default function LocatingCard({ onSearchFallback, onUseMajestic }: LocatingCardProps) {
  const { locatingError } = useJourneyStore();

  if (!locatingError) {
    return (
      <div className="flex items-center gap-3 py-4" role="status">
        <span className="w-5 h-5 rounded-full border-2 border-[var(--primary-600)] border-t-transparent animate-spin" aria-hidden="true" />
        <span className="text-base font-semibold">Finding you…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 p-4 rounded-[var(--r-md)] bg-[var(--red-100)]" role="alert">
        <WarningCircle size={20} weight="fill" className="text-[var(--red-600)] shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-[var(--text)]">{locatingError}</span>
          <span className="text-[var(--text-2)]">Live buses are only available in Bengaluru.</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button type="button" onClick={onUseMajestic} className="btn btn-primary w-full justify-between">
          <span className="truncate">Show Majestic (Kempegowda) instead</span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <button type="button" onClick={onSearchFallback} className="btn btn-secondary w-full">
          <MagnifyingGlass size={20} aria-hidden="true" />
          Search a place instead
        </button>
      </div>
    </div>
  );
}

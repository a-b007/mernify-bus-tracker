import { NavigationArrow, MagnifyingGlass } from '@phosphor-icons/react';
import { useJourneyStore } from '../../stores/journey';

interface WelcomeCardProps {
  onSearchClick: () => void;
  onLocateClick: () => void;
}

export default function WelcomeCard({ onSearchClick, onLocateClick }: WelcomeCardProps) {
  const { setStep } = useJourneyStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--text)]">
          Where are you right now?
        </h2>
        <p className="text-sm text-[var(--text-2)] mt-1">
          Find live Bengaluru buses and catchable arrival times nearby.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* Primary Action: Geolocation */}
        <button
          type="button"
          onClick={onLocateClick}
          className={[
            'flex items-center justify-center gap-2 w-full h-[44px] px-4',
            'bg-[var(--primary-600)] text-white',
            'font-medium text-sm rounded-[var(--r-md)]',
            'hover:bg-[var(--primary-700)] active:bg-[var(--primary-800)]',
            'shadow-sm transition-colors duration-[var(--dur-1)]',
          ].join(' ')}
        >
          <NavigationArrow size={18} weight="bold" />
          <span>Use my location</span>
        </button>

        {/* Secondary Action: Search */}
        <button
          type="button"
          onClick={onSearchClick}
          className={[
            'flex items-center justify-center gap-2 w-full h-[44px] px-4',
            'bg-[var(--surface-2)] text-[var(--text)]',
            'border border-[var(--border)] font-medium text-sm rounded-[var(--r-md)]',
            'hover:bg-[var(--border)] active:bg-[var(--border-strong)]',
            'transition-colors duration-[var(--dur-1)]',
          ].join(' ')}
        >
          <MagnifyingGlass size={18} weight="regular" />
          <span>Search a place or bus stop</span>
        </button>
      </div>

      {/* Tertiary: Map explore */}
      <button
        type="button"
        onClick={() => setStep('nearby')}
        className="text-xs text-[var(--text-2)] hover:text-[var(--text)] underline text-center pt-1 transition-colors duration-[var(--dur-1)]"
      >
        Just show me the map
      </button>
    </div>
  );
}

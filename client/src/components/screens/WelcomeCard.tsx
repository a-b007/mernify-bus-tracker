import { NavigationArrow, MagnifyingGlass } from '@phosphor-icons/react';
import { useJourneyStore } from '../../stores/journey';

interface WelcomeCardProps {
  onSearchClick: () => void;
  onLocateClick: () => void;
}

export default function WelcomeCard({ onSearchClick, onLocateClick }: WelcomeCardProps) {
  const { setStep } = useJourneyStore();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg">Where are you right now?</h2>
        <p className="text-base text-[var(--text-2)]">Find live Bengaluru buses and the ones you can still catch.</p>
      </div>

      <div className="flex flex-col gap-3">
        <button type="button" onClick={onLocateClick} className="btn btn-primary w-full">
          <NavigationArrow size={20} weight="fill" aria-hidden="true" />
          Use my location
        </button>
        <button type="button" onClick={onSearchClick} className="btn btn-secondary w-full">
          <MagnifyingGlass size={20} aria-hidden="true" />
          Search a place or bus stop
        </button>
      </div>

      <button type="button" onClick={() => setStep('nearby')} className="btn btn-ghost btn-sm self-center">
        Just show me the map
      </button>
    </div>
  );
}

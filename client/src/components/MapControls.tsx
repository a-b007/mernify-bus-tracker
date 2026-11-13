import { Plus, Minus, Crosshair } from '@phosphor-icons/react';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  className?: string;
  isLocating?: boolean;
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  className = '',
  isLocating = false,
}: MapControlsProps) {
  return (
    <div
      className={[
        'fixed bottom-3 right-3 z-10 flex flex-col',
        'bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-md)]',
        'shadow-[var(--shadow-panel)] overflow-hidden',
        className,
      ].join(' ')}
      role="group"
      aria-label="Map navigation controls"
    >
      {/* Zoom In */}
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Zoom in"
        className={[
          'flex items-center justify-center w-10 h-10',
          'text-[var(--text-2)] hover:bg-[var(--surface-2)] active:bg-[var(--primary-50)]',
          'transition-colors duration-[var(--dur-1)]',
        ].join(' ')}
      >
        <Plus size={18} weight="bold" />
      </button>

      <div className="h-px bg-[var(--border)] w-full" />

      {/* Zoom Out */}
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Zoom out"
        className={[
          'flex items-center justify-center w-10 h-10',
          'text-[var(--text-2)] hover:bg-[var(--surface-2)] active:bg-[var(--primary-50)]',
          'transition-colors duration-[var(--dur-1)]',
        ].join(' ')}
      >
        <Minus size={18} weight="bold" />
      </button>

      <div className="h-px bg-[var(--border)] w-full" />

      {/* Locate Me */}
      <button
        type="button"
        onClick={onLocate}
        aria-label="Find my location"
        className={[
          'flex items-center justify-center w-10 h-10',
          'text-[var(--text-2)] hover:bg-[var(--surface-2)] active:bg-[var(--primary-50)]',
          'transition-colors duration-[var(--dur-1)]',
          isLocating ? 'animate-pulse text-[var(--location)]' : '',
        ].join(' ')}
      >
        <Crosshair size={20} weight={isLocating ? 'fill' : 'regular'} />
      </button>
    </div>
  );
}

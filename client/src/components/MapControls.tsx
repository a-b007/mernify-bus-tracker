import { Plus, Minus, Crosshair } from '@phosphor-icons/react';
import { useMapStore } from '../stores/map';

interface MapControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
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
  const map = useMapStore((s) => s.map);

  const handleZoomIn = () => {
    if (onZoomIn) {
      onZoomIn();
    } else if (map) {
      map.zoomIn({ duration: 300 });
    }
  };

  const handleZoomOut = () => {
    if (onZoomOut) {
      onZoomOut();
    } else if (map) {
      map.zoomOut({ duration: 300 });
    }
  };

  return (
    <div
      className={[
        'fixed bottom-3 right-3 z-10 flex flex-col',
        'bg-[var(--surface)] backdrop-blur-md',
        'border border-[var(--border)] rounded-[var(--r-md)]',
        'shadow-[var(--shadow-panel)] overflow-hidden',
        className,
      ].join(' ')}
      role="group"
      aria-label="Map navigation controls"
    >
      {/* Zoom In */}
      <button
        type="button"
        onClick={handleZoomIn}
        aria-label="Zoom in"
        className={[
          'flex items-center justify-center w-10 h-10 cursor-pointer',
          'text-[var(--text)] hover:bg-[var(--surface-2)] active:bg-[var(--primary-100)]',
          'transition-colors duration-[var(--dur-1)]',
        ].join(' ')}
      >
        <Plus size={18} weight="bold" />
      </button>

      <div className="h-px bg-[var(--border)] w-full" />

      {/* Zoom Out */}
      <button
        type="button"
        onClick={handleZoomOut}
        aria-label="Zoom out"
        className={[
          'flex items-center justify-center w-10 h-10 cursor-pointer',
          'text-[var(--text)] hover:bg-[var(--surface-2)] active:bg-[var(--primary-100)]',
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
          'flex items-center justify-center w-10 h-10 cursor-pointer',
          'text-[var(--text)] hover:bg-[var(--surface-2)] active:bg-[var(--primary-100)]',
          'transition-colors duration-[var(--dur-1)]',
          isLocating ? 'animate-pulse text-[var(--location)]' : '',
        ].join(' ')}
      >
        <Crosshair size={20} weight={isLocating ? 'fill' : 'bold'} />
      </button>
    </div>
  );
}

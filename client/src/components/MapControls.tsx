import { Plus, Minus, Crosshair } from '@phosphor-icons/react';
import { useMapStore } from '../stores/map';

interface MapControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onLocate: () => void;
  className?: string;
  isLocating?: boolean;
}

export default function MapControls({ onZoomIn, onZoomOut, onLocate, className = '', isLocating = false }: MapControlsProps) {
  const map = useMapStore((s) => s.map);

  const btn = 'flex items-center justify-center w-10 h-10 cursor-pointer text-[var(--text)] transition-colors duration-[var(--dur-1)] hover:bg-[var(--surface-2)] active:bg-[var(--primary-100)]';

  return (
    <div
      role="group"
      aria-label="Map controls"
      className={[
        'fixed bottom-4 right-4 z-10 flex flex-col overflow-hidden',
        'bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--r-md)] shadow-[var(--shadow-panel)]',
        'transition-[right] duration-[var(--dur-3)] ease-[var(--ease-out)]',
        className,
      ].join(' ')}
    >
      <button type="button" aria-label="Zoom in" className={btn} onClick={() => (onZoomIn ? onZoomIn() : map?.zoomIn({ duration: 300 }))}>
        <Plus size={20} />
      </button>
      <div className="divider" />
      <button type="button" aria-label="Zoom out" className={btn} onClick={() => (onZoomOut ? onZoomOut() : map?.zoomOut({ duration: 300 }))}>
        <Minus size={20} />
      </button>
      <div className="divider" />
      <button
        type="button"
        aria-label="Find my location"
        onClick={onLocate}
        className={`${btn} ${isLocating ? 'animate-pulse text-[var(--location)]' : ''}`}
      >
        <Crosshair size={20} weight={isLocating ? 'fill' : 'regular'} />
      </button>
    </div>
  );
}

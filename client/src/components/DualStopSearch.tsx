import { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, ArrowsDownUp, X } from '@phosphor-icons/react';
import type { Stop } from '../types/transit';

interface DualStopSearchProps {
  stops: Stop[];
  originStop: Stop | null;
  destStop: Stop | null;
  onSelectOrigin: (stop: Stop | null) => void;
  onSelectDest: (stop: Stop | null) => void;
  onSwap?: () => void;
  className?: string;
}

export default function DualStopSearch({
  stops,
  originStop,
  destStop,
  onSelectOrigin,
  onSelectDest,
  onSwap,
  className = '',
}: DualStopSearchProps) {
  const [activeInput, setActiveInput] = useState<'origin' | 'dest' | null>(null);
  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');

  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync query strings with selected stop names
  useEffect(() => {
    if (originStop) setOriginQuery(originStop.name);
    else if (activeInput !== 'origin') setOriginQuery('');
  }, [originStop, activeInput]);

  useEffect(() => {
    if (destStop) setDestQuery(destStop.name);
    else if (activeInput !== 'dest') setDestQuery('');
  }, [destStop, activeInput]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveInput(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter stops for active input
  const filteredStops = useMemo(() => {
    if (!activeInput) return [];
    const query = (activeInput === 'origin' ? originQuery : destQuery).trim().toLowerCase();
    if (!query) {
      // Suggest major stops first
      return stops.slice(0, 12);
    }
    return stops
      .filter((s) => s.name.toLowerCase().includes(query) || (s.zone && s.zone.toLowerCase().includes(query)))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query);
        const bStarts = b.name.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      })
      .slice(0, 15);
  }, [stops, activeInput, originQuery, destQuery]);

  const handleSelect = (stop: Stop) => {
    if (activeInput === 'origin') {
      onSelectOrigin(stop);
      setOriginQuery(stop.name);
      setActiveInput(null);
      // Auto-focus destination if empty
      if (!destStop) {
        setTimeout(() => {
          destInputRef.current?.focus();
          setActiveInput('dest');
        }, 100);
      }
    } else if (activeInput === 'dest') {
      onSelectDest(stop);
      setDestQuery(stop.name);
      setActiveInput(null);
    }
  };

  const handleSwap = () => {
    const prevOrigin = originStop;
    const prevDest = destStop;
    onSelectOrigin(prevDest);
    onSelectDest(prevOrigin);
    setOriginQuery(prevDest?.name || '');
    setDestQuery(prevOrigin?.name || '');
    onSwap?.();
  };

  const clearBtn = (onClear: () => void, label: string) => (
    <button type="button" onClick={onClear} className="icon-btn -mr-3" aria-label={label}>
      <X size={16} />
    </button>
  );

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="flex items-stretch gap-3">
        {/* Route spine: boarding pin → destination pin */}
        <div className="flex flex-col items-center justify-between pt-4 pb-3 shrink-0" aria-hidden="true">
          <MapPin size={20} weight="fill" className="text-[#FE3837]" />
          <span className="flex-1 my-2 border-l-2 border-dotted border-[var(--border-strong)]" />
          <MapPin size={20} weight="fill" className="text-[var(--text)]" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <label className="field">
            <input
              ref={originInputRef}
              type="text"
              aria-label="Boarding stop"
              value={originQuery}
              onChange={(e) => {
                setOriginQuery(e.target.value);
                setActiveInput('origin');
                if (originStop && e.target.value !== originStop.name) onSelectOrigin(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredStops.length > 0) {
                    handleSelect(filteredStops[0]);
                  }
                } else if (e.key === 'Escape') {
                  setActiveInput(null);
                }
              }}
              onFocus={() => setActiveInput('origin')}
              placeholder="Boarding stop (e.g. Majestic)"
            />
            {originQuery &&
              clearBtn(() => {
                setOriginQuery('');
                onSelectOrigin(null);
                originInputRef.current?.focus();
              }, 'Clear boarding stop')}
          </label>

          <label className="field">
            <input
              ref={destInputRef}
              type="text"
              aria-label="Destination stop"
              value={destQuery}
              onChange={(e) => {
                setDestQuery(e.target.value);
                setActiveInput('dest');
                if (destStop && e.target.value !== destStop.name) onSelectDest(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredStops.length > 0) {
                    handleSelect(filteredStops[0]);
                  }
                } else if (e.key === 'Escape') {
                  setActiveInput(null);
                }
              }}
              onFocus={() => setActiveInput('dest')}
              placeholder="Where to? (e.g. ITPL, Silk Board)"
            />
            {destQuery &&
              clearBtn(() => {
                setDestQuery('');
                onSelectDest(null);
                destInputRef.current?.focus();
              }, 'Clear destination')}
          </label>
        </div>

        <button type="button" onClick={handleSwap} aria-label="Swap boarding stop and destination" className="icon-btn self-center -mr-2">
          <ArrowsDownUp size={20} />
        </button>
      </div>

      {activeInput && (
        <div className="menu">
          <div className="flex items-center justify-between px-3 pt-2 pb-2">
            <span className="section-label">{activeInput === 'origin' ? 'Boarding stop' : 'Destination'}</span>
            <span className="text-xs text-[var(--text-3)] tabular-nums">{filteredStops.length} stops</span>
          </div>

          {filteredStops.length === 0 ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--text-2)]">No bus stops match that. Try a landmark or a shorter name.</div>
          ) : (
            filteredStops.map((stop) => {
              const isSelected =
                (activeInput === 'origin' && originStop?._id === stop._id) ||
                (activeInput === 'dest' && destStop?._id === stop._id);
              return (
                <div key={stop._id} role="option" aria-selected={isSelected} data-selected={isSelected} onClick={() => handleSelect(stop)} className="menu-item">
                  <MapPin size={20} weight={isSelected ? 'fill' : 'regular'} className={isSelected ? 'text-[var(--primary-700)] shrink-0' : 'text-[var(--text-3)] shrink-0'} aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-[var(--text)] truncate">{stop.name}</div>
                    <div className="text-xs text-[var(--text-2)] truncate">
                      {stop.zone || 'Bengaluru'} · {stop.routeIds?.length || 0} {stop.routeIds?.length === 1 ? 'route' : 'routes'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

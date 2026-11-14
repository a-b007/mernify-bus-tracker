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

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-2xl bg-white/95 dark:bg-[#1A2332]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] p-2.5 transition-all duration-200 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Origin Stop Input */}
        <div className="relative flex-1 flex items-center bg-slate-50 dark:bg-[#243044] rounded-xl px-3 py-2 border border-slate-200/80 dark:border-slate-700/60 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent transition-all">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 mr-2.5 shrink-0" />
          <input
            ref={originInputRef}
            type="text"
            value={originQuery}
            onChange={(e) => {
              setOriginQuery(e.target.value);
              setActiveInput('origin');
              if (originStop && e.target.value !== originStop.name) {
                onSelectOrigin(null);
              }
            }}
            onFocus={() => setActiveInput('origin')}
            placeholder="Current bus stop (e.g. Electronic City)"
            className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />
          {originQuery && (
            <button
              type="button"
              onClick={() => {
                setOriginQuery('');
                onSelectOrigin(null);
                originInputRef.current?.focus();
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>

        {/* Swap Button */}
        <button
          type="button"
          onClick={handleSwap}
          title="Swap Stops"
          className="self-center p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          <ArrowsDownUp size={18} weight="bold" className="rotate-90 sm:rotate-0" />
        </button>

        {/* Destination Stop Input */}
        <div className="relative flex-1 flex items-center bg-slate-50 dark:bg-[#243044] rounded-xl px-3 py-2 border border-slate-200/80 dark:border-slate-700/60 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <MapPin size={16} weight="fill" className="text-blue-500 mr-2 shrink-0" />
          <input
            ref={destInputRef}
            type="text"
            value={destQuery}
            onChange={(e) => {
              setDestQuery(e.target.value);
              setActiveInput('dest');
              if (destStop && e.target.value !== destStop.name) {
                onSelectDest(null);
              }
            }}
            onFocus={() => setActiveInput('dest')}
            placeholder="Destination bus stop (e.g. Majestic)"
            className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />
          {destQuery && (
            <button
              type="button"
              onClick={() => {
                setDestQuery('');
                onSelectDest(null);
                destInputRef.current?.focus();
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {activeInput && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto p-1.5 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>
              Select {activeInput === 'origin' ? 'Current (Boarding) Stop' : 'Destination Stop'}
            </span>
            <span className="text-[10px] font-normal text-slate-400">
              {filteredStops.length} stops available
            </span>
          </div>

          {filteredStops.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              No bus stops found matching your search
            </div>
          ) : (
            filteredStops.map((stop) => {
              const isSelected =
                (activeInput === 'origin' && originStop?._id === stop._id) ||
                (activeInput === 'dest' && destStop?._id === stop._id);

              return (
                <div
                  key={stop._id}
                  onClick={() => handleSelect(stop)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin
                      size={16}
                      weight={isSelected ? 'fill' : 'regular'}
                      className={activeInput === 'origin' ? 'text-emerald-500' : 'text-blue-500'}
                    />
                    <div className="truncate">
                      <div className="font-medium truncate">{stop.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {stop.zone || 'Bengaluru'} · {stop.routeIds?.length || 0} connecting routes
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-2">
                    {stop._id}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from 'react';
import { Command } from 'cmdk';
import { MagnifyingGlass, Clock, BookmarkSimple, MapPin, Bus, Path, X } from '@phosphor-icons/react';

export interface SearchItem {
  id: string;
  label: string;
  subtitle?: string;
  group: 'Recent' | 'Saved' | 'Places' | 'Bus stops' | 'Routes';
  type: 'place' | 'stop' | 'route' | 'history';
  data?: any;
}

interface SearchFieldProps {
  placeholder?: string;
  items?: SearchItem[];
  onSelect?: (item: SearchItem) => void;
  className?: string;
  autoFocus?: boolean;
}

export default function SearchField({
  placeholder = 'Search place, stop, or route (e.g. ITPL, 335E)…',
  items = [],
  onSelect,
  className = '',
  autoFocus = false,
}: SearchFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: '/' focuses search input, Esc blurs/closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter items based on active search text
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      // Default: show Recent, Saved, Places, and top stops/routes
      return items;
    }

    return items
      .filter((item) => {
        const label = item.label.toLowerCase();
        const subtitle = (item.subtitle || '').toLowerCase();
        return label.includes(query) || subtitle.includes(query);
      })
      .sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();
        const aStarts = aLabel.startsWith(query);
        const bStarts = bLabel.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      });
  }, [items, search]);

  const groups = ['Recent', 'Saved', 'Places', 'Bus stops', 'Routes'] as const;

  const renderGroupIcon = (group: SearchItem['group']) => {
    switch (group) {
      case 'Recent':
        return <Clock size={16} className="text-[var(--text-3)]" />;
      case 'Saved':
        return <BookmarkSimple size={16} className="text-[var(--text-3)]" />;
      case 'Places':
        return <MapPin size={16} className="text-[var(--text-3)]" />;
      case 'Bus stops':
        return <Bus size={16} className="text-[var(--text-3)]" />;
      case 'Routes':
        return <Path size={16} className="text-[var(--text-3)]" />;
    }
  };

  const handleItemSelect = (item: SearchItem) => {
    onSelect?.(item);
    setOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredItems.length > 0) {
      e.preventDefault();
      handleItemSelect(filteredItems[0]);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <Command className="w-full relative" shouldFilter={false}>
        <div className="relative flex items-center w-full">
          <MagnifyingGlass
            size={20}
            weight="regular"
            className="absolute left-3 text-[var(--text-3)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={[
              'w-full h-[44px] pl-10 pr-9',
              'bg-[#F1F5F9] dark:bg-[#243044] text-[var(--text)]',
              'placeholder:text-[var(--text-3)]',
              'border border-slate-200 dark:border-slate-700/80 rounded-[var(--r-md)]',
              'text-[16px] md:text-[14px]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent',
              'transition-all duration-[var(--dur-1)]',
            ].join(' ')}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 p-1 rounded-full text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Clear search"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>

        {open && (
          <div
            className={[
              'absolute top-[calc(100%+6px)] left-0 right-0 z-50',
              // Solid, 100% opaque background to fix transparency completely
              'bg-[#FFFFFF] dark:bg-[#1E293B]',
              'border border-slate-200 dark:border-slate-700/90',
              'rounded-[var(--r-md)]',
              'shadow-[0_20px_60px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.7)]',
              'max-h-[360px] overflow-y-auto p-1.5',
            ].join(' ')}
          >
            <Command.List>
              {filteredItems.length === 0 ? (
                <div className="py-6 px-4 text-center text-sm text-[var(--text-2)]">
                  {search ? `No results found for "${search}"` : 'Search by place, bus stop or route number'}
                </div>
              ) : (
                groups.map((grp) => {
                  const groupItems = filteredItems.filter((item) => item.group === grp);
                  if (groupItems.length === 0) return null;

                  return (
                    <Command.Group
                      key={grp}
                      heading={
                        <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider">
                          {grp}
                        </div>
                      }
                      className="mb-1"
                    >
                      {groupItems.slice(0, 15).map((item) => (
                        <Command.Item
                          key={item.id}
                          value={item.id}
                          onSelect={() => handleItemSelect(item)}
                          className={[
                            'flex items-center gap-3 px-3 py-2.5 min-h-[44px]',
                            'rounded-[var(--r-sm)] cursor-pointer text-sm select-none',
                            'hover:bg-slate-100 dark:hover:bg-slate-700/60 active:bg-[var(--primary-50)]',
                            'transition-colors duration-[var(--dur-1)]',
                          ].join(' ')}
                        >
                          <div className="shrink-0">{renderGroupIcon(item.group)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[var(--text)] truncate">
                              {item.label}
                            </div>
                            {item.subtitle && (
                              <div className="text-xs text-[var(--text-2)] truncate">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })
              )}
            </Command.List>
          </div>
        )}
      </Command>
    </div>
  );
}

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
    const cls = 'text-[var(--text-3)] shrink-0';
    switch (group) {
      case 'Recent': return <Clock size={20} className={cls} aria-hidden="true" />;
      case 'Saved': return <BookmarkSimple size={20} className={cls} aria-hidden="true" />;
      case 'Places': return <MapPin size={20} className={cls} aria-hidden="true" />;
      case 'Bus stops': return <Bus size={20} className={cls} aria-hidden="true" />;
      case 'Routes': return <Path size={20} className={cls} aria-hidden="true" />;
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
        <div className="field">
          <MagnifyingGlass size={20} className="text-[var(--text-3)] shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            aria-label="Search places, bus stops and routes"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                inputRef.current?.focus();
              }}
              className="icon-btn -mr-3"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {open && (
          <div className="menu">
            <Command.List>
              {filteredItems.length === 0 ? (
                <div className="py-6 px-4 text-center text-sm text-[var(--text-2)]">
                  {search ? `No results for “${search}”. Try a stop name or route number.` : 'Search a place, bus stop or route number.'}
                </div>
              ) : (
                groups.map((grp) => {
                  const groupItems = filteredItems.filter((item) => item.group === grp);
                  if (groupItems.length === 0) return null;
                  return (
                    <Command.Group
                      key={grp}
                      heading={<div className="section-label px-3 pt-3 pb-2">{grp}</div>}
                    >
                      {groupItems.slice(0, 15).map((item) => (
                        <Command.Item key={item.id} value={item.id} onSelect={() => handleItemSelect(item)} className="menu-item">
                          {renderGroupIcon(item.group)}
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-medium text-[var(--text)] truncate">{item.label}</div>
                            {item.subtitle && <div className="text-xs text-[var(--text-2)] truncate">{item.subtitle}</div>}
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

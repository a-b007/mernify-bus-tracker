import * as Popover from '@radix-ui/react-popover';
import { Info, Sun, Moon } from '@phosphor-icons/react';
import { useTheme } from '../hooks/useTheme';

interface DemoDataPillProps {
  className?: string;
}

export default function DemoDataPill({ className = '' }: DemoDataPillProps) {
  const { theme, toggle } = useTheme();

  return (
    <div className={`fixed top-3 right-3 z-20 flex items-center gap-2 ${className}`}>
      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        className={[
          'flex items-center justify-center w-8 h-8 cursor-pointer',
          'bg-[var(--surface)] backdrop-blur-md text-[var(--text)]',
          'border border-[var(--border)] rounded-[var(--r-md)]',
          'shadow-[var(--shadow-panel)]',
          'hover:bg-[var(--surface-2)] active:bg-[var(--primary-100)]',
          'transition-colors duration-[var(--dur-1)]',
        ].join(' ')}
      >
        {theme === 'light' ? (
          <Moon size={16} weight="regular" />
        ) : (
          <Sun size={16} weight="regular" />
        )}
      </button>

      {/* Demo Data Pill with Popover */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5',
              'bg-[var(--amber-100)] backdrop-blur-md text-[var(--text)]',
              'border border-[var(--amber-500)] rounded-[var(--r-pill)]',
              'text-[12px] font-semibold tracking-wide cursor-pointer',
              'shadow-[var(--shadow-panel)]',
              'hover:opacity-90 active:opacity-80 transition-opacity duration-[var(--dur-1)]',
            ].join(' ')}
          >
            <Info size={14} weight="bold" className="text-[var(--amber-500)]" />
            <span>Demo data</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="end"
            className={[
              'z-30 w-64 p-3 bg-[var(--surface)] text-[var(--text)]',
              'border border-[var(--border)] rounded-[var(--r-md)]',
              'shadow-[var(--shadow-panel)] text-xs leading-relaxed',
              'focus:outline-none animate-in fade-in-50 duration-[var(--dur-1)]',
            ].join(' ')}
          >
            <p className="font-semibold mb-1 text-[var(--text)]">Simulated Transit Prototype</p>
            <p className="text-[var(--text-2)]">
              Bus positions and arrival times are simulated on real Bengaluru route and stop geometry.
            </p>
            <Popover.Arrow className="fill-[var(--border)]" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

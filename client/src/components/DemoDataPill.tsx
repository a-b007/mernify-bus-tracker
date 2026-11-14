import * as Popover from '@radix-ui/react-popover';
import { Info } from '@phosphor-icons/react';

interface DemoDataPillProps {
  className?: string;
}

/** Persistent honesty marker (DESIGN §10). Sits beside the map controls, never under a panel. */
export default function DemoDataPill({ className = '' }: DemoDataPillProps) {
  return (
    <div className={`fixed bottom-4 right-16 z-10 transition-[right] duration-[var(--dur-3)] ease-[var(--ease-out)] ${className}`}>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 h-10 px-4 cursor-pointer rounded-[var(--r-pill)] bg-[var(--amber-100)] text-[var(--text)] border border-[var(--amber-500)] text-xs font-semibold shadow-[var(--shadow-panel)] transition-opacity duration-[var(--dur-1)] hover:opacity-90"
          >
            <Info size={16} weight="bold" className="text-[var(--amber-500)]" aria-hidden="true" />
            <span>Demo data</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="end"
            sideOffset={8}
            className="z-50 w-72 p-4 flex flex-col gap-2 bg-[var(--surface-solid)] text-[var(--text)] border border-[var(--border)] rounded-[var(--r-md)] shadow-[var(--shadow-panel)] focus:outline-none"
          >
            <h3 className="text-xs">Simulated prototype</h3>
            <p className="text-sm text-[var(--text-2)]">
              Bus positions are simulated on real Bengaluru routes and stops. This is a prototype.
            </p>
            <Popover.Arrow className="fill-[var(--border)]" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

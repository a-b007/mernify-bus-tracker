import type { ReactNode } from 'react';
import { Drawer } from 'vaul';

interface BottomSheetProps {
  children: ReactNode;
  snapPoint?: number | string | null;
  onSnapChange?: (snapPoint: number | string | null) => void;
  className?: string;
}

export default function BottomSheet({
  children,
  snapPoint,
  onSnapChange,
  className = '',
}: BottomSheetProps) {
  // Mobile only (< 640px)
  // Snap points: peek (~112px), half (0.5), full (0.92)
  const snapPoints = ['112px', 0.5, 0.92];

  return (
    <div className="lg:hidden">
      <Drawer.Root
        open={true}
        dismissible={false}
        modal={false}
        snapPoints={snapPoints}
        activeSnapPoint={snapPoint ?? snapPoints[0]}
        setActiveSnapPoint={onSnapChange}
      >
        <Drawer.Portal>
          <Drawer.Content
            aria-describedby={undefined}
            className={[
              'fixed bottom-0 left-0 right-0 z-20 flex flex-col',
              'bg-[#FFFFFF] dark:bg-[#1A2332]',
              'border-t border-x border-slate-200 dark:border-slate-700/80',
              'rounded-t-[var(--r-lg)]',
              'shadow-[var(--shadow-sheet)]',
              'max-h-[calc(100dvh-56px)]',
              'focus:outline-none',
              className,
            ].join(' ')}
          >
            <Drawer.Title className="sr-only">Bus Navigation Panel</Drawer.Title>
            {/* Grab Handle */}
            <div className="py-2.5 flex items-center justify-center shrink-0">
              <div className="w-8 h-1 rounded-full bg-[var(--border-strong)]" />
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

import type { ReactNode } from 'react';
import { Drawer } from 'vaul';

interface BottomSheetProps {
  children: ReactNode;
  snapPoint?: number | string | null;
  onSnapChange?: (snapPoint: number | string | null) => void;
  className?: string;
}

export default function BottomSheet({ children, snapPoint, onSnapChange, className = '' }: BottomSheetProps) {
  // Mobile + small tablets only (< 640px). Snap points: peek (112px), half, full.
  const snapPoints = ['112px', 0.5, 0.92];

  return (
    <div className="sm:hidden">
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
              'panel-surface dots rounded-b-none rounded-t-[var(--r-lg)] border-b-0',
              'shadow-[var(--shadow-sheet)] max-h-[calc(100dvh-56px)] focus:outline-none',
              className,
            ].join(' ')}
          >
            <Drawer.Title className="sr-only">Bus navigation panel</Drawer.Title>
            <div className="py-3 flex items-center justify-center shrink-0">
              <div className="w-8 h-1 rounded-full bg-[var(--border-strong)]" />
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">{children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

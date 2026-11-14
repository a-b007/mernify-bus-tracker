import type { ReactNode } from 'react';
import { ArrowLeft, X } from '@phosphor-icons/react';

interface PanelProps {
  children: ReactNode;
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  footer?: ReactNode;
  className?: string;
  position?: 'left' | 'right';
}

export default function Panel({
  children,
  title,
  onBack,
  onClose,
  footer,
  className = '',
  position = 'left',
}: PanelProps) {
  const positionClasses =
    position === 'right'
      ? 'fixed top-3 right-3 z-30 w-[460px] md:max-lg:w-[390px]'
      : 'fixed top-3 left-3 z-20 w-[384px] md:max-lg:w-[340px]';

  return (
    <aside
      className={[
        // Hidden on mobile; bottom sheet takes over there
        'hidden lg:flex flex-col',
        // Positioning
        positionClasses,
        // Constraints
        'max-h-[calc(100dvh-24px)]',
        // Visual treatment: Solid opaque background with crisp border & deep shadow
        'bg-[#FFFFFF] dark:bg-[#1A2332]',
        'border border-slate-200 dark:border-slate-700/80',
        'rounded-[var(--r-lg)]',
        'shadow-[0_16px_48px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_56px_rgba(0,0,0,0.65)]',
        className,
      ].join(' ')}
    >
      {/* Header */}
      {(title || onBack || onClose) && (
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center w-[44px] h-[44px] -ml-2 rounded-[var(--r-md)] text-[var(--text-2)] hover:bg-[var(--surface-2)] active:bg-[var(--primary-50)] transition-colors duration-[var(--dur-1)]"
              aria-label="Go back"
            >
              <ArrowLeft size={20} weight="regular" />
            </button>
          )}
          {title && (
            <h2 className="flex-1 text-lg font-semibold text-[var(--text)] tracking-[-0.01em]">
              {title}
            </h2>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-[44px] h-[44px] -mr-2 rounded-[var(--r-md)] text-[var(--text-2)] hover:bg-[var(--surface-2)] active:bg-[var(--primary-50)] transition-colors duration-[var(--dur-1)]"
              aria-label="Close panel"
            >
              <X size={20} weight="regular" />
            </button>
          )}
        </div>
      )}

      {/* Divider below header */}
      {(title || onBack || onClose) && (
        <div className="h-px bg-[var(--border)] shrink-0" />
      )}

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>

      {/* Sticky footer */}
      {footer && (
        <>
          <div className="h-px bg-[var(--border)] shrink-0" />
          <div className="shrink-0 px-4 py-3">
            {footer}
          </div>
        </>
      )}
    </aside>
  );
}

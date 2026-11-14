import type { ReactNode } from 'react';
import { ArrowLeft, X } from '@phosphor-icons/react';

interface PanelProps {
  children: ReactNode;
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  footer?: ReactNode;
  className?: string;
}

export default function Panel({
  children,
  title,
  onBack,
  onClose,
  footer,
  className = '',
}: PanelProps) {
  return (
    <aside
      className={[
        // Hidden on mobile; bottom sheet takes over there
        'hidden lg:flex flex-col',
        // Positioning
        'fixed top-3 left-3 z-20',
        // Sizing: 384px on ≥1024, 340px on 640-1023
        'w-[384px] md:max-lg:w-[340px]',
        // Constraints
        'max-h-[calc(100dvh-24px)]',
        // Visual treatment: Felt-like translucent gradient with subtle border & glass blur
        'bg-gradient-to-b from-[rgba(255,255,255,0.88)] to-[rgba(240,245,252,0.76)] dark:from-[rgba(52,63,80,0.80)] dark:to-[rgba(36,44,58,0.72)]',
        'backdrop-blur-xl',
        'border border-[rgba(255,255,255,0.6)] dark:border-[rgba(255,255,255,0.18)]',
        'rounded-[var(--r-lg)]',
        'shadow-[0_12px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)]',
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

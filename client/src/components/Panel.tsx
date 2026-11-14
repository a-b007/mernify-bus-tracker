import type { ReactNode } from 'react';
import { ArrowLeft, Bus, X } from '@phosphor-icons/react';

interface PanelProps {
  children: ReactNode;
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  /** Non-scrolling area under the header (search fields etc). Menus inside it can overflow the body. */
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  position?: 'left' | 'right';
  /** Show the small BusDekho wordmark above the title */
  brand?: boolean;
}

export default function Panel({
  children,
  title,
  onBack,
  onClose,
  toolbar,
  footer,
  className = '',
  position = 'left',
  brand = false,
}: PanelProps) {
  // 16px from every edge. The right panel sits 16px below the 48px nav (16 + 48 + 16).
  const place =
    position === 'right'
      ? 'top-20 right-4 max-h-[calc(100dvh-96px)]'
      : 'top-4 left-4 max-h-[calc(100dvh-32px)]';

  const hasHeader = Boolean(title || onBack || onClose || brand);

  return (
    <aside
      className={[
        'hidden sm:flex flex-col fixed z-20',
        'w-[340px] lg:w-[384px]',
        place,
        'panel-surface dots',
        className,
      ].join(' ')}
    >
      {hasHeader && (
        <header className="flex items-start gap-2 px-5 pt-5 pb-4 shrink-0">
          {onBack && (
            <button type="button" onClick={onBack} className="icon-btn -ml-2 -mt-1" aria-label="Go back">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {brand && (
              <div className="flex items-center gap-2 text-[var(--primary-700)]">
                <Bus size={16} weight="fill" aria-hidden="true" />
                <span className="heading text-xs">BusDekho</span>
              </div>
            )}
            {title && <h2 className="text-md truncate text-[var(--text)]">{title}</h2>}
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="icon-btn -mr-2 -mt-1" aria-label="Close panel">
              <X size={20} />
            </button>
          )}
        </header>
      )}

      {toolbar && <div className="relative z-10 px-5 pb-4 shrink-0 flex flex-col gap-3">{toolbar}</div>}

      {(hasHeader || toolbar) && <div className="divider" />}

      <div className={`flex-1 min-h-0 overflow-y-auto px-5 ${hasHeader || toolbar ? 'py-4' : 'py-5'}`}>{children}</div>

      {footer && (
        <>
          <div className="divider" />
          <div className="shrink-0 px-5 py-4">{footer}</div>
        </>
      )}
    </aside>
  );
}

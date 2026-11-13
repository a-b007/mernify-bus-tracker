import { cva, type VariantProps } from 'class-variance-authority';
import { Snowflake, Lightning } from '@phosphor-icons/react';

const chipVariants = cva(
  [
    'inline-flex items-center justify-center gap-1',
    'h-[24px] min-w-[44px] px-2',
    'rounded-[var(--r-sm)]',
    'text-sm font-semibold tracking-[0.02em]',
    'select-none whitespace-nowrap',
  ].join(' '),
  {
    variants: {
      type: {
        NonAC: 'bg-[var(--text)] text-[var(--paper)]',
        AC: 'bg-[var(--primary-700)] text-white',
        Electric: 'bg-[var(--text)] text-[var(--paper)]',
      },
      tracked: {
        true: 'ring-2 ring-[var(--amber-500)]',
        false: '',
      },
    },
    defaultVariants: {
      type: 'NonAC',
      tracked: false,
    },
  },
);

interface RouteChipProps extends VariantProps<typeof chipVariants> {
  routeNo: string;
  type: 'AC' | 'Electric' | 'NonAC';
  tracked?: boolean;
  className?: string;
}

export default function RouteChip({
  routeNo,
  type = 'NonAC',
  tracked = false,
  className,
}: RouteChipProps) {
  return (
    <span
      className={chipVariants({ type, tracked, className })}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {type === 'AC' && <Snowflake size={14} weight="regular" aria-hidden="true" />}
      {type === 'Electric' && <Lightning size={14} weight="regular" aria-hidden="true" />}
      {routeNo}
    </span>
  );
}

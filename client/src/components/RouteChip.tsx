import { cva, type VariantProps } from 'class-variance-authority';
import { Snowflake, Lightning } from '@phosphor-icons/react';

const chipVariants = cva(
  [
    'inline-flex items-center justify-center gap-1 shrink-0',
    'h-6 min-w-11 px-2 rounded-[var(--r-sm)]',
    'text-xs font-semibold tracking-[0.02em] tabular-nums select-none whitespace-nowrap',
  ].join(' '),
  {
    variants: {
      type: {
        NonAC: 'bg-[var(--ink)] text-[var(--on-ink)]',
        AC: 'bg-[var(--primary-700)] text-[var(--on-primary)]',
        Electric: 'bg-[var(--sage-400)] text-[var(--on-sage)]',
      },
      tracked: {
        true: 'ring-2 ring-[var(--amber-500)]',
        false: '',
      },
    },
    defaultVariants: { type: 'NonAC', tracked: false },
  },
);

interface RouteChipProps extends VariantProps<typeof chipVariants> {
  routeNo: string;
  type?: 'AC' | 'Electric' | 'NonAC';
  tracked?: boolean;
  className?: string;
}

/** The recurring motif. A glyph always accompanies colour (AC = snowflake, Electric = bolt). */
export default function RouteChip({ routeNo, type = 'NonAC', tracked = false, className }: RouteChipProps) {
  return (
    <span className={chipVariants({ type, tracked, className })}>
      {type === 'AC' && <Snowflake size={12} weight="bold" aria-label="AC" />}
      {type === 'Electric' && <Lightning size={12} weight="fill" aria-label="Electric" />}
      <span>{routeNo}</span>
    </span>
  );
}

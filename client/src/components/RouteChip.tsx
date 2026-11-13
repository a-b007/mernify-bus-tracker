import { cva, type VariantProps } from 'class-variance-authority';
import { Snowflake, Lightning } from '@phosphor-icons/react';

const chipVariants = cva(
  [
    'inline-flex items-center justify-center gap-1',
    'h-[24px] min-w-[46px] px-2',
    'rounded-[var(--r-sm)]',
    'text-xs font-bold tracking-[0.02em]',
    'select-none whitespace-nowrap shadow-xs',
    'transition-all duration-[var(--dur-1)]',
  ].join(' '),
  {
    variants: {
      type: {
        NonAC: 'bg-[#18202A] text-white border border-[#2C3747] dark:bg-[#3A4556] dark:text-white dark:border-[#526177]',
        AC: 'bg-[#1E6B5D] text-white border border-[#2C8574] dark:bg-[#2A7E6E] dark:border-[#3D9B88]',
        Electric: 'bg-[#0E5280] text-white border border-[#1A6DA3] dark:bg-[#1A649A] dark:border-[#2B80BC]',
      },
      tracked: {
        true: 'ring-2 ring-[var(--amber-500)] shadow-[0_0_8px_rgba(245,158,11,0.5)]',
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
  type?: 'AC' | 'Electric' | 'NonAC';
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
      {type === 'AC' && <Snowflake size={13} weight="bold" aria-hidden="true" />}
      {type === 'Electric' && <Lightning size={13} weight="fill" aria-hidden="true" />}
      <span>{routeNo}</span>
    </span>
  );
}

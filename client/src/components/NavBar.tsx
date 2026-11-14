import { NavLink } from 'react-router-dom';
import {
  House,
  ChartLineUp,
  Info,
  BookOpenText,
  Bus,
} from '@phosphor-icons/react';

const navItems = [
  { to: '/', label: 'Home', icon: House },
  { to: '/analytics', label: 'Analytics', icon: ChartLineUp },
  { to: '/about', label: 'About', icon: Info },
  { to: '/guide', label: 'User Guide', icon: BookOpenText },
];

export default function NavBar() {
  return (
    <nav
      className={[
        'fixed top-3 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-1 px-2 py-1.5',
        'bg-white/80 dark:bg-[#1A2332]/85',
        'backdrop-blur-xl',
        'border border-slate-200/70 dark:border-slate-700/60',
        'rounded-full',
        'shadow-[0_4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_6px_32px_rgba(0,0,0,0.45)]',
      ].join(' ')}
    >
      {/* Brand mark */}
      <div className="flex items-center gap-1.5 pl-2 pr-3 border-r border-slate-200 dark:border-slate-700/60 mr-1">
        <Bus size={22} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-bold tracking-tight text-[var(--text)] hidden sm:inline">
          Bus Twin
        </span>
      </div>

      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            [
              'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium',
              'transition-all duration-200 select-none whitespace-nowrap',
              isActive
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700/50',
            ].join(' ')
          }
        >
          <Icon size={18} weight="regular" />
          <span className="hidden md:inline">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

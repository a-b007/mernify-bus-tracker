import { NavLink, useLocation } from 'react-router-dom';
import { House, ChartLineUp, Info, BookOpenText, Bus, Sun, Moon } from '@phosphor-icons/react';
import { useTheme } from '../hooks/useTheme';

const navItems = [
  { to: '/', label: 'Map', icon: House },
  { to: '/analytics', label: 'Analytics', icon: ChartLineUp },
  { to: '/about', label: 'About', icon: Info },
  { to: '/guide', label: 'Guide', icon: BookOpenText },
];

export default function NavBar() {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <nav
      aria-label="Main"
      className="fixed top-4 right-4 z-50 flex items-center gap-1 p-1 h-12 rounded-[var(--r-lg)] bg-[var(--surface-solid)] border border-[var(--border)] shadow-[var(--shadow-panel)]"
    >
      {/* On the map page the wordmark lives in the panel header */}
      {!isHome && (
        <div className="hidden sm:flex items-center gap-2 pl-3 pr-4 text-[var(--primary-700)]">
          <Bus size={20} weight="fill" aria-hidden="true" />
          <span className="heading text-sm text-[var(--text)]">Bus Twin</span>
        </div>
      )}

      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          aria-label={label}
          className={({ isActive }) =>
            [
              'flex items-center justify-center gap-2 h-10 min-w-10 px-3 rounded-[var(--r-md)]',
              'text-sm font-semibold select-none whitespace-nowrap',
              'transition-colors duration-[var(--dur-1)]',
              isActive
                ? 'bg-[var(--primary-100)] text-[var(--primary-700)]'
                : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
            ].join(' ')
          }
        >
          <Icon size={20} aria-hidden="true" />
          <span className="hidden lg:inline">{label}</span>
        </NavLink>
      ))}

      <span className="w-px h-6 bg-[var(--border)] mx-1" aria-hidden="true" />

      <button
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        className="icon-btn"
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>
    </nav>
  );
}

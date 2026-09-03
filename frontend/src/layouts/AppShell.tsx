import { useEffect, useState, type ReactNode } from 'react';
import Button from '../components/ui/Button';
import type { DashboardPageName } from '../pages/dashboard-pages/_shared/DashboardPageShell';
import './app-shell.css';

type AppShellProps = {
  activePage: DashboardPageName;
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
  className?: string;
  children: ReactNode;
};

type NavGroup = {
  label: string;
  items: DashboardPageName[];
};

const navigationGroups: NavGroup[] = [
  { label: 'Main', items: ['Dashboard'] },
  { label: 'Catalog', items: ['Products', 'Categories', 'Suppliers'] },
  { label: 'Operations', items: ['Inventory', 'Sales History'] },
  { label: 'Planning', items: ['Forecasting', 'Reports'] },
  { label: 'Administration', items: ['User Management', 'Settings'] },
];

const sectionByPage = navigationGroups.reduce<Record<DashboardPageName, string>>(
  (sections, group) => {
    group.items.forEach((item) => {
      sections[item] = group.label;
    });
    return sections;
  },
  {} as Record<DashboardPageName, string>,
);

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

function NavIcon({ page }: { page: DashboardPageName }) {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (page) {
    case 'Dashboard':
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case 'Products':
      return (
        <svg {...commonProps}>
          <path d="M21 8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case 'Categories':
      return (
        <svg {...commonProps}>
          <path d="M4 5h16" />
          <path d="M4 12h16" />
          <path d="M4 19h16" />
          <path d="M8 5v14" />
        </svg>
      );
    case 'Suppliers':
      return (
        <svg {...commonProps}>
          <path d="M3 7h11v10H3Z" />
          <path d="M14 11h3l4 4v2h-7Z" />
          <circle cx="7" cy="19" r="2" />
          <circle cx="17" cy="19" r="2" />
        </svg>
      );
    case 'Inventory':
      return (
        <svg {...commonProps}>
          <path d="M4 4h16v5H4Z" />
          <path d="M6 9v11h12V9" />
          <path d="M9 13h6" />
        </svg>
      );
    case 'Sales History':
      return (
        <svg {...commonProps}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="m8 15 3-4 3 2 4-6" />
        </svg>
      );
    case 'Forecasting':
      return (
        <svg {...commonProps}>
          <path d="M4 19V5" />
          <path d="M8 17V9" />
          <path d="M12 17V5" />
          <path d="M16 17v-6" />
          <path d="M20 17v-3" />
        </svg>
      );
    case 'Reports':
      return (
        <svg {...commonProps}>
          <path d="M6 3h9l3 3v15H6Z" />
          <path d="M14 3v4h4" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
      );
    case 'User Management':
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M16 11h5" />
          <path d="M18.5 8.5v5" />
        </svg>
      );
    case 'Settings':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a8 8 0 0 0 .1-6" />
          <path d="M4.5 9a8 8 0 0 0 .1 6" />
          <path d="m8 4 1.5 2.5" />
          <path d="m16 4-1.5 2.5" />
          <path d="m8 20 1.5-2.5" />
          <path d="m16 20-1.5-2.5" />
        </svg>
      );
  }
}

export default function AppShell({
  activePage,
  userEmail,
  onLogout,
  onNavigate,
  className,
  children,
}: AppShellProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(false);
  const activeSection = sectionByPage[activePage];
  const isNavHidden = isMobileNav && !isNavOpen;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)');
    const syncNavMode = () => {
      setIsMobileNav(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setIsNavOpen(false);
      }
    };

    syncNavMode();
    mediaQuery.addEventListener('change', syncNavMode);

    return () => mediaQuery.removeEventListener('change', syncNavMode);
  }, []);

  useEffect(() => {
    if (!isNavOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNavOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isNavOpen]);

  const handleNavigate = (page: DashboardPageName) => {
    onNavigate?.(page);
    setIsNavOpen(false);
  };

  return (
    <div
      className={classNames(
        'app-shell',
        isNavOpen && 'app-shell--nav-open',
        className,
      )}
    >
      <aside
        id="app-shell-sidebar"
        className="app-shell__sidebar"
        aria-label="Primary navigation"
        aria-hidden={isNavHidden || undefined}
      >
        <div className="app-shell__brand" aria-label="Sales and Inventory System">
          <span className="app-shell__brand-mark" aria-hidden="true">
            SI
          </span>
          <div>
            <p className="app-shell__brand-name">Sales & Inventory</p>
            <p className="app-shell__brand-subtitle">Predictive analysis</p>
          </div>
        </div>

        <nav className="app-shell__nav" aria-label="Dashboard sections">
          {navigationGroups.map((group) => (
            <section className="app-shell__nav-group" key={group.label}>
              <h2 className="app-shell__nav-label">{group.label}</h2>
              <ul className="app-shell__nav-list">
                {group.items.map((item) => {
                  const isActive = item === activePage;

                  return (
                    <li key={item}>
                      <button
                        type="button"
                        className={classNames(
                          'app-shell__nav-item',
                          isActive && 'is-active',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                        tabIndex={isNavHidden ? -1 : undefined}
                        onClick={() => handleNavigate(item)}
                      >
                        <span className="app-shell__nav-icon">
                          <NavIcon page={item} />
                        </span>
                        <span>{item}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </aside>

      {isNavOpen ? (
        <button
          type="button"
          className="app-shell__overlay"
          aria-label="Close navigation"
          onClick={() => setIsNavOpen(false)}
        />
      ) : null}

      <div className="app-shell__body">
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-left">
            <button
              type="button"
              className="app-shell__menu-button"
              aria-label={isNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-controls="app-shell-sidebar"
              aria-expanded={isNavOpen}
              onClick={() => setIsNavOpen((current) => !current)}
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
            <div className="app-shell__context" aria-label="Current section">
              <span>Section</span>
              <strong>{activeSection}</strong>
            </div>
          </div>

          {userEmail || onLogout ? (
            <div className="app-shell__user-area">
              {userEmail ? (
                <span className="app-shell__user-email" title={userEmail}>
                  {userEmail}
                </span>
              ) : null}
              {onLogout ? (
                <Button variant="secondary" onClick={onLogout}>
                  Log out
                </Button>
              ) : null}
            </div>
          ) : null}
        </header>

        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}

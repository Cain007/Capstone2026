import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  BookOpen,
  ChartNoAxesCombined,
  ClipboardList,
  FileChartColumn,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '../components/shadcn/ui/badge';
import { Button } from '../components/shadcn/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/shadcn/ui/sheet';
import type { DashboardPageName } from '../pages/dashboard-pages/_shared/DashboardPageShell';
import type { UserRole } from '../types/auth';
import NotificationCenter from '../components/notifications/NotificationCenter';
import './app-shell.css';
import BrandLogo from '../components/brand/BrandLogo';
import ThemeToggle from '../components/theme/ThemeToggle';

type AppShellProps = {
  activePage: DashboardPageName;
  userEmail?: string;
  userRole?: UserRole;
  userDisplayName?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
  className?: string;
  children: ReactNode;
};

type NavGroup = {
  label: string;
  items: DashboardPageName[];
  roles?: UserRole[];
};

const navigationGroups: NavGroup[] = [
  { label: 'Overview', items: ['Dashboard'], roles: ['Admin'] },
  { label: 'Operations', items: ['Products', 'Categories', 'Suppliers', 'Inventory', 'Stock Movements'], roles: ['Admin'] },
  { label: 'Sales', items: ['Sales History'], roles: ['Admin'] },
  { label: 'Intelligence', items: ['Forecasting', 'Reports'], roles: ['Admin'] },
  { label: 'Procurement', items: ['Purchase Orders'], roles: ['Admin'] },
  { label: 'Administration', items: ['User Management', 'Audit Logs', 'Account & System'], roles: ['Admin'] },
  { label: 'Operations', items: ['POS', 'Sales History'], roles: ['Staff'] },
  { label: 'Catalog', items: ['Products', 'Categories'], roles: ['Staff'] },
  { label: 'Account', items: ['Account & System'], roles: ['Staff'] },
  { label: 'Support', items: ['Help & System Guide'] },
];

const pageIcons: Record<DashboardPageName, LucideIcon> = {
  Dashboard: LayoutDashboard,
  POS: ShoppingCart,
  Products: Package,
  Categories: Tags,
  Suppliers: Truck,
  'Purchase Orders': ClipboardList,
  Inventory: Warehouse,
  'Stock Movements': ArrowLeftRight,
  'Sales History': ReceiptText,
  Forecasting: ChartNoAxesCombined,
  Reports: FileChartColumn,
  'User Management': Users,
  'Audit Logs': ScrollText,
  'Account & System': Settings,
  'Help & System Guide': BookOpen,
};

const pageLabels: Record<DashboardPageName, string> = {
  Dashboard: 'Dashboard',
  POS: 'POS',
  Products: 'Products',
  Categories: 'Categories',
  Suppliers: 'Suppliers',
  'Purchase Orders': 'Purchase Orders',
  Inventory: 'Inventory',
  'Stock Movements': 'Stock Movements',
  'Sales History': 'Sales History',
  Forecasting: 'Predictive Analysis',
  Reports: 'Reports',
  'User Management': 'User Management',
  'Audit Logs': 'Audit Logs',
  'Account & System': 'Account & System',
  'Help & System Guide': 'Help & System Guide',
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

function userInitials(name?: string, email?: string) {
  const source = (name || email || 'User').trim();
  const words = source.includes('@') ? source.split('@')[0].split(/[._-]+/) : source.split(/\s+/);
  return words
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || 'U';
}

type NavListProps = {
  groups: NavGroup[];
  activePage: DashboardPageName;
  collapsed?: boolean;
  hidden?: boolean;
  onNavigate: (page: DashboardPageName) => void;
};

function NavButton({
  item,
  isActive,
  collapsed,
  hidden,
  onNavigate,
}: {
  item: DashboardPageName;
  isActive: boolean;
  collapsed?: boolean;
  hidden?: boolean;
  onNavigate: (page: DashboardPageName) => void;
}) {
  const Icon = pageIcons[item];

  return (
    <button
      type="button"
      className={classNames('app-shell__nav-item', isActive && 'is-active')}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? pageLabels[item] : undefined}
      tabIndex={hidden ? -1 : undefined}
      onClick={() => onNavigate(item)}
    >
      <span className="app-shell__nav-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="app-shell__nav-text">{pageLabels[item]}</span>
      {collapsed ? <span className="app-shell__nav-tooltip" role="tooltip">{pageLabels[item]}</span> : null}
    </button>
  );
}

function NavList({ groups, activePage, collapsed, hidden, onNavigate }: NavListProps) {
  return (
    <nav className="app-shell__nav" aria-label="Dashboard sections">
      {groups.map((group) => (
        <section className="app-shell__nav-group" key={group.label}>
          <h2 className="app-shell__nav-label">{group.label}</h2>
          <ul className="app-shell__nav-list">
            {group.items.map((item) => (
              <li key={item}>
                <NavButton
                  item={item}
                  isActive={item === activePage}
                  collapsed={collapsed}
                  hidden={hidden}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function BrandBlock({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="app-shell__brand" aria-label="KING OF CLOUDS VAPE SHOP">
      {collapsed ? <span className="app-shell__brand-mark" aria-hidden="true">KOC</span> : <BrandLogo size={40} decorative />}
      <div className="app-shell__brand-copy">
        <p className="app-shell__brand-name">KING OF CLOUDS</p>
        <p className="app-shell__brand-subtitle">Inventory, Sales &amp; Forecasting</p>
      </div>
      {collapsed ? <span className="sr-only">KING OF CLOUDS</span> : null}
    </div>
  );
}

export default function AppShell({
  activePage,
  userEmail,
  userRole = 'Admin',
  userDisplayName,
  onLogout,
  onNavigate,
  className,
  children,
}: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('koc_sidebar_collapsed') === 'true');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const visibleGroups = useMemo(
    () => navigationGroups.filter((group) => !group.roles || group.roles.includes(userRole)),
    [userRole],
  );
  const activeSection = visibleGroups.find((group) => group.items.includes(activePage))?.label ?? '';
  const identity = userDisplayName || userEmail || 'User';
  const initials = userInitials(userDisplayName, userEmail);

  useEffect(() => {
    localStorage.setItem('koc_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined;

    accountMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
        accountMenuRef.current?.querySelector<HTMLElement>('.app-shell__account-trigger')?.focus();
      } else if (accountMenuRef.current?.contains(event.target as Node) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const items = Array.from(accountMenuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    };

    document.addEventListener('mousedown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isAccountMenuOpen]);

  const handleNavigate = (page: DashboardPageName) => {
    onNavigate?.(page);
    setIsMobileNavOpen(false);
    setIsAccountMenuOpen(false);
  };

  return (
    <div className={classNames('app-shell', isSidebarCollapsed && 'app-shell--collapsed', className)}>
        <aside id="app-shell-sidebar" className="app-shell__sidebar" aria-label="Primary navigation">
          <div className="app-shell__sidebar-header">
            <BrandBlock collapsed={isSidebarCollapsed} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="app-shell__collapse-button"
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setIsSidebarCollapsed((current) => !current)}
            >
              {isSidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </Button>
          </div>

          <div className="app-shell__sidebar-scroll">
            <NavList groups={visibleGroups} activePage={activePage} collapsed={isSidebarCollapsed} onNavigate={handleNavigate} />
          </div>

          <div className="app-shell__sidebar-footer">
            <div className="app-shell__mini-account">
              <span className="app-shell__avatar" aria-hidden="true">{initials}</span>
              <div className="app-shell__mini-account-copy">
                <strong>{identity}</strong>
                <span>{userRole}</span>
              </div>
            </div>
          </div>
        </aside>

        <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <SheetContent side="left" className="app-shell__mobile-sheet">
            <SheetHeader className="app-shell__mobile-sheet-header">
              <BrandBlock />
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">Primary application navigation</SheetDescription>
            </SheetHeader>
            <div className="app-shell__mobile-sheet-scroll">
              <NavList groups={visibleGroups} activePage={activePage} hidden={!isMobileNavOpen} onNavigate={handleNavigate} />
            </div>
            <div className="app-shell__mobile-sheet-footer">
              <div className="app-shell__mini-account">
                <span className="app-shell__avatar" aria-hidden="true">{initials}</span>
                <div className="app-shell__mini-account-copy">
                  <strong>{identity}</strong>
                  <span>{userRole}</span>
                </div>
              </div>
              {onLogout ? (
                <Button type="button" variant="outline" onClick={onLogout}>
                  <LogOut aria-hidden="true" />
                  Logout
                </Button>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>

        <div className="app-shell__body">
          <header className="app-shell__topbar">
            <div className="app-shell__topbar-left">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="app-shell__menu-button"
                aria-label="Open navigation"
                aria-controls="app-shell-sidebar"
                aria-expanded={isMobileNavOpen}
                onClick={() => setIsMobileNavOpen(true)}
              >
                <Menu aria-hidden="true" />
              </Button>
              <div className="app-shell__context" aria-label="Current page">
                <span>{activeSection}</span>
                <strong>{pageLabels[activePage]}</strong>
              </div>
            </div>

            <div className="app-shell__topbar-actions">
              <ThemeToggle />
              {userRole === 'Admin' && <NotificationCenter onNavigate={handleNavigate} onOpen={() => setIsAccountMenuOpen(false)} />}

              <Badge variant="outline" className="app-shell__role-badge">{userRole}</Badge>

              <div className="app-shell__account" ref={accountMenuRef} onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsAccountMenuOpen(false);
              }}>
                <button
                  type="button"
                  className="app-shell__account-trigger"
                  aria-label="Open account menu"
                  aria-expanded={isAccountMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setIsAccountMenuOpen((current) => !current)}
                >
                  <span className="app-shell__avatar" aria-hidden="true">{initials}</span>
                  <span className="app-shell__account-trigger-copy">
                    <strong>{identity}</strong>
                    <span>{userEmail}</span>
                  </span>
                </button>
                {isAccountMenuOpen ? (
                  <div className="app-shell__account-menu" role="menu" aria-label="Account menu">
                    <div className="app-shell__account-menu-label">
                      <span className="app-shell__menu-label">
                        <strong>{identity}</strong>
                        <span>{userRole}</span>
                      </span>
                    </div>
                    <button type="button" className="app-shell__account-menu-item" role="menuitem" onClick={() => handleNavigate('Account & System')}>
                      <Settings aria-hidden="true" />
                      Account &amp; System
                    </button>
                    {onLogout ? (
                      <button
                        type="button"
                        className="app-shell__account-menu-item app-shell__account-menu-item--danger"
                        role="menuitem"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          onLogout();
                        }}
                      >
                        <LogOut aria-hidden="true" />
                        Logout
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="app-shell__main">{children}</main>
        </div>
      </div>
  );
}

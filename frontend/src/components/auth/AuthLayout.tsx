import { ArrowLeft, Boxes, ChartNoAxesCombined, TrendingUp } from 'lucide-react';
import BrandLogo from '../brand/BrandLogo';
import ThemeToggle from '../theme/ThemeToggle';
import type { ReactNode } from 'react';
import './auth-layout.css';

type AuthLayoutProps = {
  onBackHome?: () => void;
  children: ReactNode;
  panelLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  supportingLine?: string;
  mode: 'login' | 'password-change';
};

const capabilities = [
  {
    label: 'Inventory',
    description: 'Real-time stock monitoring',
    icon: Boxes,
    className: 'auth-capability-card--wide',
  },
  {
    label: 'Sales',
    description: 'Centralized transaction tracking',
    icon: ChartNoAxesCombined,
    className: 'auth-capability-card--compact',
  },
  {
    label: 'Forecasting',
    description: 'Moving-average demand insights',
    icon: TrendingUp,
    className: 'auth-capability-card--full',
  },
];

export default function AuthLayout({
  children,
  panelLabel,
  eyebrow,
  title,
  description,
  supportingLine,
  mode,
  onBackHome,
}: AuthLayoutProps) {
  return (
    <main className="auth-page">
      <section className={`auth-shell auth-shell--${mode}`} aria-label={panelLabel}>
        <aside className="auth-brand-panel" aria-label="KING OF CLOUDS VAPE SHOP">
          <div className="auth-brand-lockup">
            <BrandLogo size={64} decorative />
            <div>
              <p className="auth-brand-kicker">KING OF CLOUDS VAPE SHOP</p>
              <p className="auth-brand-descriptor">Inventory, Sales &amp; Forecasting Management</p>
            </div>
          </div>

          <div className="auth-brand-copy">
            <p className="auth-brand-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
            {supportingLine ? <span>{supportingLine}</span> : null}
          </div>

          <div className="auth-capability-grid" aria-label="System capabilities">
            {capabilities.map(({ label, description: capabilityDescription, icon: Icon, className }) => (
              <article className={`auth-capability-card ${className}`} key={label}>
                <Icon aria-hidden="true" />
                <div>
                  <h2>{label}</h2>
                  <p>{capabilityDescription}</p>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <div className="auth-form-panel">
          <div className="auth-public-controls">
            {onBackHome ? <button className="auth-back" type="button" onClick={onBackHome}><ArrowLeft size={16} aria-hidden="true" />Back to Home</button> : <span />}
            <ThemeToggle />
          </div>
          <div className="auth-form-content">
          <div className="auth-mobile-brand" aria-label="KING OF CLOUDS VAPE SHOP">
            <BrandLogo size={56} decorative />
            <div>
              <p className="auth-brand-kicker">KING OF CLOUDS VAPE SHOP</p>
              <p className="auth-brand-descriptor">Inventory, Sales &amp; Forecasting</p>
            </div>
          </div>
          {children}
          </div>
        </div>
      </section>
    </main>
  );
}

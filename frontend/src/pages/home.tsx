import { ArrowRight, Boxes, ChartNoAxesCombined, ClipboardList, ShoppingCart } from 'lucide-react';
import BrandLogo from '../components/brand/BrandLogo';
import ThemeToggle from '../components/theme/ThemeToggle';
import './home.css';

const capabilities = [
  { title: 'Inventory Management', copy: 'Stock levels, product records, and movement history.', Icon: Boxes },
  { title: 'Point of Sale', copy: 'Daily transactions and sales history.', Icon: ShoppingCart },
  { title: 'Predictive Analysis', copy: 'Moving-average demand forecasts and inventory risk.', Icon: ChartNoAxesCombined },
  { title: 'Reporting & Procurement', copy: 'Sales reporting, purchase orders, and receiving.', Icon: ClipboardList },
];

export default function Home({ onSignIn }: { onSignIn: () => void }) {
  return <main className="public-home">
    <header className="public-home__header"><span>Employee workspace</span><ThemeToggle /></header>
    <section className="public-home__intro" aria-labelledby="home-title">
      <BrandLogo size={120} decorative />
      <p className="public-home__descriptor">Inventory, Sales &amp; Forecasting Management</p>
      <h1 id="home-title">KING OF CLOUDS VAPE SHOP</h1>
      <p className="public-home__summary">Manage inventory, sales, purchasing, and demand forecasting from one workspace.</p>
      <button type="button" className="ui-button ui-button--primary" onClick={onSignIn}>Sign In <ArrowRight size={18} aria-hidden="true" /></button>
      <p className="public-home__access">Authorized employee access</p>
    </section>
    <section className="public-home__capabilities" aria-label="System capabilities">
      {capabilities.map(({ title, copy, Icon }) => <article key={title}><Icon size={22} aria-hidden="true" /><h2>{title}</h2><p>{copy}</p></article>)}
    </section>
  </main>;
}

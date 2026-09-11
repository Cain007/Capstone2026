import { Activity, useSyncExternalStore, type ReactNode } from 'react';
import { Monitor, Tablet } from 'lucide-react';
import './unsupported-viewport.css';

const query = window.matchMedia('(min-width: 768px)');
function subscribe(update: () => void) {
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}

export default function ViewportGate({ children }: { children: ReactNode }) {
  const supported = useSyncExternalStore(subscribe, () => query.matches);
  return <>
    {!supported && <main className="unsupported-viewport">
      <div className="unsupported-viewport__brand"><span aria-hidden="true">KOC</span><strong>KING OF CLOUDS VAPE SHOP</strong></div>
      <div className="unsupported-viewport__copy">
        <div className="unsupported-viewport__icons" aria-hidden="true"><Monitor size={40} /><Tablet size={30} /></div>
        <h1>Desktop or Tablet Required</h1>
        <p>This management system is optimized for desktop and tablet screens. Please open it on a computer or iPad/tablet for the best experience.</p>
        <p className="unsupported-viewport__minimum">Minimum supported screen width: 768px.</p>
      </div>
    </main>}
    <Activity mode={supported ? 'visible' : 'hidden'}>{children}</Activity>
  </>;
}

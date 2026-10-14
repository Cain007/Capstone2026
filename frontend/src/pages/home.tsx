import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import BrandLogo from '../components/brand/BrandLogo';
import ThemeToggle from '../components/theme/ThemeToggle';
import './home.css';

type HomeStage = 'intro' | 'intro-exit' | 'access';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function initialStage(): HomeStage {
  return window.matchMedia(reducedMotionQuery).matches ? 'access' : 'intro';
}

export default function Home({ onSignIn }: { onSignIn: () => void }) {
  const [stage, setStage] = useState<HomeStage>(initialStage);

  useEffect(() => {
    const motionPreference = window.matchMedia(reducedMotionQuery);
    if (motionPreference.matches) {
      return;
    }

    const exitTimer = window.setTimeout(() => setStage('intro-exit'), 2200);
    const accessTimer = window.setTimeout(() => setStage('access'), 2800);
    const handleMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) setStage('access');
    };

    motionPreference.addEventListener('change', handleMotionChange);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(accessTimer);
      motionPreference.removeEventListener('change', handleMotionChange);
    };
  }, []);

  const showingAccess = stage === 'access';

  return (
    <main className="public-home">
      <header className="public-home__header">
        <span>Internal Business System</span>
        <ThemeToggle />
      </header>

      {!showingAccess ? (
        <section
          className={`public-home__stage public-home__intro${stage === 'intro-exit' ? ' public-home__intro--exit' : ''}`}
          aria-labelledby="intro-title"
        >
          <BrandLogo size={128} decorative />
          <div className="public-home__identity">
            <h1 id="intro-title">KING OF CLOUDS VAPE SHOP</h1>
            <p>Inventory, Sales &amp; Forecasting Management</p>
          </div>
        </section>
      ) : (
        <section className="public-home__stage public-home__access" aria-labelledby="access-title">
          <BrandLogo size={104} decorative />
          <div className="public-home__identity">
            <h1 id="access-title">KING OF CLOUDS VAPE SHOP</h1>
            <p>Inventory, Sales &amp; Forecasting Management</p>
          </div>
          <div className="public-home__notice">
            <h2>Authorized Employee Access Only</h2>
            <p>For internal company use only.</p>
          </div>
          <button type="button" className="ui-button ui-button--primary" onClick={onSignIn}>
            Sign In
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </section>
      )}
    </main>
  );
}

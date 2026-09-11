import { useTheme } from '../theme/theme';
import './brand-logo.css';

export default function BrandLogo({ size = 48, decorative = false }: { size?: number; decorative?: boolean }) {
  const theme = useTheme();
  return <img className="brand-logo" src={theme === 'dark' ? '/White Logo.png' : '/Black Logo.png'}
    width={size} height={size} style={{ width: size, height: size }}
    alt={decorative ? '' : 'King of Clouds Vape Shop'} aria-hidden={decorative || undefined} />;
}

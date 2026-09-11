import { Moon, Sun } from 'lucide-react';
import { setTheme, useTheme } from './theme';
import './theme.css';

export default function ThemeToggle() {
  const theme = useTheme();
  const label = `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`;
  return <button type="button" className="theme-toggle" aria-label={label} title={label}
    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
    {theme === 'light' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
  </button>;
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ViewportGate from './components/system/UnsupportedViewport'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ViewportGate><App /></ViewportGate>
  </StrictMode>,
)

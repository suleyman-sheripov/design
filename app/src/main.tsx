import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './creative.css'
import App from './App.tsx'

// Reload главной начинает знакомство сверху; адрес конкретного кейса сохраняется.
const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
if (navigation?.type === 'reload' && !location.hash.startsWith('#/work/')) {
  history.replaceState(history.state, '', location.pathname + location.search)
}
if (!location.hash || location.hash === '#') window.scrollTo({top:0,behavior:'instant'})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

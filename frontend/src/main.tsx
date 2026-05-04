import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import { App } from './App'
import { ErrorBoundary } from '@components/ErrorBoundary'
import { initSentry } from '@lib/sentry'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found in index.html')

initSentry()

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

// Register service worker for PWA offline support (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failure is non-critical — app still works online
    })
  })
}

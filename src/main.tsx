import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { APP_VERSION } from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration note:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary appVersion={APP_VERSION}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

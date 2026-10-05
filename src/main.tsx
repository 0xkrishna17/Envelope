import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { APP_VERSION } from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

function activateWaitingServiceWorker(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let isRefreshing = false;

    navigator.serviceWorker.register('/sw.js').then(registration => {
      activateWaitingServiceWorker(registration);
      registration.update().catch(() => undefined);

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            activateWaitingServiceWorker(registration);
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || isRefreshing) return;
        isRefreshing = true;
        window.location.reload();
      });
    }).catch(err => {
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

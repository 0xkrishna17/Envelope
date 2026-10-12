import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { APP_VERSION } from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

async function removeLegacyOfflineCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;

  const keys = await caches.keys();
  await Promise.all(keys.map(key => caches.delete(key)));
}

async function unregisterLegacyServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(registration => registration.unregister()));
}

window.addEventListener('load', () => {
  Promise.all([
    unregisterLegacyServiceWorkers(),
    removeLegacyOfflineCaches(),
  ]).catch(err => {
    console.info('Legacy offline cleanup note:', err);
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary appVersion={APP_VERSION}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

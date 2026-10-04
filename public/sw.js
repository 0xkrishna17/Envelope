// Progressive Web App Service Worker for Envelope Budgeting
const CACHE_NAME = 'envelope-budget-v3';
const APP_SHELL_URLS = ['/', '/index.html'];
const ASSETS_TO_CACHE = [
  ...APP_SHELL_URLS,
  '/manifest.json',
  '/icon.svg',
];

function isCacheableRequest(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;

  return true;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isHtmlResponse(response) {
  return response.headers.get('content-type')?.includes('text/html') ?? false;
}

function canUseResponseForRequest(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  if (isNavigationRequest(request)) return isHtmlResponse(response);

  // A JS/CSS/image/font request receiving HTML is usually an SPA fallback for a
  // missing hashed asset. Never cache or return that as a module response.
  return !isHtmlResponse(response);
}

function putInCache(request, response) {
  if (!isCacheableRequest(request)) return Promise.resolve();
  if (!canUseResponseForRequest(request, response)) return Promise.resolve();

  return caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone())).catch(() => undefined);
}

async function getCachedAppShell() {
  const cache = await caches.open(CACHE_NAME);
  return (await cache.match('/index.html')) || (await cache.match('/'));
}

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (canUseResponseForRequest(request, networkResponse)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/index.html', networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cachedShell = await getCachedAppShell();
    return cachedShell || Response.error();
  }
}

async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    fetch(request)
      .then(networkResponse => putInCache(request, networkResponse))
      .catch(() => undefined);
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  if (!canUseResponseForRequest(request, networkResponse)) {
    return Response.error();
  }

  await putInCache(request, networkResponse.clone());
  return networkResponse;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (!isCacheableRequest(event.request)) {
    return;
  }

  event.respondWith(
    isNavigationRequest(event.request)
      ? handleNavigationRequest(event.request)
      : handleAssetRequest(event.request)
  );
});

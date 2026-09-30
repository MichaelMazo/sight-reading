// Service worker: always fetch the app's own files fresh from the server.
//
// GitHub Pages lets browsers reuse files for 10 minutes, so after a deploy a
// plain reload could still show the old version. Here every same-origin request
// is revalidated with the server (an unchanged file costs a quick 304), so a
// reload always gets the latest code. Other hosts (CDN libraries, piano samples)
// never change and keep their normal caching.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // If the fresh request fails for any reason, fall back to a normal one, so the
  // worker can never make the app worse than it is without it.
  event.respondWith(
    fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }).catch(() => fetch(request)),
  );
});

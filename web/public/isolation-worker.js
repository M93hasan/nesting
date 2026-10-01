// Cross-origin isolation is only for the Serula editor.
// Google sign-in and every cross-origin request are intentionally bypassed.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/google-login.html' || url.pathname.startsWith('/api/auth/')) return;
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.status === 0) return response;
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    const body = [204, 205, 304].includes(response.status) ? null : response.body;
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
  }));
});

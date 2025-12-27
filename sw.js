// Service Worker for Tanda Web App
const CACHE_NAME = 'tanda-web-v3'; // Updated version to force cache refresh
const urlsToCache = [
  '/',
  '/index.html',
  '/feed.html',
  '/products.html',
  '/profile.html',
  '/wallet.html',
  '/cart.html',
  '/orders.html',
  '/analytics.html',
  '/search.html',
    '/js/super-affiliate-api.js?v=3',
  '/Tanda logo.png',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
];

// Install event - cache resources and skip waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all([
        // Delete all old caches
        ...cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        }),
        // Claim all clients to use new service worker immediately
        self.clients.claim()
      ]);
    })
  );
});

// Fetch event - network first, then cache (for better updates)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for POST, PUT, DELETE requests
  if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // NEVER cache API endpoints - always fetch fresh from network
  // This ensures profile data, avatars, and all dynamic content is always up-to-date
  if (url.pathname.includes('/api/') || 
      url.pathname.includes('/users/') ||
      url.pathname.includes('/videos/') ||
      url.pathname.includes('/wallet/') ||
      url.pathname.includes('/commerce/') ||
      url.pathname.includes('/comments/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For HTML files, always try network first to get latest version
  if (event.request.destination === 'document' || 
      event.request.url.includes('.html') ||
      event.request.url.includes('super-affiliate-api.js')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If network succeeds, update cache and return response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request);
        })
    );
  } 
  // For media files (avatars, videos, images), use network-first to avoid stale cache
  // This ensures updated avatars/images show immediately without hard refresh
  else if (url.pathname.includes('/media/') || 
           url.pathname.includes('/avatars/') ||
           url.pathname.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|svg)$/i)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          // Don't cache media files - always fetch fresh
          // This prevents stale avatars/images from showing
          return response;
        })
        .catch(() => {
          // If network fails, try cache as fallback
          return caches.match(event.request);
        })
    );
  } 
  // For other resources, cache first, then network
  else {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request).then((fetchResponse) => {
            // Only cache successful GET/HEAD responses
            if (fetchResponse.ok && (event.request.method === 'GET' || event.request.method === 'HEAD')) {
              const responseClone = fetchResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return fetchResponse;
          });
        })
    );
  }
});

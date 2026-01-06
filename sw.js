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
  '/Tanda logo.webp',
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
  
  // Skip service worker for external R2 storage URLs (CORS issues)
  // These are video/media files from Cloudflare R2 that don't have CORS headers
  if (url.hostname.includes('.r2.dev') || 
      url.hostname.includes('pub-3484fb4b3c5748cd80420365c258aaaa')) {
    // Let browser handle these directly - don't intercept
    event.respondWith(fetch(event.request).catch(() => {
      // If fetch fails (CORS), return a rejected promise to avoid errors
      return Promise.reject(new Error('CORS blocked'));
    }));
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
  // Skip external R2 URLs (already handled above)
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
        .catch((error) => {
          // If network fails (e.g., CORS), don't try cache - just fail silently
          // This prevents CORS errors from propagating
          console.warn('Service worker: Failed to fetch media file:', event.request.url, error);
          return Promise.reject(error);
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
          }).catch((error) => {
            // If fetch fails (e.g., CORS), return error response instead of throwing
            // This prevents uncaught promise rejections
            console.warn('Service worker: Fetch failed:', event.request.url, error);
            return Promise.reject(error);
          });
        })
    );
  }
});

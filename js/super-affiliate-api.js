/**
 * Tanda Super Affiliate API Helper
 * Handles all API calls to Django backend
 * 
 * Author: Tanda Team
 * Version: 1.0.0
 */

// ⚠️ API Base URL Configuration
// Automatically detects environment or uses meta tag configuration
function getApiBaseUrl() {
  // 1. Check for meta tag configuration (highest priority)
  const metaTag = document.querySelector('meta[name="api-base-url"]');
  if (metaTag && metaTag.content) {
    return metaTag.content.endsWith('/api') ? metaTag.content : metaTag.content + '/api';
  }
  
  // 2. Check for environment variable (if using build tools)
  if (typeof process !== 'undefined' && process.env && process.env.API_BASE_URL) {
    return process.env.API_BASE_URL.endsWith('/api') ? process.env.API_BASE_URL : process.env.API_BASE_URL + '/api';
  }
  
  // 3. Auto-detect based on current hostname
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Production domains
  if (hostname.includes('tanda.media') || hostname.includes('railway.app') || hostname.includes('render.com')) {
    // Use HTTPS for production
    return 'https://api.tanda.media/api';
  }
  
  // Development (localhost)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000/api';
  }
  
  // Default fallback (use same origin)
  return '/api';
}

const API_BASE_URL = getApiBaseUrl();

// Safe logging - only logs in development
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('127.0.0.1');

function safeLog(...args) {
  if (isDevelopment) {
    console.log(...args);
  }
  // In production, optionally send to logging service
  // if (window.Sentry) { window.Sentry.captureMessage(args.join(' ')); }
}

// Log the API URL being used (only in development)
safeLog('🔗 API Base URL:', API_BASE_URL);

class SuperAffiliateAPI {
  /**
   * Get authentication token from localStorage
   */
  static getToken() {
    return localStorage.getItem('tanda_auth_token');
  }

  /**
   * Set authentication token in localStorage
   */
  static setToken(token) {
    localStorage.setItem('tanda_auth_token', token);
  }

  /**
   * Get refresh token from localStorage
   */
  static getRefreshToken() {
    return localStorage.getItem('tanda_refresh_token');
  }

  /**
   * Get API base URL
   */
  static getApiBase() {
    return API_BASE_URL;
  }

  /**
   * Set refresh token in localStorage
   */
  static setRefreshToken(token) {
    localStorage.setItem('tanda_refresh_token', token);
  }

  /**
   * Remove authentication tokens
   */
  static clearTokens() {
    localStorage.removeItem('tanda_auth_token');
    localStorage.removeItem('tanda_refresh_token');
  }

  /**
   * Store tokens from either endpoint shape:
   * - JWT TokenObtainPairView: { access, refresh }
   * - /users/register/: { tokens: { access, refresh } }
   */
  static setTokensFromResponse(response) {
    const access = response?.access || response?.tokens?.access;
    const refresh = response?.refresh || response?.tokens?.refresh;

    if (access) this.setToken(access);
    if (refresh) this.setRefreshToken(refresh);
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Mirrors Flutter `isTandaAppAdmin` (see tanda_app/lib/utils/tanda_role_utils.dart).
   * Use for nav visibility and client-side route hints; backend must still enforce 403.
   */
  static isTandaWebAdmin(user) {
    if (!user || typeof user !== 'object') return false;
    if (user.is_staff === true || user.is_superuser === true) return true;
    const role = user.role != null ? String(user.role).trim() : '';
    return role === 'admin';
  }

  /**
   * Prefix to reach site root from nested paths (e.g. /shops/, /admin-tools/).
   */
  static getPathToSiteRoot() {
    const path = window.location.pathname || '';
    if (path.indexOf('/shops/') !== -1) return '../';
    if (path.indexOf('/admin-tools/') !== -1) return '../';
    return '';
  }

  /**
   * Logged-in web "home": video feed / primary app surface (not the marketing landing page).
   */
  static getWebAppHomeHref() {
    return `${this.getPathToSiteRoot()}feed.html`;
  }

  /** Public marketing landing (`index.html`). Logout and campaigns typically land here. */
  static getMarketingSiteHref() {
    return `${this.getPathToSiteRoot()}index.html`;
  }

  /**
   * Absolute URL to `payment-callback.html` next to the current page (works for static hosting and subfolders).
   */
  static getPaymentCallbackUrl() {
    try {
      return new URL('payment-callback.html', window.location.href).href;
    } catch (_) {
      return `${window.location.origin}/payment-callback.html`;
    }
  }

  /**
   * Host origin for Django routes outside `/api/*` (instant watch HTML at `/w/`, `/i/`, etc.).
   * `API_BASE_URL` is typically `https://host/api`.
   */
  static getBackendOrigin() {
    const base = String(API_BASE_URL || '').replace(/\/$/, '');
    return base.replace(/\/api$/, '') || '';
  }

  /** Server-rendered instant watch / checkout page (video: `/w/`, still image: `/i/`). */
  static getInstantWatchPageUrl(slug, mediaType) {
    const s = String(slug || '').trim();
    if (!s) return '';
    const m = String(mediaType || '').toLowerCase();
    const path = m === 'image' ? `/i/${encodeURIComponent(s)}/` : `/w/${encodeURIComponent(s)}/`;
    const o = this.getBackendOrigin();
    return o ? `${o}${path}` : path;
  }

  /**
   * Append a short-lived auth handoff to an instant watch URL (fragment only – not sent to server).
   * The watch page consumes `_tt`, stores `tanda_auth_token`, and strips the hash.
   * Use when opening `/w/` or `/i/` from Tanda web so checkout can load email + saved address.
   */
  static appendInstantAuthTransferHash(url) {
    const u = String(url || '').trim();
    if (!u) return u;
    try {
      const t = this.getToken();
      if (!t) return u;
      const iHash = u.indexOf('#');
      const base = iHash >= 0 ? u.slice(0, iHash) : u;
      const existing = iHash >= 0 ? u.slice(iHash + 1) : '';
      const params = new URLSearchParams(existing);
      params.set('_tt', t);
      return `${base}#${params.toString()}`;
    } catch (_) {
      return u;
    }
  }

  /** Public instant discover feed (JSON). Same path as Flutter `ApiService` under `/api`. */
  static fetchInstantPublicFeed(limit) {
    const lim = Math.max(1, Math.min(50, Number(limit) || 30));
    return this.apiRequest(`/instant/feed/?limit=${lim}`, { method: 'GET' });
  }

  /** Hotspots + media metadata for an instant link (parity with `InstantWatchBundleView`). */
  static fetchInstantWatchBundle(slug) {
    const s = encodeURIComponent(String(slug || '').trim());
    return this.apiRequest(`/instant/watch/${s}/bundle/`, { method: 'GET' });
  }

  static searchLocalMarkets(query, state) {
    const p = new URLSearchParams();
    const q = query != null ? String(query).trim() : '';
    if (q) p.set('q', q);
    const st = state != null ? String(state).trim() : '';
    if (st) p.set('state', st);
    return this.apiRequest(`/commerce/local-market/markets/search/?${p}`, { method: 'GET' });
  }

  static getNearbyLocalMarkets(lat, lng, radiusKm) {
    const p = new URLSearchParams();
    p.set('lat', String(lat));
    p.set('lng', String(lng));
    if (radiusKm != null && radiusKm !== '') p.set('radius_km', String(radiusKm));
    return this.apiRequest(`/commerce/local-market/markets/nearby/?${p}`, { method: 'GET' });
  }

  static getLocalMarketProducts(opts) {
    const o = opts || {};
    const p = new URLSearchParams();
    if (o.marketSlug) p.set('market_slug', String(o.marketSlug).trim());
    if (o.marketName) p.set('market_name', String(o.marketName).trim());
    if (o.search) p.set('search', String(o.search).trim());
    if (o.category) p.set('category', String(o.category).trim());
    if (o.lat != null) p.set('lat', String(o.lat));
    if (o.lng != null) p.set('lng', String(o.lng));
    if (o.radiusKm != null) p.set('radius_km', String(o.radiusKm));
    if (o.wholesaleOnly) p.set('wholesale_only', '1');
    return this.apiRequest(`/commerce/local-market/products/?${p}`, { method: 'GET' });
  }

  static compareLocalMarketPrices(opts) {
    const o = opts || {};
    const p = new URLSearchParams();
    if (o.leftMarketSlug) p.set('left_market_slug', String(o.leftMarketSlug).trim());
    if (o.rightMarketSlug) p.set('right_market_slug', String(o.rightMarketSlug).trim());
    if (o.leftMarket) p.set('left_market', String(o.leftMarket).trim());
    if (o.rightMarket) p.set('right_market', String(o.rightMarket).trim());
    if (o.search) p.set('search', String(o.search).trim());
    if (o.category) p.set('category', String(o.category).trim());
    if (o.unit) p.set('unit', String(o.unit).trim());
    if (o.wholesaleOnly) p.set('wholesale_only', '1');
    return this.apiRequest(`/commerce/local-market/compare-prices/?${p}`, { method: 'GET' });
  }

  static shoppingAssistantChat(messages, limit, context) {
    const msgs = Array.isArray(messages) ? messages : [];
    const payload = {
      messages: msgs
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
        .map((m) => ({ role: m.role, content: String(m.content).trim() })),
      limit: limit != null ? limit : 12,
    };
    const ctx = context && typeof context === 'object' ? context : {};
    const ids = ctx.productIds != null ? ctx.productIds : ctx.product_ids;
    if (Array.isArray(ids) && ids.length) {
      payload.context = {
        product_ids: ids.filter(Boolean).map((id) => String(id)).slice(0, 8),
      };
    }
    return this.apiRequest('/commerce/assistant/chat/', {
      method: 'POST',
      body: payload,
    });
  }

  static shoppingAssistantSearch(query, limit) {
    return this.apiRequest('/commerce/assistant/search/', {
      method: 'POST',
      body: {
        query: String(query || '').trim(),
        limit: limit != null ? limit : 12,
      },
    });
  }

  static fetchCommerceDiscoveryPage(page, perPage) {
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const pp = Math.max(1, Math.min(100, parseInt(perPage, 10) || 24));
    return this.apiRequest(`/commerce/commerce-discovery/?page=${pg}&per_page=${pp}`, { method: 'GET' });
  }

  /** §T3 village / batch buying – paths align with mobile `ApiService` / `commerce` routes. */
  static getVillageAgentMe() {
    return this.apiRequest('/commerce/village/agent/me/');
  }

  static getVillageBatchesMine() {
    return this.apiRequest('/commerce/village/batches/mine/');
  }

  static getVillageBatchDetail(batchId) {
    const id = encodeURIComponent(String(batchId).trim());
    return this.apiRequest(`/commerce/village/batches/${id}/`);
  }

  static joinVillageBatch(batchId, quantity = 1) {
    const id = encodeURIComponent(String(batchId).trim());
    const q = parseInt(quantity, 10);
    return this.apiRequest(`/commerce/village/batches/${id}/join/`, {
      method: 'POST',
      body: JSON.stringify({ quantity: Number.isFinite(q) && q >= 1 ? q : 1 }),
    });
  }

  static setVillageBatchMyQuantity(batchId, quantity) {
    const id = encodeURIComponent(String(batchId).trim());
    const q = parseInt(quantity, 10);
    return this.apiRequest(`/commerce/village/batches/${id}/my-quantity/`, {
      method: 'POST',
      body: JSON.stringify({ quantity: Number.isFinite(q) ? q : 0 }),
    });
  }

  /** Approved village agent only – POST `/commerce/village/batches/`. */
  static createVillageBatch(payload) {
    const body = payload && typeof payload === 'object' ? payload : {};
    return this.apiRequest('/commerce/village/batches/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** §A0 Delivery / field operator – paths align with `DeliveryLogisticsService` (Flutter). */
  static getCommerceOperatorMe() {
    return this.apiRequest('/commerce/operator/me/');
  }

  static getCommerceDeliveryPartnerMe() {
    return this.apiRequest('/commerce/delivery/partner/me/');
  }

  /** Multipart partner profile / KYC – same path as mobile `postMultipart`. Default 10m timeout for large photos on mobile networks. */
  static updateCommerceDeliveryPartnerProfile(formData, options = {}) {
    const timeoutMs = options.timeoutMs != null ? options.timeoutMs : 600000;
    return this.multipartRequest('/commerce/delivery/partner/me/', formData, { method: 'POST', timeoutMs });
  }

  static getCommerceDeliveryJobsMine() {
    return this.apiRequest('/commerce/delivery/jobs/mine/');
  }

  static getCommerceDeliveryJobsOpen() {
    return this.apiRequest('/commerce/delivery/jobs/open/');
  }

  static postCommerceDeliveryJobAccept(jobId) {
    const id = encodeURIComponent(String(jobId).trim());
    return this.apiRequest(`/commerce/delivery/jobs/${id}/accept/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  static postCommerceDeliveryJobPickup(jobId, otp, opts) {
    const id = encodeURIComponent(String(jobId).trim());
    const code = (otp != null ? String(otp) : '').trim();
    const payload = { otp: code };
    if (opts && opts.latitude != null && opts.longitude != null) {
      payload.latitude = opts.latitude;
      payload.longitude = opts.longitude;
    }
    return this.apiRequest(`/commerce/delivery/jobs/${id}/pickup/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static postCommerceDeliveryJobDeliver(jobId, otp, opts) {
    const id = encodeURIComponent(String(jobId).trim());
    const code = (otp != null ? String(otp) : '').trim();
    const payload = { otp: code };
    if (opts && opts.latitude != null && opts.longitude != null) {
      payload.latitude = opts.latitude;
      payload.longitude = opts.longitude;
    }
    return this.apiRequest(`/commerce/delivery/jobs/${id}/deliver/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Hub scan proof (+ optional GPS). Matches mobile `hubScan` / `delivery_job_hub_scan`. */
  static postCommerceDeliveryJobHubScan(jobId, note, opts) {
    const id = encodeURIComponent(String(jobId).trim());
    const payload = {
      note: (note != null && String(note).trim()) ? String(note).trim().slice(0, 500) : 'Hub scan',
    };
    if (opts && opts.latitude != null && opts.longitude != null) {
      payload.latitude = opts.latitude;
      payload.longitude = opts.longitude;
    }
    return this.apiRequest(`/commerce/delivery/jobs/${id}/hub-scan/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** §A2 Org logistics (pilot) – paths align with `DeliveryLogisticsService` (Flutter). */
  static getCommerceDeliveryOrgsMine() {
    return this.apiRequest('/commerce/delivery/orgs/mine/');
  }

  /** Seller-facing approved org list; optional `order_id` filters by dropoff coverage (Flutter parity). */
  static getCommerceDeliverySellerOrgs(params = {}) {
    const oid = params && params.order_id != null ? String(params.order_id).trim() : '';
    const q = oid ? `?order_id=${encodeURIComponent(oid)}` : '';
    return this.apiRequest(`/commerce/delivery/orgs/${q}`);
  }

  /** GET `/commerce/seller/delivery/jobs/` – seller's delivery jobs (Flutter: `loadSellerJobs`). */
  static getCommerceSellerDeliveryJobs() {
    return this.apiRequest('/commerce/seller/delivery/jobs/');
  }

  /**
   * POST `/commerce/seller/delivery/jobs/` JSON body – creates outbound delivery job (pickup/delivery OTPs).
   * @param {object} body - { order_id, mode, delivery_fee, package_weight_kg, package_description?, collateral_required?, org_id?, notes? }
   */
  static postCommerceSellerDeliveryJobJson(body) {
    return this.apiRequest('/commerce/seller/delivery/jobs/', {
      method: 'POST',
      body: JSON.stringify(body && typeof body === 'object' ? body : {}),
    });
  }

  /**
   * POST `/commerce/seller/delivery/jobs/` multipart – same fields as JSON + optional `package_photo` file.
   * @param {FormData} formData
   */
  static postCommerceSellerDeliveryJobMultipart(formData) {
    return this.multipartRequest('/commerce/seller/delivery/jobs/', formData, {
      method: 'POST',
      timeoutMs: 120000,
    });
  }

  static getCommerceDeliveryOrgJobs() {
    return this.apiRequest('/commerce/delivery/orgs/jobs/');
  }

  static getCommerceDeliveryOrgOpenJobs() {
    return this.apiRequest('/commerce/delivery/orgs/jobs/open/');
  }

  static getCommerceDeliveryOrgDrivers() {
    return this.apiRequest('/commerce/delivery/orgs/drivers/');
  }

  static getCommerceDeliveryOrgResolveDriver(opts = {}) {
    const raw = String(opts && opts.username != null ? opts.username : '')
      .trim()
      .replace(/^@+/, '');
    if (!raw) {
      return Promise.reject(new Error('Username is required'));
    }
    const qs = [`username=${encodeURIComponent(raw)}`];
    const orgId = opts && opts.org_id != null ? String(opts.org_id).trim() : '';
    if (orgId) {
      qs.push(`org_id=${encodeURIComponent(orgId)}`);
    }
    return this.apiRequest(`/commerce/delivery/orgs/drivers/resolve/?${qs.join('&')}`);
  }

  static postCommerceDeliveryOrgDriversLink(body) {
    const payload = body && typeof body === 'object' ? body : {};
    return this.apiRequest('/commerce/delivery/orgs/drivers/link/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static postCommerceDeliveryOrgDriversUnlink(body) {
    const payload = body && typeof body === 'object' ? body : {};
    return this.apiRequest('/commerce/delivery/orgs/drivers/unlink/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static postCommerceDeliveryJobAssignDriver(jobId, partnerId) {
    const id = encodeURIComponent(String(jobId).trim());
    const pid = partnerId != null ? String(partnerId).trim() : '';
    return this.apiRequest(`/commerce/delivery/jobs/${id}/assign-driver/`, {
      method: 'POST',
      body: JSON.stringify({ partner_id: pid }),
    });
  }

  /** Org or rider open bid; org bids must pass `org_id` (see `delivery_job_bid`). */
  static postCommerceDeliveryJobBid(jobId, fields = {}) {
    const id = encodeURIComponent(String(jobId).trim());
    const payload = {};
    if (fields.org_id != null && String(fields.org_id).trim()) {
      payload.org_id = String(fields.org_id).trim();
    }
    if (fields.amount != null && String(fields.amount).trim() !== '') {
      payload.amount = String(fields.amount).trim();
    }
    if (fields.note != null && String(fields.note).trim()) {
      payload.note = String(fields.note).trim().slice(0, 1000);
    }
    return this.apiRequest(`/commerce/delivery/jobs/${id}/bid/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static postCommerceDeliveryJobDispute(jobId, fields = {}) {
    const id = encodeURIComponent(String(jobId).trim());
    const payload = {};
    if (fields.reason != null && String(fields.reason).trim()) {
      payload.reason = String(fields.reason).trim().slice(0, 64);
    }
    if (fields.description != null) {
      payload.description = String(fields.description).trim().slice(0, 5000);
    }
    return this.apiRequest(`/commerce/delivery/jobs/${id}/dispute/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static getCommerceDeliveryJobDisputeThread(jobId) {
    const id = encodeURIComponent(String(jobId).trim());
    return this.apiRequest(`/commerce/delivery/jobs/${id}/dispute-thread/`, { method: 'GET' });
  }

  static postCommerceDeliveryDisputeMessage(jobId, bodyText) {
    const id = encodeURIComponent(String(jobId).trim());
    const body = (bodyText != null ? String(bodyText) : '').trim().slice(0, 5000);
    return this.apiRequest(`/commerce/delivery/jobs/${id}/dispute/messages/`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  /** §B0 In-app support – `chat/support_views` + `support_admin_views`. */
  static getSupportFaqs(limit = 24) {
    const n = parseInt(limit, 10);
    const safe = Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 24;
    return this.apiRequest(`/chat/support/faqs/?limit=${safe}`);
  }

  static getSupportAccess() {
    return this.apiRequest('/chat/support/access/');
  }

  static getSupportInbox(scope = 'mine') {
    const s = encodeURIComponent(String(scope || 'mine').trim());
    return this.apiRequest(`/chat/support/inbox/?scope=${s}`);
  }

  /** §B2 Staff inbox – claim/release ticket (`action`: `assign` | `unassign`). */
  static postSupportAssign(conversationId, action = 'assign') {
    return this.apiRequest('/chat/support/assign/', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId,
        action: action || 'assign',
      }),
    });
  }

  /** §B2 Update ticket `status`, `priority`, optional `resolution_notes` (agents/admins). */
  static postSupportStatus(conversationId, fields = {}) {
    const payload = { conversation_id: conversationId };
    if (fields.status != null && String(fields.status).trim()) {
      payload.status = String(fields.status).trim();
    }
    if (fields.priority != null && String(fields.priority).trim()) {
      payload.priority = String(fields.priority).trim();
    }
    if (fields.resolution_notes !== undefined && fields.resolution_notes !== null) {
      payload.resolution_notes = fields.resolution_notes;
    }
    return this.apiRequest('/chat/support/status/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static startSupportConversation(payload = {}) {
    return this.apiRequest('/chat/support/start/', {
      method: 'POST',
      body: JSON.stringify({
        support_type: payload.support_type || 'general',
        subject: payload.subject || 'Support Request',
        description: payload.description || '',
        priority: payload.priority || 'medium',
      }),
    });
  }

  static getSupportConversation(conversationId) {
    const id = encodeURIComponent(String(conversationId).trim());
    return this.apiRequest(`/chat/support/conversation/${id}/`);
  }

  static getSupportUserConversations() {
    return this.apiRequest('/chat/support/conversations/');
  }

  static sendSupportMessage(conversationId, message, attachmentFile) {
    const cid = String(conversationId).trim();
    const text = message != null ? String(message).trim() : '';
    if (attachmentFile instanceof File) {
      const fd = new FormData();
      fd.append('conversation_id', cid);
      fd.append('message', text);
      fd.append('attachment', attachmentFile, attachmentFile.name);
      return this.multipartRequest('/chat/support/send/', fd, {
        method: 'POST',
        timeoutMs: 120000,
      });
    }
    if (!text) {
      return Promise.reject(new Error('Enter a message or attach a file.'));
    }
    return this.apiRequest('/chat/support/send/', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: cid,
        message: text,
      }),
    });
  }

  static escalateSupportConversation(conversationId, reason) {
    return this.apiRequest('/chat/support/escalate/', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId,
        reason: (reason != null && String(reason).trim()) ? String(reason).trim() : 'User requested human assistance',
      }),
    });
  }

  /** Subscription / overlay quota – same paths as `SubscriptionService` in the app. */
  static getVideoOverlayQuota() {
    return this.apiRequest('/videos/overlay-quota/');
  }

  static getVideoOverlayPlans() {
    return this.apiRequest('/videos/overlay-plans/');
  }

  /**
   * Make authenticated API request
   */
  static async apiRequest(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      ...options.headers,
    };

    // Don't set Content-Type for FormData - browser will set it with boundary
    if (!(options.body instanceof FormData)) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // For FormData, use body directly; otherwise stringify JSON
      const fetchOptions = {
        ...options,
        headers,
        // Always bypass cache for API requests to ensure fresh data
        // This is especially important for profile data and avatars
        cache: 'no-store',
      };
      
      if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
        fetchOptions.body = JSON.stringify(options.body);
      }
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401) {
        // Prevent infinite redirect loops - check if we're already on login page
        const isLoginPage = window.location.pathname.includes('login') || 
                           window.location.pathname.includes('super-affiliate-login');
        
        // Try to refresh token (only if not already on login page)
        if (!isLoginPage) {
          try {
            const refreshed = await this.refreshToken();
            if (refreshed) {
              // Retry the request with new token
              headers['Authorization'] = `Bearer ${this.getToken()}`;
              
              // Prevent infinite retry loops
              const retryOptions = {
                ...options,
                headers,
              };
              
              // Add retry flag to prevent multiple refresh attempts
              if (!retryOptions._retryAttempt) {
                retryOptions._retryAttempt = true;
                
                const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, retryOptions);
                
                if (!retryResponse.ok) {
                  // If retry also fails with 401, token refresh didn't work
                  if (retryResponse.status === 401) {
                    this.clearTokens();
                    if (!isLoginPage) {
                      window.location.href = 'super-affiliate-login.html';
                    }
                    throw new Error('Session expired. Please login again.');
                  }
                  throw new Error('Request failed after token refresh');
                }
                
                return await retryResponse.json();
              }
            }
          } catch (refreshError) {
            // Handle network errors during token refresh
            if (isDevelopment) {
              console.error('Token refresh failed:', refreshError);
            }
            // Report error to tracking service
            if (window.handleApiError) {
              window.handleApiError(refreshError, 'Session expired. Please login again.');
            }
            this.clearTokens();
            if (!isLoginPage) {
              window.location.href = 'super-affiliate-login.html';
            }
            throw new Error('Session expired. Please login again.');
          }
        }
        
        // If we're on login page or refresh failed, clear tokens and throw error
        this.clearTokens();
        if (!isLoginPage) {
          window.location.href = 'super-affiliate-login.html';
        }
        throw new Error('Session expired. Please login again.');
      }

      // Read body ONCE (prevents: "body stream already read")
      const rawText = await response.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch (_) {
        data = null;
      }

      if (!response.ok) {
        // For 400 errors, try to extract detailed validation errors
        if (response.status === 400 && data && data.details) {
          // Format validation errors from serializer
          const errorParts = [];
          if (typeof data.details === 'object') {
            Object.entries(data.details).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                value.forEach(err => {
                  if (typeof err === 'object' && err.bank) {
                    // Handle nested bank errors
                    Object.entries(err.bank).forEach(([bankKey, bankErr]) => {
                      errorParts.push(`bank.${bankKey}: ${Array.isArray(bankErr) ? bankErr.join(', ') : bankErr}`);
                    });
                  } else {
                    errorParts.push(`${key}: ${err}`);
                  }
                });
              } else if (typeof value === 'object') {
                Object.entries(value).forEach(([subKey, subValue]) => {
                  errorParts.push(`${key}.${subKey}: ${Array.isArray(subValue) ? subValue.join(', ') : subValue}`);
                });
              } else {
                errorParts.push(`${key}: ${value}`);
              }
            });
          }
          
          const detailedError = errorParts.length > 0 
            ? errorParts.join('; ')
            : (data.error || data.detail || data.message || rawText);
          
          const error = new Error(detailedError);
          error.details = data.details;
          error.responseData = data;
          throw error;
        }
        
        const errorMessage =
          (data && (data.error || data.detail || data.message || data.non_field_errors?.[0])) ||
          rawText ||
          `Request failed (${response.status}: ${response.statusText})`;
        
        // Don't throw for expected 404 errors (seller/affiliate profiles, invitations)
        // These are normal for users who aren't sellers/affiliates
        if (response.status === 404) {
          const isExpectedError = 
            endpoint.includes('/commerce/seller/profile/') ||
            endpoint.includes('/commerce/affiliate/profile/') ||
            endpoint.includes('/users/super-affiliate-invitations/my_status/') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('Seller profile not found') ||
            errorMessage.includes('Affiliate profile not found') ||
            errorMessage.includes('No Super Affiliate invitation found') ||
            (endpoint.includes('/commerce/orders/') &&
              endpoint.includes('/tracking') &&
              errorMessage.includes('No delivery tracking for digital-only order'));
          
          if (isExpectedError) {
            // Return null for expected 404s instead of throwing
            return null;
          }
        }
        
        const error = new Error(errorMessage);
        if (data) {
          error.responseData = data;
          if (data.details) error.details = data.details;
        }
          throw error;
        }

        // Validate response data structure (basic validation)
        if (data !== null && typeof data !== 'object' && typeof data !== 'string' && typeof data !== 'number' && typeof data !== 'boolean') {
          if (isDevelopment) {
            console.warn('Unexpected response data type:', typeof data, data);
          }
        }

        return data;
    } catch (error) {
      // Only log unexpected errors (not expected 404s)
      const isExpected404 = 
        error.message?.includes('404') &&
        (error.message?.includes('not found') ||
         error.message?.includes('Seller profile not found') ||
         error.message?.includes('Affiliate profile not found') ||
         error.message?.includes('No Super Affiliate invitation found'));
      
      if (!isExpected404) {
        // Log errors in development, report in production
        if (isDevelopment) {
          console.error('API Error:', error);
        } else if (window.handleApiError) {
          window.handleApiError(error);
        }
      }
      
      // Handle network errors specifically
      if (error.name === 'TypeError') {
        if (error.message && (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('network'))) {
          throw new Error('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
        }
        // Other TypeErrors might be network-related too
        if (!error.message || error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
          throw new Error('Network error: Cannot connect to server. Please check your internet connection.');
        }
      }
      
      // Handle timeout errors
      if (error.name === 'AbortError' || (error.message && error.message.includes('timeout'))) {
        throw new Error('Request timed out. Please check your internet connection and try again.');
      }
      
      throw error;
    }
  }

  /**
   * Single in-flight refresh so parallel 401s do not race with ROTATE_REFRESH_TOKENS
   * (a second /token/refresh/ with a just-blacklisted refresh forces logout on web).
   * Mirrors Flutter `ApiService._tokenRefreshFuture`.
   */
  static _refreshInFlight = null;

  /**
   * Refresh authentication token
   */
  static async refreshToken() {
    if (SuperAffiliateAPI._refreshInFlight) {
      return SuperAffiliateAPI._refreshInFlight;
    }
    SuperAffiliateAPI._refreshInFlight = SuperAffiliateAPI._refreshTokenOnce().finally(() => {
      SuperAffiliateAPI._refreshInFlight = null;
    });
    return SuperAffiliateAPI._refreshInFlight;
  }

  static async _refreshTokenOnce() {
    const refreshToken = SuperAffiliateAPI.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Token refresh timeout')), 10000);
      });

      const fetchPromise = fetch(`${API_BASE_URL}/users/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          SuperAffiliateAPI.clearTokens();
        }
        return false;
      }

      const data = await response.json();
      if (data.access) {
        SuperAffiliateAPI.setToken(data.access);
        if (data.refresh) {
          SuperAffiliateAPI.setRefreshToken(data.refresh);
        }
        return true;
      }

      return false;
    } catch (error) {
      if (error.message === 'Token refresh timeout' || error.name === 'TypeError') {
        if (isDevelopment) {
          console.error('Token refresh network error:', error);
        }
      } else {
        SuperAffiliateAPI.clearTokens();
        if (isDevelopment) {
          console.error('Token refresh error:', error);
        }
      }
      return false;
    }
  }

  /**
   * Login user and get JWT token
   * Note: The API expects 'username' field, but accepts email in username field
   * due to CaseInsensitiveUsernameBackend authentication
   */
  static async login(emailOrUsername, password) {
    try {
      // Use direct fetch for login to avoid token refresh logic interfering with error messages
      const response = await fetch(`${API_BASE_URL}/users/token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: emailOrUsername, password }),
        cache: 'no-store',
      });

      // Read response body
      const rawText = await response.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch (_) {
        data = null;
      }

      // Handle 401 Unauthorized - wrong credentials (not expired session)
      if (response.status === 401) {
        const errorMessage = (data && (data.detail || data.error || data.message)) || 
                            'Invalid email/username or password. Please check your credentials and try again.';
        throw new Error(errorMessage);
      }

      // Handle 400 Bad Request - validation errors
      if (response.status === 400) {
        const errorMessage = (data && (data.detail || data.error || data.message || 
                            (data.non_field_errors && data.non_field_errors[0]))) || 
                            'Invalid request. Please check your input and try again.';
        throw new Error(errorMessage);
      }

      // Handle other errors
      if (!response.ok) {
        const errorMessage = (data && (data.detail || data.error || data.message)) || 
                            `Login failed (${response.status}: ${response.statusText})`;
        throw new Error(errorMessage);
      }

      // JWT TokenObtainPairView returns { access: "...", refresh: "..." }
      if (data && data.access) {
        this.setTokensFromResponse(data);
        return data;
      } else {
        throw new Error('Invalid response format from login endpoint');
      }
    } catch (error) {
      // Re-throw with more user-friendly message for credential errors
      if (error.message && (
        error.message.toLowerCase().includes('credentials') || 
        error.message.toLowerCase().includes('invalid') ||
        error.message.toLowerCase().includes('incorrect') ||
        error.message.toLowerCase().includes('authentication') ||
        error.message.toLowerCase().includes('password') ||
        error.message.toLowerCase().includes('username') ||
        error.message.toLowerCase().includes('email')
      )) {
        throw new Error('Invalid email/username or password. Please check your credentials and try again.');
      }
      // Don't change "Session expired" messages - those are for authenticated requests
      if (error.message && error.message.includes('Session expired')) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Register a new user (works for iOS web onboarding).
   * IMPORTANT: backend may create user as inactive pending email verification,
   * but it still returns tokens we can use to continue invite acceptance.
   */
  static async register(payload) {
    const response = await this.apiRequest('/users/register/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    this.setTokensFromResponse(response);
    return response;
  }

  /**
   * Send signup verification code to email BEFORE registration (web app only).
   * Backend endpoint: POST /api/users/send-signup-verification/
   */
  static async sendSignupVerification(email) {
    return await this.apiRequest('/users/send-signup-verification/', {
      method: 'POST',
      body: { email },
    });
  }

  /**
   * Verify signup email code BEFORE registration (web app only).
   * Backend endpoint: POST /api/users/verify-signup-email/
   */
  static async verifySignupEmail(email, code) {
    return await this.apiRequest('/users/verify-signup-email/', {
      method: 'POST',
      body: { email, code },
    });
  }

  /**
   * Logout user
   */
  static logout() {
    this.clearTokens();
    window.location.href = this.getMarketingSiteHref();
  }

  /**
   * Validate invitation token (no auth required)
   */
  static async validateInvitation(token) {
    return await this.apiRequest('/users/super-affiliate-invitations/validate/', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Accept invitation (requires auth)
   */
  static async acceptInvitation(token, agreementAccepted = false) {
    try {
      return await this.apiRequest('/users/super-affiliate-invitations/accept/', {
        method: 'POST',
        body: JSON.stringify({ 
          token,
          agreement_version: '1.0',
          agreement_accepted: !!agreementAccepted
        }),
      });
    } catch (error) {
      // Re-throw with more context
      console.error('Accept invitation error:', error);
      if (error.responseData) {
        console.error('Response data:', error.responseData);
      }
      if (error.details) {
        console.error('Error details:', error.details);
      }
      throw error;
    }
  }

  /**
   * Get current user's Super Affiliate status
   */
  static async getMyStatus() {
    return await this.apiRequest('/users/super-affiliate-invitations/my_status/');
  }

  /**
   * Get user profile
   */
  static async getUserProfile() {
    return await this.apiRequest('/users/profile/');
  }

  /**
   * Get Super Affiliate dashboard stats
   */
  static async getDashboardStats() {
    try {
      // Try to get detailed stats from dashboard endpoint
      try {
        const response = await this.apiRequest('/users/super-affiliate/dashboard/');
        if (response && response.stats) {
          const stats = response.stats;
          return {
            affiliateCode: stats.affiliate_code,
            totalReferrals: (stats.direct_referrals?.total || 0) + (stats.indirect_referrals?.total || 0),
            totalEarned: stats.revenue?.total_commissions || '0.00',
            totalPaid: stats.revenue?.total_paid || '0.00',
            totalPending: stats.revenue?.pending || '0.00',
            status: stats.status,
            expiresAt: stats.expires_at,
            directReferrals: stats.direct_referrals || { total: 0, converted: 0, conversion_rate: 0 },
            indirectReferrals: stats.indirect_referrals || { total: 0, converted: 0, conversion_rate: 0 },
            revenueByType: stats.revenue_by_type || [],
          };
        }
      } catch (e) {
        // Fallback to basic status if dashboard endpoint fails
        console.warn('Dashboard endpoint not available, using basic status:', e);
      }
      
      // Fallback to basic status
      const status = await this.getMyStatus();
      
      // If status is null (user is not a Super Affiliate), return null
      if (!status) {
        return null;
      }
      
      return {
        affiliateCode: status.affiliate_code,
        totalReferrals: status.total_referrals || 0,
        totalEarned: status.total_earned || '0.00',
        totalPaid: status.total_commissions_paid || '0.00',
        totalPending: '0.00',
        status: status.status,
        expiresAt: status.program_expires_at,
        invitationUrl: status.invitation_url,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get commission transactions
   */
  static async getCommissionTransactions(page = 1, pageSize = 20) {
    return await this.apiRequest(`/users/commission-transactions/?page=${page}&page_size=${pageSize}`);
  }

  /**
   * Get affiliate referrals
   */
  static async getAffiliateReferrals(page = 1, pageSize = 20) {
    return await this.apiRequest(`/users/affiliate-referrals/?page=${page}&page_size=${pageSize}`);
  }

  /**
   * Get commission summary
   */
  static async getCommissionSummary() {
    return await this.apiRequest('/users/commission-transactions/summary/');
  }

  /**
   * Get current user info
   */
  static async getCurrentUser() {
    return await this.apiRequest('/users/profile/');
  }

  /**
   * Display name for web chrome (sidebar footer, etc.).
   * Prefers full name, then username, then email local-part.
   */
  static getWebProfileDisplayName(user) {
    if (!user || typeof user !== 'object') return 'Account';
    const fn = user.first_name != null ? String(user.first_name).trim() : '';
    const ln = user.last_name != null ? String(user.last_name).trim() : '';
    const full = [fn, ln].filter(Boolean).join(' ').trim();
    if (full) return full;
    const u = user.username != null ? String(user.username).trim() : '';
    if (u) return u;
    const email = user.email != null ? String(user.email).trim() : '';
    if (email && email.includes('@')) return email.split('@')[0];
    return 'Account';
  }

  /**
   * Search users by username, name, or bio
   * @param {string} query - Search query
   * @returns {Promise<Object>} - Search results with users array
   */
  static async searchUsers(query) {
    if (!query || !query.trim()) {
      return { results: [], count: 0 };
    }
    return await this.apiRequest(`/users/search/?query=${encodeURIComponent(query.trim())}`);
  }

  /**
   * Unified search (same contract as mobile `SearchService`): GET /videos/search/
   * @param {string} query
   * @param {'videos'|'users'} category
   * @param {number} [page=1]
   */
  static async unifiedVideoSearch(query, category, page = 1) {
      const q = String(query || '').trim();
      if (!q) {
        return category === 'users'
          ? { users: [], has_next: false }
          : { videos: [], has_next: false };
      }
      const qp = new URLSearchParams({
        q: q,
        category,
        page: String(page),
      }).toString();
      return await this.apiRequest(`/videos/search/?${qp}`, { method: 'GET' });
  }

  /**
   * Discovery payloads for search home (trending hashtags, popular queries).
   * Same endpoint as mobile `SearchService.loadSearchDiscovery`.
   */
  static async getSearchDiscovery() {
    return await this.apiRequest('/videos/search-discovery/', { method: 'GET' });
  }

  /**
   * Blog API Methods
   */
  
  /**
   * Get all blog posts (public)
   */
  static async getBlogPosts(page = 1) {
    return await this.apiRequest(`/blog/posts/?page=${page}`);
  }

  /**
   * Get blog post by slug or ID
   */
  static async getBlogPost(slugOrId) {
    return await this.apiRequest(`/blog/posts/${slugOrId}/`);
  }

  /**
   * Get all blog posts for admin (including drafts)
   */
  static async getAdminBlogPosts() {
    return await this.apiRequest('/blog/posts/admin_list/');
  }

  /**
   * Get blog categories
   */
  static async getBlogCategories() {
    return await this.apiRequest('/blog/categories/');
  }

  /**
   * Create blog post
   */
  static async createBlogPost(postData) {
    const formData = new FormData();
    
    // Add text fields
    Object.keys(postData).forEach(key => {
      if (key !== 'featured_image' && postData[key] !== null && postData[key] !== undefined) {
        formData.append(key, postData[key]);
      }
    });
    
    // Add image if provided
    if (postData.featured_image && postData.featured_image instanceof File) {
      formData.append('featured_image', postData.featured_image);
    }
    
    return await this.multipartRequest('/blog/posts/', formData, { method: 'POST' });
  }

  /**
   * Update blog post
   */
  static async updateBlogPost(postId, postData) {
    const formData = new FormData();
    
    // Add text fields
    Object.keys(postData).forEach(key => {
      if (key !== 'featured_image' && postData[key] !== null && postData[key] !== undefined) {
        formData.append(key, postData[key]);
      }
    });
    
    // Add image if provided
    if (postData.featured_image && postData.featured_image instanceof File) {
      formData.append('featured_image', postData.featured_image);
    }
    
    return await this.multipartRequest(`/blog/posts/${postId}/`, formData, { method: 'PATCH' });
  }

  /**
   * Delete blog post
   */
  static async deleteBlogPost(postId) {
    return await this.apiRequest(`/blog/posts/${postId}/`, { method: 'DELETE' });
  }

  /**
   * Publish blog post
   */
  static async publishBlogPost(postId) {
    return await this.apiRequest(`/blog/posts/${postId}/publish/`, { method: 'POST' });
  }

  /**
   * Unpublish blog post
   */
  static async unpublishBlogPost(postId) {
    return await this.apiRequest(`/blog/posts/${postId}/unpublish/`, { method: 'POST' });
  }

  /**
   * Copy text to clipboard
   */
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  }

  /**
   * Multipart upload helper (FormData). Keeps Authorization header.
   * @param {object} options - { method, timeoutMs } – optional timeout aborts the request.
   */
  static async multipartRequest(endpoint, formData, options = {}) {
    const timeoutMs = options.timeoutMs;
    const controller = new AbortController();
    let timeoutId;
    if (timeoutMs != null && timeoutMs > 0) {
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    const token = this.getToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: options.method || 'POST',
        headers, // NOTE: do NOT set Content-Type, browser will set boundary
        body: formData,
        signal: controller.signal,
        cache: 'no-store',
      });

      const rawText = await response.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch (_) {
        data = null;
      }

      if (!response.ok) {
        let errorText =
          (data && (data.error || data.detail || data.message)) || rawText || `Upload failed (${response.status})`;
        if (
          data &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          !data.error &&
          !data.detail &&
          !data.message
        ) {
          const parts = [];
          Object.entries(data).forEach(([k, v]) => {
            if (v == null) return;
            parts.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
          });
          if (parts.length) {
            errorText = parts.join('; ');
          }
        }
        const err = new Error(errorText);
        if (data) err.responseData = data;
        throw err;
      }

      return data;
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      throw e;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /** Product Video Studio – curated templates + tiers (Flutter: getProductVideoCatalog). */
  static async getProductVideoCatalog() {
    return await this.apiRequest('/ai/product-video/catalog/', { method: 'GET' });
  }

  static async getProductVideoPreference() {
    return await this.apiRequest('/ai/product-video/preference/', { method: 'GET' });
  }

  static async putProductVideoPreference(payload) {
    return await this.apiRequest('/ai/product-video/preference/', {
      method: 'PUT',
      body: payload,
    });
  }

  static async getProductVideoCreditsBalance() {
    return await this.apiRequest('/ai/product-video/credits/balance/', { method: 'GET' });
  }

  /**
   * Multipart POST /ai/product-video/generate/ – field `image` (file). Optional tier, prompt, template_id, options JSON string.
   * @param {File} file
   * @param {object} fields - { tier, prompt, templateId, options, seller_watermark_* }
   */
  static async generateProductVideoFromFile(file, fields = {}, timeoutMs = 360000) {
    const form = new FormData();
    form.append('image', file);
    if (fields.tier) form.append('tier', fields.tier);
    if (fields.prompt) form.append('prompt', fields.prompt);
    if (fields.templateId) form.append('template_id', fields.templateId);
    if (fields.options && typeof fields.options === 'object') {
      form.append('options', JSON.stringify(fields.options));
    }
    if (fields.seller_watermark_enabled != null && fields.seller_watermark_enabled !== '') {
      form.append('seller_watermark_enabled', String(fields.seller_watermark_enabled));
    }
    if (fields.seller_watermark_text) form.append('seller_watermark_text', fields.seller_watermark_text);
    if (fields.seller_watermark_position) form.append('seller_watermark_position', fields.seller_watermark_position);
    return await this.multipartRequest('/ai/product-video/generate/', form, {
      method: 'POST',
      timeoutMs,
    });
  }

  /** JSON POST with image_url (server fetches). Same optional body fields as mobile ApiService.generateProductPreviewVideoFromImageUrl. */
  static async generateProductVideoFromImageUrl(imageUrl, body = {}, timeoutMs = 360000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.apiRequest('/ai/product-video/generate/', {
        method: 'POST',
        body: { image_url: imageUrl, ...body },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async attachProductPreviewReel({ productId, videoUrl, sourceStoragePath }, timeoutMs = 120000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body = { product_id: productId };
      if (videoUrl) body.video_url = videoUrl;
      if (sourceStoragePath) body.source_storage_path = sourceStoragePath;
      return await this.apiRequest('/ai/product-video/attach/', {
        method: 'POST',
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async clearProductPreviewReel(productId, timeoutMs = 60000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.apiRequest('/ai/product-video/clear-preview/', {
        method: 'POST',
        body: { product_id: productId },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Upload/publish a video (basic web creator flow).
   * Backend endpoint: POST /api/videos/publish/
   * Expects multipart fields:
   * - video: File
   * - caption: string (optional)
   * - privacy_settings: JSON string
   * - advanced_settings: JSON string
   */
  static async publishVideo({ file, caption = '', isPublic = true, timeoutMs = 600000 } = {}) {
    const form = new FormData();
    form.append('video', file);
    form.append('caption', caption);
    form.append('privacy_settings', JSON.stringify({ isPublic }));
    form.append('advanced_settings', JSON.stringify({}));

    return await this.multipartRequest('/videos/publish/', form, { method: 'POST', timeoutMs });
  }

  /**
   * List current user's videos
   * Backend endpoint: GET /api/videos/my-videos/
   */
  static async getMyVideos(page = 1, opts = {}) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const qp = new URLSearchParams({ page: String(page) });
    if (o.excludeImported) qp.set('exclude_imported', 'true');
    if (o.perPage != null) qp.set('per_page', String(o.perPage));
    return await this.apiRequest(`/videos/my-videos/?${qp}`, { method: 'GET' });
  }

  /** Seller: list instant watch links (GET /api/instant/seller/watch-links/). */
  static fetchSellerInstantWatchLinks() {
    return this.apiRequest('/instant/seller/watch-links/', { method: 'GET' });
  }

  /** Seller: create link – multipart (video_id, uploaded_video, image, video_url, etc.). */
  static createSellerInstantWatchLink(formData, options = {}) {
    return this.multipartRequest('/instant/seller/watch-links/', formData, {
      method: 'POST',
      timeoutMs: options.timeoutMs || 180000,
    });
  }

  static updateSellerInstantWatchLink(slug, body) {
    const s = encodeURIComponent(String(slug || '').trim());
    return this.apiRequest(`/instant/seller/watch-links/${s}/`, { method: 'PUT', body: body || {} });
  }

  static deleteSellerInstantWatchLink(slug) {
    const s = encodeURIComponent(String(slug || '').trim());
    return this.apiRequest(`/instant/seller/watch-links/${s}/`, { method: 'DELETE' });
  }

  static fetchSellerInstantHotspot(slug) {
    const s = encodeURIComponent(String(slug || '').trim());
    return this.apiRequest(`/instant/seller/watch-links/${s}/hotspots/`, { method: 'GET' });
  }

  static createSellerInstantHotspot(slug, body) {
    const s = encodeURIComponent(String(slug || '').trim());
    return this.apiRequest(`/instant/seller/watch-links/${s}/hotspots/`, { method: 'POST', body: body || {} });
  }

  static updateSellerInstantHotspot(slug, body) {
    const s = encodeURIComponent(String(slug || '').trim());
    return this.apiRequest(`/instant/seller/watch-links/${s}/hotspots/`, { method: 'PUT', body: body || {} });
  }

  /** Remove one hotspot (pass id) or all (omit id). */
  static deleteSellerInstantHotspots(slug, hotspotId) {
    const s = encodeURIComponent(String(slug || '').trim());
    const body = hotspotId ? { hotspot_id: String(hotspotId) } : {};
    return this.apiRequest(`/instant/seller/watch-links/${s}/hotspots/`, { method: 'DELETE', body });
  }

  /**
   * Get the main video feed (TikTok-like infinite feed).
   * Backend endpoint: GET /api/videos/feed/?page=1&per_page=…
   * Page size defaults to 30 to match the mobile app (`VideoService`).
   */
  static async getFeed({ page = 1, perPage = 30, refresh = false } = {}) {
    const qp = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      refresh: refresh ? '1' : '0',
    }).toString();
    return await this.apiRequest(`/videos/feed/?${qp}`, { method: 'GET' });
  }

  /** Authenticated – same endpoint as mobile trending (`VideoService` / `/videos/trending/`). */
  static async getTrendingVideos({ page = 1, perPage = 30 } = {}) {
    const qp = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    }).toString();
    return await this.apiRequest(`/videos/trending/?${qp}`, { method: 'GET' });
  }

  /**
   * Get product tags for a video
   * Backend endpoint: GET /api/videos/{video_id}/product-tags/
   */
  static async getProductTagsForVideo(videoId) {
    const response = await this.apiRequest(`/videos/${encodeURIComponent(videoId)}/product-tags/`, { method: 'GET' });
    // Backend returns { tags: [...] }
    return response.tags || [];
  }

  /**
   * Create a product tag for a video
   * Backend endpoint: POST /api/videos/{video_id}/product-tags/
   *
   * payload fields (minimum):
   * - video_id: int (will be used in URL)
   * - product_id (uuid string for internal) OR external_product_id (uuid string for external)
   * - timestamp (seconds float)
   * - position (optional, object with x, y)
   */
  static async createProductTag(videoId, payload) {
    // Map frontend field names to backend field names
    const backendPayload = {
      timestamp: payload.timestamp,
      position: payload.position || { x: 0.8, y: 0.1 }
    };
    
    // Map internal_product to product_id, external_product to external_product_id
    if (payload.internal_product) {
      backendPayload.product_id = payload.internal_product;
    } else if (payload.external_product) {
      backendPayload.external_product_id = payload.external_product;
    }
    
    return await this.apiRequest(`/videos/${videoId}/product-tags/`, {
      method: 'POST',
      body: JSON.stringify(backendPayload),
    });
  }

  /**
   * Marketplace Methods
   */
  static async getFeaturedProducts(limit = 15, platform = 'all') {
    const params = new URLSearchParams({
      limit: limit.toString(),
      platform: platform
    });
    return await this.apiRequest(`/videos/external-products/marketplace/featured/?${params}`);
  }

  static async getPopularProducts(page = 1, perPage = 20, platform = 'all', sortBy = 'most_tagged') {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      platform: platform,
      sort_by: sortBy
    });
    return await this.apiRequest(`/videos/external-products/marketplace/popular/?${params}`);
  }

  static async browseMarketplaceProducts(page = 1, perPage = 20, platform = 'all', search = '', sortBy = 'created_at') {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      platform: platform,
      sort_by: sortBy
    });
    if (search) {
      params.append('search', search);
    }
    return await this.apiRequest(`/videos/external-products/marketplace/browse/?${params}`);
  }

  static async getMarketplaceProductDetails(productId) {
    return await this.apiRequest(`/videos/external-products/marketplace/${productId}/`);
  }

  /**
   * Get product details by product ID
   * Backend endpoint: GET /api/commerce/products/{product_id}/
   */
  static async getProductDetails(productId) {
    return await this.apiRequest(`/commerce/products/${encodeURIComponent(productId)}/`);
  }

  /**
   * Seller: PATCH product (partial update). Same endpoint as mobile; supports stock_quantity, status, etc.
   */
  static async updateSellerProduct(productId, data) {
    const id = encodeURIComponent(String(productId).trim());
    return await this.apiRequest(`/commerce/products/${id}/update/`, {
      method: 'PATCH',
      body: data && typeof data === 'object' ? data : {},
    });
  }

  /**
   * Seller: DELETE own product.
   */
  static async deleteSellerProduct(productId) {
    const id = encodeURIComponent(String(productId).trim());
    return await this.apiRequest(`/commerce/products/${id}/delete/`, {
      method: 'DELETE',
    });
  }

  /**
   * Cart Management Methods
   */
  static async getCart() {
    // Add cache-busting parameter to ensure fresh data
    const cacheBuster = new Date().getTime();
    return await this.apiRequest(`/commerce/cart/?_t=${cacheBuster}`);
  }

  static async addToCart(productId, quantity = 1, options = {}) {
    return await this.apiRequest('/commerce/cart/add/', {
      method: 'POST',
      body: JSON.stringify({
        product: productId,
        quantity: quantity,
        ...(options || {}),
      }),
    });
  }

  static async updateCartItem(itemId, quantity, options = {}) {
    return await this.apiRequest(`/commerce/cart/items/${itemId}/update/`, {
      method: 'PUT',
      body: JSON.stringify({ quantity, ...(options || {}) }),
    });
  }

  static async removeCartItem(itemId) {
    return await this.apiRequest(`/commerce/cart/items/${itemId}/remove/`, {
      method: 'DELETE',
    });
  }

  static async clearCart() {
    return await this.apiRequest('/commerce/cart/clear/', {
      method: 'DELETE',
    });
  }

  static async getCartCount() {
    try {
      if (!this.isAuthenticated()) return 0;
      // Use direct API call without cache-busting for frequent calls
      const cart = await this.apiRequest('/commerce/cart/');
      return (cart.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Wishlist Management Methods
   */
  static async getWishlist() {
    return await this.apiRequest('/commerce/wishlist/');
  }

  static async addToWishlist(productId) {
    return await this.apiRequest('/commerce/wishlist/add/', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId }),
    });
  }

  static async removeFromWishlist(itemId) {
    return await this.apiRequest(`/commerce/wishlist/items/${itemId}/remove/`, {
      method: 'DELETE',
    });
  }

  static async isProductInWishlist(productId) {
    try {
      if (!this.isAuthenticated()) return false;
      const wishlist = await this.getWishlist();
      return (wishlist.items || []).some(item => item.product?.id === productId || item.product === productId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Update cart badge across all pages
   */
  static async updateCartBadge() {
    try {
      const count = await this.getCartCount();
      // Try multiple selectors to find the badge
      const badges = document.querySelectorAll('#cart-badge, [id="cart-badge"], .cart-badge');
      
      if (badges.length === 0) {
        // Badge might not exist yet, try to find it after a short delay
        safeLog('Cart badge not found, will retry...');
        setTimeout(() => {
          const retryBadges = document.querySelectorAll('#cart-badge, [id="cart-badge"], .cart-badge');
          retryBadges.forEach(badge => {
            badge.textContent = count;
            badge.setAttribute('data-count', count);
            // Force update display style
            if (count > 0) {
              badge.style.setProperty('display', 'flex', 'important');
            } else {
              badge.style.setProperty('display', 'none', 'important');
            }
          });
        }, 100);
        return count;
      }
      
      badges.forEach(badge => {
        badge.textContent = count;
        badge.setAttribute('data-count', count);
        
        // Force update display style using setProperty with important flag
        if (count > 0) {
          badge.style.setProperty('display', 'flex', 'important');
        } else {
          badge.style.setProperty('display', 'none', 'important');
        }
      });
      
      safeLog(`Cart badge updated: ${count} items`);
      return count;
    } catch (error) {
      console.warn('Error updating cart badge:', error);
      return 0;
    }
  }

  /**
   * Show variation selection modal for products with required options
   * Returns a Promise that resolves with selected variations or null if cancelled
   */
  static async showVariationModal(productId, productData = null) {
    return new Promise(async (resolve) => {
      // Fetch product data if not provided
      let product = productData;
      if (!product) {
        try {
          product = await this.getProductDetails(productId);
        } catch (error) {
          console.error('Error fetching product for variation modal:', error);
          resolve(null);
          return;
        }
      }

      const variationOptions = product?.variation_options || {};
      if (!variationOptions || Object.keys(variationOptions).length === 0) {
        // No variations required
        resolve({});
        return;
      }

      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      `;

      // Create modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: #2a2a2a;
        border-radius: 1rem;
        padding: 2rem;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;

      const selectedVariations = {};
      
      // Build modal content
      let modalHTML = `
        <h2 style="margin: 0 0 1.5rem 0; color: var(--text-primary, #fff); font-size: 1.5rem;">
          <i class="fas fa-cog"></i> Select Options
        </h2>
        <p style="color: var(--text-secondary, #aaa); margin-bottom: 1.5rem; font-size: 0.9rem;">
          Please select the following options for <strong>${product?.name || 'this product'}</strong>:
        </p>
      `;

      // Create selectors for each variation
      Object.entries(variationOptions).forEach(([key, values]) => {
        if (!Array.isArray(values) || values.length === 0) return;

        const label = key.charAt(0).toUpperCase() + key.slice(1);
        modalHTML += `
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: var(--text-primary, #fff); font-weight: 600;">
              ${label} <span style="color: #ff6b6b;">*</span>
            </label>
            <select 
              id="modal-variation-${key}" 
              data-variation-key="${key}"
              style="
                width: 100%;
                padding: 0.75rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 0.5rem;
                color: var(--text-primary, #fff);
                font-size: 1rem;
                cursor: pointer;
              "
              required
            >
              <option value="">Choose ${key}...</option>
              ${values.map(v => `<option value="${String(v)}">${String(v)}</option>`).join('')}
            </select>
          </div>
        `;
      });

      modalHTML += `
        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
          <button 
            id="modal-cancel-btn"
            style="
              flex: 1;
              padding: 0.75rem;
              background: rgba(255, 255, 255, 0.1);
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 0.5rem;
              color: var(--text-primary, #fff);
              font-size: 1rem;
              cursor: pointer;
              font-weight: 600;
            "
          >
            Cancel
          </button>
          <button 
            id="modal-confirm-btn"
            style="
              flex: 1;
              padding: 0.75rem;
              background: linear-gradient(135deg, #ff0050, #00f2ea);
              border: none;
              border-radius: 0.5rem;
              color: white;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 600;
            "
          >
            Continue
          </button>
        </div>
      `;

      modal.innerHTML = modalHTML;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Add event listeners
      const selects = modal.querySelectorAll('select[data-variation-key]');
      selects.forEach(select => {
        select.addEventListener('change', (e) => {
          const key = e.target.getAttribute('data-variation-key');
          const value = e.target.value;
          if (value) {
            selectedVariations[key] = value;
          } else {
            delete selectedVariations[key];
          }
        });
      });

      const cancelBtn = document.getElementById('modal-cancel-btn');
      const confirmBtn = document.getElementById('modal-confirm-btn');

      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });

      confirmBtn.addEventListener('click', () => {
        // Validate all selections
        const requiredKeys = Object.keys(variationOptions);
        const missing = requiredKeys.filter(key => !selectedVariations[key] || !selectedVariations[key].trim());
        
        if (missing.length > 0) {
          const missingLabels = missing.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(', ');
          alert(`Please select: ${missingLabels}`);
          return;
        }

        document.body.removeChild(overlay);
        resolve(selectedVariations);
      });

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });

      // Close on Escape key
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          document.body.removeChild(overlay);
          document.removeEventListener('keydown', escapeHandler);
          resolve(null);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    });
  }
}

// Make it globally available
window.SuperAffiliateAPI = SuperAffiliateAPI;

// Auto-register service worker on page load (if not already registered)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        safeLog('✅ Service Worker registered for PWA');
        // Force update check
        registration.update();
      })
      .catch((error) => {
        // Log service worker errors (important for debugging)
        if (isDevelopment) {
          console.warn('⚠️ Service Worker registration failed:', error);
        }
        // In production, send to error tracking
        // if (window.Sentry) { window.Sentry.captureException(error); }
      });
  });
}

/**
 * Highlight sidebar, dropdown, and top bar links for the current HTML page.
 * Safe to call after async menu inserts (seller/affiliate/admin links).
 */
SuperAffiliateAPI.applyActiveNavState = function() {
  try {
    const path = window.location.pathname || '';
    let file = (path.split('/').pop() || '').split('?')[0].trim().toLowerCase();
    if (!file) file = 'index.html';

    const normalizeHrefToFile = (href) => {
      if (!href || href === '#' || String(href).startsWith('javascript:')) return '';
      try {
        const u = new URL(href, window.location.href);
        let seg = (u.pathname.split('/').pop() || '').split('?')[0].trim().toLowerCase();
        if (!seg) seg = 'index.html';
        return seg;
      } catch (_) {
        return '';
      }
    };

    const apply = (a, active) => {
      a.classList.toggle('tanda-nav-link-active', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    };

    document.querySelectorAll('.tanda-desktop-sidebar-nav a.user-menu-item, #userMenu a.user-menu-item').forEach((a) => {
      const target = normalizeHrefToFile(a.getAttribute('href'));
      apply(a, Boolean(target && target === file));
    });

    document.querySelectorAll('.nav-link-btn').forEach((a) => {
      const target = normalizeHrefToFile(a.getAttribute('href'));
      apply(a, Boolean(target && target === file));
    });

    const profileFooter = document.querySelector('.tanda-desktop-sidebar-user');
    if (profileFooter) {
      const pf = normalizeHrefToFile(profileFooter.getAttribute('href'));
      const active = Boolean(pf && pf === file);
      profileFooter.classList.toggle('tanda-sidebar-profile-active', active);
      if (active) profileFooter.setAttribute('aria-current', 'page');
      else profileFooter.removeAttribute('aria-current');
    }
  } catch (_) { /* ignore */ }
};

/**
 * Render a standard auth header area.
 * - If logged out: Login / Sign up
 * - If logged in: strip actions + account menu (desktop also mounts the left sidebar).
 *
 * Optional on `#authNav`: `data-nav-mode` – `instant_shop` | `immersive_shop` | `local_market` | `village_hub`
 * (underscores; hyphens normalized). Shapes the top strip for mobile commerce chrome.
 *
 * Usage: <div id="authNav" data-nav-mode="instant_shop"></div> then SuperAffiliateAPI.renderAuthNav('authNav')
 */
function buildTandaAccountMenuItemsHTML(siteRoot, opts) {
  const o = opts || {};
  const prependMarketing = o.prependMarketingSiteItem
    ? `
          <a href="${siteRoot}index.html" class="user-menu-item">
            <i class="fas fa-globe"></i>
            <span>Tanda website</span>
          </a>`
    : '';
  const profileRow = o.omitProfileNavItem
    ? ''
    : `
          <a href="${siteRoot}profile.html" class="user-menu-item">
            <i class="fas fa-user"></i>
            <span>Profile & Settings</span>
          </a>`;
  return `${prependMarketing}
          <a href="${siteRoot}search.html" class="user-menu-item">
            <i class="fas fa-search"></i>
            <span>Search</span>
          </a>
          <a href="${siteRoot}products.html" class="user-menu-item">
            <i class="fas fa-shopping-bag"></i>
            <span>Shop</span>
          </a>
          <a href="${siteRoot}local-market.html" class="user-menu-item">
            <i class="fas fa-store"></i>
            <span>Local Market by Tanda</span>
          </a>
          <a href="${siteRoot}instant-shop.html" class="user-menu-item">
            <i class="fas fa-bolt"></i>
            <span>Instant checkout</span>
          </a>
          <a href="${siteRoot}product-experience.html" class="user-menu-item">
            <i class="fas fa-layer-group"></i>
            <span>Immersive shop</span>
          </a>${profileRow}
          <a href="${siteRoot}subscription.html" class="user-menu-item">
            <i class="fas fa-crown"></i>
            <span>Subscription</span>
          </a>
          <a href="${siteRoot}wallet.html" class="user-menu-item">
            <i class="fas fa-wallet"></i>
            <span>Wallet & Transactions</span>
          </a>
          <a href="${siteRoot}village-hub.html" class="user-menu-item">
            <i class="fas fa-people-group"></i>
            <span>Village batch buying</span>
          </a>
          <a href="${siteRoot}analytics.html" class="user-menu-item">
            <i class="fas fa-chart-line"></i>
            <span>Analytics</span>
          </a>
          <a href="${siteRoot}wishlist.html" class="user-menu-item">
            <i class="fas fa-heart"></i>
            <span>My Wishlist</span>
          </a>
          <a href="${siteRoot}orders.html" class="user-menu-item">
            <i class="fas fa-shopping-bag"></i>
            <span>My Orders</span>
          </a>
          <a href="${siteRoot}my-videos.html" class="user-menu-item">
            <i class="fas fa-film"></i>
            <span>My Videos</span>
          </a>
          <a href="${siteRoot}help-support.html" class="user-menu-item">
            <i class="fas fa-life-ring"></i>
            <span>Help &amp; support</span>
          </a>
          <a href="${siteRoot}driver-dashboard.html" class="user-menu-item">
            <i class="fas fa-motorcycle"></i>
            <span>Delivery console</span>
          </a>
          <a href="${siteRoot}support-inbox.html" class="user-menu-item">
            <i class="fas fa-inbox"></i>
            <span>Support inbox (staff)</span>
          </a>
          <div class="user-menu-divider" style="margin: 0.5rem 0; border-top: 1px solid rgba(255,255,255,0.1);"></div>
          <span class="sellerAffiliateMenuPlaceholder"></span>
          <span class="dashboardMenuPlaceholder"></span>
          <div class="user-menu-divider"></div>
          <a href="#" class="user-menu-item user-menu-item-danger tanda-logout-trigger">
            <i class="fas fa-sign-out-alt"></i>
            <span>Logout</span>
          </a>`;
}

SuperAffiliateAPI.renderAuthNav = function(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.classList.remove('tanda-nav-mode-instant_shop', 'tanda-nav-mode-immersive_shop');
  const navModeRaw = (el.getAttribute('data-nav-mode') || '').trim().toLowerCase().replace(/-/g, '_');
  const isInstantShopMode = navModeRaw === 'instant_shop';
  const isImmersiveShopMode = navModeRaw === 'immersive_shop';
  const isLocalMarketMode = navModeRaw === 'local_market';
  const isVillageHubMode = navModeRaw === 'village_hub';

  const existingSidebar = document.getElementById('tandaDesktopSidebar');
  if (existingSidebar) {
    existingSidebar.remove();
  }
  const existingRightRail = document.getElementById('tandaDesktopRightRail');
  if (existingRightRail) {
    existingRightRail.remove();
  }
  document.body.classList.remove('tanda-desktop-sidebar-on');

  const isAuthed = SuperAffiliateAPI.isAuthenticated();
  // Check if we're on the home page - hide "Home" link when already on index.html
  const currentPath = window.location.pathname;
  const currentFile = window.location.pathname.split('/').pop() || '';
  const isHomePage = currentPath === '/' || 
                     currentPath.endsWith('/') || 
                     currentPath.endsWith('index.html') || 
                     currentFile === 'index.html' || 
                     currentFile === '';
  // Check if we're on upload page - don't add "Home" link as it's already there statically
  const isUploadPage = currentPath.endsWith('upload.html') || currentFile === 'upload.html';
  // Check if we're on my-videos page - don't add "Home" link as it's already there statically
  const isMyVideosPage = currentPath.endsWith('my-videos.html') || currentFile === 'my-videos.html';
  const isFeedPage = currentPath.endsWith('feed.html') || currentFile === 'feed.html';

  if (!isAuthed) {
    const homeLink = (isHomePage || isUploadPage || isMyVideosPage) ? '' : `
        <a href="index.html" class="nav-link-btn" aria-label="Home">
          <i class="fas fa-home"></i> Home
        </a>`;
    const feedLink = isFeedPage ? '' : `
        <a href="feed.html" class="nav-link-btn" aria-label="Feed">
          <i class="fas fa-play"></i> Feed
        </a>`;
    el.innerHTML = `
      <div class="auth-nav-buttons">
        ${homeLink}
        ${feedLink}
        <a href="super-affiliate-login.html" class="nav-link-btn" aria-label="Login">
          Login
      </a>
        <a href="signup.html" class="nav-link-btn nav-link-btn-primary" aria-label="Sign up">
          Sign Up
      </a>
      </div>
    `;
    return;
  }

  if (isInstantShopMode) el.classList.add('tanda-nav-mode-instant_shop');
  if (isImmersiveShopMode) el.classList.add('tanda-nav-mode-immersive_shop');

  document.body.classList.add('tanda-desktop-sidebar-on');

  const siteRoot = SuperAffiliateAPI.getPathToSiteRoot();

  const accountMenuItemsHTML = buildTandaAccountMenuItemsHTML(siteRoot, {
    prependMarketingSiteItem: isFeedPage,
  });
  const accountMenuItemsSidebarHTML = buildTandaAccountMenuItemsHTML(siteRoot, {
    omitProfileNavItem: true,
  });

  const hideInstantMobile = isInstantShopMode ? ' tanda-nav-strip-hide-instant-mobile' : '';
  const hideImmersive = isImmersiveShopMode ? ' tanda-nav-strip-hide-immersive' : '';

  // App "Home" → feed (single entry); marketing site is in the account menu where relevant.
  const homeLink = (isFeedPage || isUploadPage || isMyVideosPage) ? '' : `
      <a href="${siteRoot}feed.html" class="nav-link-btn${hideInstantMobile}${hideImmersive}" aria-label="Home">
        <i class="fas fa-home"></i> Home
      </a>`;
  const feedLink = '';
  const uploadSlotHtml = (isLocalMarketMode || isVillageHubMode)
    ? `<a href="${siteRoot}products.html" class="nav-link-btn" aria-label="Shop">
        <i class="fas fa-shopping-bag"></i> Shop
      </a>`
    : `<a href="${siteRoot}upload.html" class="nav-link-btn${hideInstantMobile}${hideImmersive}" aria-label="Upload">
        <i class="fas fa-cloud-upload-alt"></i> Upload
      </a>`;
  let stripShopHtml = '';
  if (isImmersiveShopMode) {
    stripShopHtml = `<a href="${siteRoot}products.html" class="nav-link-btn tanda-nav-strip-shop tanda-nav-immersive-strip-shop" aria-label="Shop">
        <i class="fas fa-shopping-bag"></i> Shop
      </a>`;
  } else if (isInstantShopMode) {
    stripShopHtml = `<a href="${siteRoot}products.html" class="nav-link-btn tanda-nav-strip-shop tanda-nav-instant-shop-mobile-only" aria-label="Shop">
        <i class="fas fa-shopping-bag"></i> Shop
      </a>`;
  }
  const cartLink = `<a href="${siteRoot}cart.html" class="nav-link-btn${hideInstantMobile}" aria-label="Shopping Cart" style="position: relative; overflow: visible;" onclick="if(!SuperAffiliateAPI.isAuthenticated()) { event.preventDefault(); window.location.href='super-affiliate-login.html?redirect=' + encodeURIComponent('cart.html'); }">
        <i class="fas fa-shopping-cart"></i> Cart
        <span id="cart-badge" style="display: none; position: absolute; top: 0; right: -4px; background: #ff0050; color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; font-weight: 700; z-index: 10; overflow: visible;">0</span>
      </a>`;
  const userMenuHTML = `
    <div class="user-menu-wrapper">
      ${homeLink}
      ${feedLink}
      ${uploadSlotHtml}
      ${stripShopHtml}
      ${cartLink}
      <div class="user-menu-dropdown">
        <button type="button" class="user-menu-toggle" id="userMenuToggle" aria-label="Open account menu" aria-expanded="false">
          <i class="fas fa-user-circle"></i>
          <i class="fas fa-chevron-down"></i>
        </button>
        <div class="user-menu" id="userMenu">
          ${accountMenuItemsHTML}
        </div>
      </div>
    </div>
  `;
  
  el.innerHTML = userMenuHTML;

  const sidebar = document.createElement('aside');
  sidebar.id = 'tandaDesktopSidebar';
  sidebar.className = 'tanda-desktop-sidebar';
  sidebar.setAttribute('aria-label', 'Account navigation');
  sidebar.innerHTML = `
    <div class="tanda-desktop-sidebar-brand">
      <a href="${siteRoot}feed.html" class="tanda-desktop-sidebar-logo">
        <i class="fas fa-play-circle" aria-hidden="true"></i>
        <span>Tanda</span>
      </a>
    </div>
    <nav class="tanda-desktop-sidebar-nav" id="userMenuSidebar" aria-label="Your account">
      ${accountMenuItemsSidebarHTML}
    </nav>
    <a href="${siteRoot}profile.html" class="tanda-desktop-sidebar-user" aria-label="Profile and settings">
      <span class="tanda-desktop-sidebar-user-avatar" aria-hidden="true">
        <img alt="" class="tanda-desktop-sidebar-user-img" id="tandaDesktopSidebarUserImg" width="44" height="44" decoding="async" />
        <span class="tanda-desktop-sidebar-user-fallback" id="tandaDesktopSidebarUserFallback"><i class="fas fa-user"></i></span>
      </span>
      <span class="tanda-desktop-sidebar-user-meta">
        <span class="tanda-desktop-sidebar-user-name" id="tandaDesktopSidebarUserName">…</span>
        <span class="tanda-desktop-sidebar-user-caption">Profile & settings</span>
      </span>
    </a>
  `;
  document.body.insertBefore(sidebar, document.body.firstChild);

  (function hydrateDesktopSidebarProfile() {
    const img = document.getElementById('tandaDesktopSidebarUserImg');
    const fb = document.getElementById('tandaDesktopSidebarUserFallback');
    const nameEl = document.getElementById('tandaDesktopSidebarUserName');
    if (!nameEl) return;
    const showFallback = () => {
      if (img) {
        img.removeAttribute('src');
        img.style.display = 'none';
      }
      if (fb) fb.style.display = 'flex';
    };
    const showImg = () => {
      if (img) img.style.display = 'block';
      if (fb) fb.style.display = 'none';
    };
    showFallback();
    nameEl.textContent = '…';
    SuperAffiliateAPI.getCurrentUser()
      .then((me) => {
        nameEl.textContent = SuperAffiliateAPI.getWebProfileDisplayName(me);
        const av = me && me.avatar ? String(me.avatar).trim() : '';
        if (!av || !img || !fb) return;
        img.onload = () => { showImg(); };
        img.onerror = () => { showFallback(); };
        const bust = av.includes('?') ? `${av}&_sb=${Date.now()}` : `${av}?_sb=${Date.now()}`;
        img.src = bust;
      })
      .catch(() => {
        nameEl.textContent = 'Account';
      });
  })();

  const rightRail = document.createElement('aside');
  rightRail.id = 'tandaDesktopRightRail';
  rightRail.className = 'tanda-desktop-right-rail';
  rightRail.setAttribute('aria-hidden', 'true');
  sidebar.insertAdjacentElement('afterend', rightRail);

  const legacyNavStyles = document.getElementById('user-menu-styles');
  if (legacyNavStyles) {
    legacyNavStyles.remove();
  }
  if (!document.getElementById('user-menu-styles-v2')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'user-menu-styles-v2';
    styleSheet.textContent = `
      /* Navigation link buttons - Feed, Upload, etc. */
      .nav-link-btn,
      .nav-link-btn:link,
      .nav-link-btn:visited,
      .nav-link-btn:active,
      .nav-link-btn:focus {
        padding: 0.6rem 1.2rem !important;
        border-radius: 0.5rem !important;
        text-decoration: none !important;
        font-weight: 500 !important;
        transition: all 0.3s ease !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 0.5rem !important;
        color: #cccccc !important;
        background: transparent !important;
        border: 1px solid transparent !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 0.95rem !important;
        cursor: pointer !important;
        outline: none !important;
        white-space: nowrap !important;
        overflow: visible !important;
      }
      .nav-link-btn:hover {
        color: #00f2ea !important;
        background: rgba(255, 255, 255, 0.05) !important;
        text-decoration: none !important;
      }
      .nav-link-btn i {
        font-size: 0.9rem !important;
        color: inherit !important;
      }
      .nav-link-btn-primary {
        background: linear-gradient(135deg, #ff0050, #00f2ea) !important;
        color: white !important;
        border: none !important;
      }
      .nav-link-btn-primary:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 10px 30px rgba(255, 0, 80, 0.3) !important;
        color: white !important;
      }
      .nav-link-btn.tanda-nav-link-active,
      .nav-link-btn.tanda-nav-link-active:link,
      .nav-link-btn.tanda-nav-link-active:visited {
        color: #00f2ea !important;
        background: rgba(0, 242, 234, 0.12) !important;
        border: 1px solid rgba(0, 242, 234, 0.4) !important;
      }
      
      /* User menu wrapper - container for Feed, Upload, and user button */
      .user-menu-wrapper {
        display: flex !important;
        align-items: center !important;
        gap: 1rem !important;
        position: relative !important;
        overflow: visible !important;
        flex-wrap: nowrap !important;
      }
      
      /* User menu toggle button */
      .user-menu-toggle {
        display: flex !important;
        align-items: center !important;
        gap: 0.5rem !important;
        padding: 0.6rem 1rem !important;
        background: rgba(255, 255, 255, 0.05) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 0.5rem !important;
        color: #ffffff !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
        font-family: 'Inter', sans-serif !important;
        outline: none !important;
        -webkit-appearance: none !important;
        appearance: none !important;
        -webkit-tap-highlight-color: transparent !important;
        touch-action: manipulation !important;
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      .user-menu-toggle:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        border-color: #00f2ea !important;
      }
      .user-menu-toggle i:first-child {
        font-size: 1.2rem !important;
        color: inherit !important;
      }
      .user-menu-toggle i:last-child {
        font-size: 0.7rem !important;
        transition: transform 0.3s ease !important;
        color: inherit !important;
      }
      .user-menu-dropdown.active .user-menu-toggle i:last-child {
        transform: rotate(180deg) !important;
      }
      
      /* Auth nav buttons container */
      .auth-nav-buttons {
        display: flex !important;
        align-items: center !important;
        gap: 1rem !important;
        flex-wrap: nowrap !important;
      }
      
      /* Cart badge styling */
      #cart-badge {
        position: absolute !important;
        top: 0 !important;
        right: -4px !important;
        background: #ff0050 !important;
        color: white !important;
        border-radius: 50% !important;
        width: 20px !important;
        height: 20px !important;
        font-size: 0.7rem !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-weight: 700 !important;
        z-index: 10 !important;
        overflow: visible !important;
      }
      
      /* Ensure cart link allows badge overflow */
      .nav-link-btn[aria-label="Shopping Cart"] {
        overflow: visible !important;
      }
      
      /* Ensure parent containers allow overflow */
      .user-menu-wrapper,
      .tanda-nav-container {
        overflow: visible !important;
      }
      
      #cart-badge[style*="display: none"] {
        display: none !important;
      }
      
      /* User menu dropdown container */
      .user-menu-dropdown {
        position: relative !important;
        z-index: 10000 !important;
        overflow: visible !important;
      }
      
      /* When dropdown is portaled to body, ensure it's on top and scrollable (long menus on iPhone) */
      body > .user-menu {
        z-index: 99999 !important;
        max-height: min(75vh, calc(100dvh - 48px)) !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
      }
      
      .user-menu-dropdown .user-menu {
        position: fixed !important;
        background: #000000 !important;
        background-color: #000000 !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-radius: 1rem !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.9) !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        min-width: 220px !important;
        max-width: 280px !important;
        max-height: min(75vh, calc(100dvh - 48px)) !important;
        opacity: 0 !important;
        visibility: hidden !important;
        transform: none !important;
        /* No animation - instant open/close */
        transition: none !important;
        z-index: 10000 !important;
        padding: 0.5rem 0 !important;
        margin: 0 !important;
        list-style: none !important;
        display: block !important;
        pointer-events: none !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        text-align: left !important;
      }
      
      /* Mobile: Adjust dropdown width to fit viewport */
      @media (max-width: 768px) {
        .user-menu-dropdown .user-menu {
          max-width: calc(100vw - 24px) !important;
          min-width: 200px !important;
        }
      }
      .user-menu-dropdown .user-menu.active {
        opacity: 1 !important;
        visibility: visible !important;
        transform: none !important;
        pointer-events: auto !important;
        transition: none !important;
        background: #000000 !important;
        background-color: #000000 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      /* No animation - instant close */
      .user-menu-dropdown .user-menu.closing {
        transition: none !important;
      }
      .user-menu-dropdown .user-menu a.user-menu-item,
      .user-menu-dropdown .user-menu a.user-menu-item:link,
      .user-menu-dropdown .user-menu a.user-menu-item:visited,
      .user-menu-dropdown .user-menu a.user-menu-item:active {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 0.75rem !important;
        padding: 0.75rem 1.25rem !important;
        color: #cccccc !important;
        text-decoration: none !important;
        font-size: 0.95rem !important;
        font-weight: 500 !important;
        font-family: 'Inter', sans-serif !important;
        white-space: nowrap !important;
        width: 100% !important;
        box-sizing: border-box !important;
        border: none !important;
        background: transparent !important;
        cursor: pointer !important;
        margin: 0 !important;
        outline: none !important;
        text-align: left !important;
      }
      .user-menu-dropdown .user-menu a.user-menu-item:hover {
        color: #00f2ea !important;
        background: rgba(255, 255, 255, 0.05) !important;
        text-decoration: none !important;
      }
      .user-menu-dropdown .user-menu a.user-menu-item.tanda-nav-link-active {
        color: #ffffff !important;
        background: linear-gradient(90deg, rgba(255,0,80,0.15), rgba(0,242,234,0.12)) !important;
        border-left: 3px solid #00f2ea !important;
        padding-left: calc(1.25rem - 3px) !important;
      }
      .user-menu-dropdown .user-menu a.user-menu-item span {
        display: inline-block !important;
        color: inherit !important;
        text-decoration: none !important;
        font-family: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
      }
      .user-menu-dropdown .user-menu a.user-menu-item i {
        display: inline-block !important;
        width: 20px !important;
        text-align: center !important;
        font-size: 1rem !important;
        color: inherit !important;
        flex-shrink: 0 !important;
        font-style: normal !important;
      }
      .user-menu-dropdown .user-menu a.user-menu-item:hover span,
      .user-menu-dropdown .user-menu a.user-menu-item:hover i {
        color: #00f2ea !important;
      }
      .user-menu-dropdown .user-menu a.user-menu-item.user-menu-item-highlight {
        background: linear-gradient(135deg, rgba(255,0,80,0.1), rgba(0,242,234,0.1)) !important;
        border-left: 3px solid #00f2ea !important;
      }
      .user-menu-dropdown .user-menu a.user-menu-item.user-menu-item-danger {
        color: #ff6b6b !important;
      }
      .user-menu-dropdown .user-menu a.user-menu-item.user-menu-item-danger:hover {
        color: #ff5252 !important;
        background: rgba(255, 107, 107, 0.1) !important;
      }
      .user-menu-divider {
        height: 1px !important;
        background: rgba(255, 255, 255, 0.1) !important;
        margin: 0.5rem 0 !important;
        width: 100% !important;
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      /* Override any global anchor styles */
      .user-menu-wrapper .user-menu-dropdown .user-menu a,
      .user-menu-wrapper .user-menu-dropdown .user-menu a:link,
      .user-menu-wrapper .user-menu-dropdown .user-menu a:visited,
      .user-menu-wrapper .user-menu-dropdown .user-menu a:active,
      .user-menu-wrapper .user-menu-dropdown .user-menu a:focus {
        text-decoration: none !important;
        outline: none !important;
      }

      /* Desktop left sidebar – account links (mobile keeps dropdown only) */
      .tanda-desktop-sidebar {
        display: none;
        box-sizing: border-box;
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: 260px;
        z-index: 10002;
        flex-direction: column;
        background: linear-gradient(180deg, #0a0a0a 0%, #050505 100%);
        border-right: 1px solid rgba(255,255,255,0.12);
        padding-top: calc(12px + env(safe-area-inset-top, 0px));
        padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        padding-left: calc(12px + env(safe-area-inset-left, 0px));
        padding-right: 12px;
      }

      .tanda-desktop-sidebar-brand {
        padding: 0 0.5rem 1rem;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        margin-bottom: 0.75rem;
      }

      .tanda-desktop-sidebar-logo {
        display: flex !important;
        align-items: center;
        gap: 0.6rem;
        text-decoration: none !important;
        color: #fff !important;
        font-weight: 800;
        font-size: 1.1rem;
        letter-spacing: 0.02em;
      }

      .tanda-desktop-sidebar-logo i {
        font-size: 1.35rem;
        background: linear-gradient(135deg, #ff0050, #00f2ea);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        color: transparent !important;
      }

      .tanda-desktop-sidebar-nav {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 0.25rem 0 1rem;
      }

      .tanda-desktop-sidebar-user {
        display: flex !important;
        align-items: center !important;
        gap: 0.75rem !important;
        margin-top: auto !important;
        flex-shrink: 0 !important;
        padding: 0.85rem 0.5rem 0.35rem !important;
        border-top: 1px solid rgba(255,255,255,0.1) !important;
        text-decoration: none !important;
        outline: none !important;
        border-radius: 0.65rem !important;
        color: #fff !important;
        box-sizing: border-box !important;
        min-height: 52px !important;
      }

      .tanda-desktop-sidebar-user:hover {
        background: rgba(255, 255, 255, 0.06) !important;
      }

      .tanda-desktop-sidebar-user:focus-visible {
        box-shadow: 0 0 0 2px rgba(0, 242, 234, 0.45) !important;
      }

      .tanda-desktop-sidebar-user-avatar {
        position: relative !important;
        width: 44px !important;
        height: 44px !important;
        border-radius: 50% !important;
        overflow: hidden !important;
        flex-shrink: 0 !important;
        background: rgba(255, 255, 255, 0.08) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .tanda-desktop-sidebar-user-img {
        display: none;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
      }

      .tanda-desktop-sidebar-user-fallback {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        height: 100% !important;
        color: #888 !important;
        font-size: 1.05rem !important;
      }

      .tanda-desktop-sidebar-user-meta {
        display: flex !important;
        flex-direction: column !important;
        min-width: 0 !important;
        gap: 0.12rem !important;
      }

      .tanda-desktop-sidebar-user-name {
        font-size: 0.92rem !important;
        font-weight: 600 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        color: #fff !important;
      }

      .tanda-desktop-sidebar-user-caption {
        font-size: 0.68rem !important;
        color: #888 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
      }

      .tanda-desktop-sidebar .user-menu-item,
      .tanda-desktop-sidebar a.user-menu-item:link,
      .tanda-desktop-sidebar a.user-menu-item:visited,
      .tanda-desktop-sidebar a.user-menu-item:active {
        display: flex !important;
        align-items: center !important;
        gap: 0.75rem !important;
        padding: 0.7rem 0.85rem !important;
        margin: 0.1rem 0 !important;
        border-radius: 0.6rem !important;
        color: #cccccc !important;
        text-decoration: none !important;
        font-size: 0.92rem !important;
        font-weight: 500 !important;
        font-family: 'Inter', sans-serif !important;
        width: 100% !important;
        box-sizing: border-box !important;
        border: none !important;
        background: transparent !important;
        cursor: pointer !important;
        outline: none !important;
        text-align: left !important;
        min-height: 44px;
      }

      .tanda-desktop-sidebar a.user-menu-item:hover {
        color: #00f2ea !important;
        background: rgba(255, 255, 255, 0.06) !important;
      }

      .tanda-desktop-sidebar a.user-menu-item i {
        width: 22px !important;
        text-align: center !important;
        flex-shrink: 0 !important;
      }

      .tanda-desktop-sidebar a.user-menu-item.user-menu-item-highlight {
        background: linear-gradient(135deg, rgba(255,0,80,0.12), rgba(0,242,234,0.1)) !important;
        border-left: 3px solid #00f2ea !important;
        padding-left: calc(0.85rem - 3px) !important;
      }

      .tanda-desktop-sidebar a.user-menu-item.tanda-nav-link-active,
      .tanda-desktop-sidebar a.user-menu-item.tanda-nav-link-active:link,
      .tanda-desktop-sidebar a.user-menu-item.tanda-nav-link-active:visited {
        color: #ffffff !important;
        background: linear-gradient(90deg, rgba(255,0,80,0.18), rgba(0,242,234,0.14)) !important;
        border-left: 3px solid #00f2ea !important;
        padding-left: calc(0.85rem - 3px) !important;
        box-shadow: inset 0 0 0 1px rgba(0,242,234,0.12);
      }

      .tanda-desktop-sidebar-user.tanda-sidebar-profile-active {
        background: rgba(0, 242, 234, 0.1) !important;
        box-shadow: inset 0 0 0 1px rgba(0, 242, 234, 0.35);
      }

      .tanda-desktop-sidebar a.user-menu-item.user-menu-item-danger {
        color: #ff6b6b !important;
        margin-top: 0.5rem !important;
      }

      .tanda-desktop-sidebar a.user-menu-item.user-menu-item-danger:hover {
        color: #ff5252 !important;
        background: rgba(255, 107, 107, 0.08) !important;
      }

      .tanda-desktop-sidebar .user-menu-divider {
        margin: 0.4rem 0.25rem !important;
      }

      /* Empty right rail – balances layout so main column stays centered (desktop only) */
      .tanda-desktop-right-rail {
        display: none;
        box-sizing: border-box;
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 260px;
        z-index: 10001;
        background: linear-gradient(180deg, #0a0a0a 0%, #050505 100%);
        border-left: 1px solid rgba(255,255,255,0.12);
        padding-top: calc(12px + env(safe-area-inset-top, 0px));
        padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        padding-right: calc(12px + env(safe-area-inset-right, 0px));
        padding-left: 12px;
        pointer-events: none;
      }

      @media (min-width: 1024px) {
        body.tanda-desktop-sidebar-on .tanda-desktop-sidebar {
          display: flex !important;
        }

        body.tanda-desktop-sidebar-on .tanda-desktop-right-rail {
          display: block !important;
        }

        body.tanda-desktop-sidebar-on {
          padding-left: calc(260px + env(safe-area-inset-left, 0px)) !important;
          padding-right: calc(260px + env(safe-area-inset-right, 0px)) !important;
        }

        body.tanda-desktop-sidebar-on .topbar {
          left: calc(260px + env(safe-area-inset-left, 0px)) !important;
          width: calc(100% - 520px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) !important;
          right: auto !important;
        }

        body.tanda-desktop-sidebar-on .header {
          margin-left: 0 !important;
          padding-left: calc(2rem + env(safe-area-inset-left, 0px)) !important;
          padding-right: calc(2rem + env(safe-area-inset-right, 0px)) !important;
          max-width: none !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        /* Reel pages: fixed chrome ignores body padding – inset from L/R rails so nav is not covered (desktop only) */
        body.tanda-desktop-sidebar-on.instant-page .instant-chrome {
          left: calc(260px + env(safe-area-inset-left, 0px)) !important;
          right: auto !important;
          width: calc(100% - 520px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) !important;
          padding-left: 12px !important;
          padding-right: 12px !important;
        }
        body.tanda-desktop-sidebar-on.discover-page .disc-chrome {
          left: calc(260px + env(safe-area-inset-left, 0px)) !important;
          right: auto !important;
          width: calc(100% - 520px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) !important;
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        .user-menu-toggle {
          display: none !important;
        }

        .user-menu-dropdown .user-menu {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      }

      /* Instant checkout: mobile strip = Shop + account only */
      .tanda-nav-instant-shop-mobile-only {
        display: none !important;
      }
      @media (max-width: 1023px) {
        #authNav.tanda-nav-mode-instant_shop .tanda-nav-instant-shop-mobile-only {
          display: inline-flex !important;
        }
        #authNav.tanda-nav-mode-instant_shop .tanda-nav-strip-hide-instant-mobile {
          display: none !important;
        }
      }

      /* Immersive shop: no Home / Upload. Desktop strip adds Shop; mobile = Cart + account only (parity with instant-shop strip, Shop → Cart). */
      #authNav.tanda-nav-mode-immersive_shop .tanda-nav-strip-hide-immersive {
        display: none !important;
      }
      #authNav.tanda-nav-mode-immersive_shop .tanda-nav-immersive-strip-shop {
        display: none !important;
      }
      @media (min-width: 1024px) {
        #authNav.tanda-nav-mode-immersive_shop .tanda-nav-immersive-strip-shop {
          display: inline-flex !important;
        }
      }
    `;
    document.head.appendChild(styleSheet);
  }
  
  // Setup user menu toggle - use a small delay to ensure DOM is ready
  setTimeout(() => {
    const menuToggle = document.getElementById('userMenuToggle');
    const userMenu = document.getElementById('userMenu');
    const userMenuDropdown = el.querySelector('.user-menu-dropdown');
    
    if (!menuToggle || !userMenu || !userMenuDropdown) {
      console.error('User menu elements not found', { menuToggle, userMenu, userMenuDropdown });
      return;
    }
    
    // Debug: Log menu items
    const menuItems = userMenu.querySelectorAll('.user-menu-item');
    safeLog('User menu items found:', menuItems.length, menuItems);
    
    let clickHandler = null;
    let touchStartTime = 0;
    let touchStartPos = { x: 0, y: 0 };
    
    // iOS Safari fix: Add touch event handlers in addition to click
    // This ensures the menu works on real iOS devices
    const handleMenuToggle = (e) => {
      if (window.matchMedia('(min-width: 1024px)').matches) return;
      e.stopPropagation();
      e.preventDefault();
      const isActive = userMenu.classList.contains('active');
      
        if (isActive) {
        // Close instantly (disable transition for this close)
        userMenu.classList.add('closing');
        userMenu.classList.remove('active');
        userMenuDropdown.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        userMenu.style.opacity = '0';
        userMenu.style.visibility = 'hidden';
        userMenu.style.transform = 'none';
        userMenu.style.pointerEvents = 'none';
        userMenu.style.maxHeight = '';
        userMenu.style.overflowY = '';
        userMenu.style.overflowX = '';
        // Reset positioning
        userMenu.style.position = '';
        userMenu.style.top = '';
        userMenu.style.left = '';
        userMenu.style.right = '';
        userMenu.style.bottom = '';
        userMenu.style.maxWidth = '';
        
        // PORTAL RESTORATION: Move dropdown back to original parent if it was moved
        if (userMenu.dataset.originalParentId && userMenu.parentElement === document.body) {
          const originalParentId = userMenu.dataset.originalParentId;
          const originalParent = document.getElementById(originalParentId);
          if (originalParent && originalParent !== document.body) {
            originalParent.appendChild(userMenu);
          }
          delete userMenu.dataset.originalParentId;
        }
        
        setTimeout(() => userMenu.classList.remove('closing'), 50);
        if (clickHandler) {
          document.removeEventListener('click', clickHandler);
          clickHandler = null;
        }
      } else {
        // Ensure we don't carry over the close override
        userMenu.classList.remove('closing');
        
        // PORTAL APPROACH: Move dropdown to body FIRST to escape overflow containers
        // This ensures the dropdown appears even when inside scrollable containers
        // Store reference to original parent for restoration later
        if (!userMenu.dataset.originalParentId) {
          // Create a unique ID for the original parent if it doesn't have one
          if (!userMenuDropdown.id) {
            userMenuDropdown.id = 'user-menu-dropdown-' + Date.now();
          }
          userMenu.dataset.originalParentId = userMenuDropdown.id;
        }
        
        // Move to body if not already there
        if (userMenu.parentElement !== document.body) {
          document.body.appendChild(userMenu);
        }
        
        // Calculate position for fixed dropdown (to avoid clipping by overflow containers)
        const toggleRect = menuToggle.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const isMobile = viewportWidth <= 768;
        const spacing = 8; // Space between button and dropdown
        
        // Temporarily show menu to measure its actual size
        userMenu.style.display = 'block';
        userMenu.style.visibility = 'hidden';
        userMenu.style.opacity = '0';
        userMenu.style.position = 'fixed';
        userMenu.style.top = '0';
        userMenu.style.left = '0';
        const menuRect = userMenu.getBoundingClientRect();
        const dropdownWidth = menuRect.width || 240;
        const dropdownHeight = menuRect.height || 300;
        
        // Calculate position - prefer right alignment, but adjust if near viewport edge
        let left, right, top;
        const padding = isMobile ? 12 : 10; // More padding on mobile
        
        // On mobile, prefer right alignment when button is on the right side
        if (isMobile && toggleRect.right > viewportWidth / 2) {
          // Button is on right side - align dropdown to right edge of viewport with padding
          right = padding;
          left = 'auto';
          
          // Ensure dropdown doesn't exceed viewport width
          const maxDropdownWidth = viewportWidth - (padding * 2);
          if (dropdownWidth > maxDropdownWidth) {
            userMenu.style.maxWidth = maxDropdownWidth + 'px';
          }
        } else {
          // Desktop or button on left side - use left positioning
          left = toggleRect.right - dropdownWidth;
          right = 'auto';
          
          // Ensure dropdown doesn't go off-screen on the left
          if (left < padding) {
            left = toggleRect.left;
            // If still off-screen, align to left edge with padding
            if (left < padding) {
              left = padding;
            }
          }
          
          // Ensure dropdown doesn't go off-screen on the right
          if (left + dropdownWidth > viewportWidth - padding) {
            left = viewportWidth - dropdownWidth - padding;
            // If dropdown is too wide, use right positioning instead
            if (left < padding) {
              right = padding;
              left = 'auto';
              const maxDropdownWidth = viewportWidth - (padding * 2);
              if (dropdownWidth > maxDropdownWidth) {
                userMenu.style.maxWidth = maxDropdownWidth + 'px';
              }
            }
          }
        }
        
        // Vertical positioning
        top = toggleRect.bottom + spacing;
        
        // If dropdown would go off-screen at bottom, show above instead
        if (top + dropdownHeight > viewportHeight - padding) {
          top = toggleRect.top - dropdownHeight - spacing;
          // Ensure it doesn't go off-screen at top either
          if (top < padding) {
            top = padding;
          }
        }
        
        // Apply fixed positioning
        userMenu.style.position = 'fixed';
        userMenu.style.top = top + 'px';
        if (left !== undefined && left !== 'auto') {
          userMenu.style.left = left + 'px';
          userMenu.style.right = 'auto';
        } else {
          userMenu.style.right = right + 'px';
          userMenu.style.left = 'auto';
        }
        userMenu.style.bottom = 'auto';
        
        // Remove inline display:none if present
        userMenu.style.display = 'block';
        userMenu.classList.add('active');
        userMenuDropdown.classList.add('active');
        menuToggle.setAttribute('aria-expanded', 'true');
        userMenu.style.opacity = '1';
        userMenu.style.visibility = 'visible';
        userMenu.style.transform = 'none';
        userMenu.style.pointerEvents = 'auto';
        // Explicitly set opaque background to override any transparency
        userMenu.style.background = '#000000';
        userMenu.style.backdropFilter = 'none';
        userMenu.style.webkitBackdropFilter = 'none';
        // Ensure border and rounded edges match index.html
        userMenu.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        userMenu.style.borderRadius = '1rem';
        const menuMaxH = Math.max(160, Math.min(viewportHeight * 0.75, viewportHeight - top - padding));
        userMenu.style.maxHeight = menuMaxH + 'px';
        userMenu.style.overflowY = 'auto';
        userMenu.style.overflowX = 'hidden';
        userMenu.style.setProperty('-webkit-overflow-scrolling', 'touch');
        
        // Apply hover styles to all menu items
        const menuItems = userMenu.querySelectorAll('.user-menu-item');
        menuItems.forEach(item => {
          // Ensure inline styles are preserved
          if (!item.style.display) {
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '0.75rem';
            item.style.padding = '0.75rem 1.25rem';
            item.style.color = '#cccccc';
            item.style.textDecoration = 'none';
            item.style.fontSize = '0.95rem';
            item.style.fontWeight = '500';
            item.style.fontFamily = "'Inter', sans-serif";
            item.style.whiteSpace = 'nowrap';
            item.style.width = '100%';
            item.style.boxSizing = 'border-box';
            item.style.border = 'none';
            item.style.background = 'transparent';
            item.style.cursor = 'pointer';
            item.style.margin = '0';
            item.style.outline = 'none';
          }
          
          // Add hover event listeners for visual feedback
          item.addEventListener('mouseenter', function() {
            this.style.color = '#00f2ea';
            this.style.background = 'rgba(255, 255, 255, 0.05)';
            const span = this.querySelector('span');
            const icon = this.querySelector('i');
            if (span) span.style.color = '#00f2ea';
            if (icon) icon.style.color = '#00f2ea';
          });
          
          item.addEventListener('mouseleave', function() {
            if (!this.classList.contains('user-menu-item-danger')) {
              this.style.color = '#cccccc';
              this.style.background = 'transparent';
              const span = this.querySelector('span');
              const icon = this.querySelector('i');
              if (span) span.style.color = '#cccccc';
              if (icon) icon.style.color = '#cccccc';
            } else {
              this.style.color = '#ff6b6b';
              this.style.background = 'transparent';
            }
          });
        });
        
        // Close menu when clicking outside
        clickHandler = (e) => {
          if (!userMenuDropdown.contains(e.target) && !menuToggle.contains(e.target) && !userMenu.contains(e.target)) {
            // Close instantly (disable transition for this close)
            userMenu.classList.add('closing');
            userMenu.classList.remove('active');
            userMenuDropdown.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            userMenu.style.opacity = '0';
            userMenu.style.visibility = 'hidden';
            userMenu.style.transform = 'none';
            userMenu.style.pointerEvents = 'none';
            // Reset positioning
            userMenu.style.position = '';
            userMenu.style.top = '';
            userMenu.style.left = '';
            userMenu.style.right = '';
            userMenu.style.bottom = '';
            userMenu.style.maxWidth = '';
            
            // PORTAL RESTORATION: Move dropdown back to original parent if it was moved
            if (userMenu.dataset.originalParentId && userMenu.parentElement === document.body) {
              const originalParentId = userMenu.dataset.originalParentId;
              const originalParent = document.getElementById(originalParentId);
              if (originalParent && originalParent !== document.body) {
                originalParent.appendChild(userMenu);
              }
              delete userMenu.dataset.originalParentId;
            }
            
            setTimeout(() => userMenu.classList.remove('closing'), 50);
            document.removeEventListener('click', clickHandler);
            clickHandler = null;
          }
        };
        
        // Use a small delay to avoid immediate closure
        setTimeout(() => {
          document.addEventListener('click', clickHandler);
        }, 10);
      }
    };
    
    // Add both click and touch handlers for cross-platform compatibility
    // iOS Safari often requires touchstart/touchend instead of just click
    menuToggle.addEventListener('touchstart', (e) => {
      touchStartTime = Date.now();
      touchStartPos.x = e.touches[0].clientX;
      touchStartPos.y = e.touches[0].clientY;
      // Don't prevent default here - let touchend handle it
    }, { passive: true });
    
    menuToggle.addEventListener('touchend', (e) => {
      const touchEndTime = Date.now();
      const touchDuration = touchEndTime - touchStartTime;
      const touchEndPos = { 
        x: e.changedTouches[0].clientX, 
        y: e.changedTouches[0].clientY 
      };
      
      // Only trigger if it's a quick tap (not a swipe) and within 10px movement
      const moveDistance = Math.sqrt(
        Math.pow(touchEndPos.x - touchStartPos.x, 2) + 
        Math.pow(touchEndPos.y - touchStartPos.y, 2)
      );
      
      if (touchDuration < 300 && moveDistance < 10) {
        e.preventDefault();
        e.stopPropagation();
        handleMenuToggle(e);
      }
    });
    
    menuToggle.addEventListener('click', handleMenuToggle);
  }, 50);
  
  document.querySelectorAll('.tanda-logout-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      SuperAffiliateAPI.logout();
    });
  });

  // Check seller/affiliate status and add appropriate links (mobile + desktop sidebar)
  (async function() {
    const placeholders = document.querySelectorAll('.sellerAffiliateMenuPlaceholder');
    if (!placeholders.length) return;

    const root = SuperAffiliateAPI.getPathToSiteRoot();
    let isSeller = false;
    let isAffiliate = false;

    function applySellerAffiliateSpecs(linkSpecs) {
      placeholders.forEach((ph) => {
        linkSpecs.forEach((spec) => {
          const a = document.createElement('a');
          a.href = spec.href;
          a.className = spec.className;
          a.innerHTML = spec.inner;
          ph.parentNode.insertBefore(a, ph);
        });
        ph.remove();
      });
    }

    const linkSpecs = [];

    const pushLink = (href, inner, className) => {
      linkSpecs.push({
        href,
        inner,
        className: className || 'user-menu-item',
      });
    };

    try {
      try {
        const me = await SuperAffiliateAPI.getCurrentUser();
        if (me && SuperAffiliateAPI.isTandaWebAdmin(me)) {
          pushLink(
            root + 'admin-tools/strategic-analysis.html',
            '<i class="fas fa-shield-alt"></i><span>Admin tools</span>'
          );
        }
      } catch (_) {
        /* omit admin link if profile unavailable */
      }

      try {
        const sellerProfile = await SuperAffiliateAPI.apiRequest('/commerce/seller/profile/');
        if (sellerProfile && sellerProfile.id) {
          isSeller = true;
          pushLink(
            root + 'seller-dashboard.html',
            '<i class="fas fa-store"></i><span>Seller Dashboard</span>'
          );
        }
      } catch (e) {
        const errorMsg = e.message || '';
        const isExpectedError = errorMsg.includes('404') ||
                               errorMsg.includes('not found') ||
                               errorMsg.includes('Seller profile not found');
        if (!isExpectedError) {
          console.warn('Error checking seller status:', e);
        }
      }

      try {
        const affiliateProfile = await SuperAffiliateAPI.apiRequest('/commerce/affiliate/profile/');
        if (affiliateProfile && affiliateProfile.id) {
          isAffiliate = true;
          pushLink(
            root + 'affiliate-dashboard.html',
            '<i class="fas fa-user-tie"></i><span>Affiliate Dashboard</span>'
          );
        }
      } catch (e) {
        console.warn('Unexpected error checking affiliate status:', e);
      }

      if (!isSeller && !isAffiliate) {
        pushLink(root + 'become-seller.html', '<i class="fas fa-store"></i><span>Become a Seller</span>');
        pushLink(root + 'become-affiliate.html', '<i class="fas fa-user-tie"></i><span>Become an Affiliate</span>');
      } else {
        if (isSeller) {
          pushLink(root + 'add-product.html', '<i class="fas fa-plus-circle"></i><span>Add Product</span>');
          pushLink(
            root + 'seller-instant-checkout.html',
            '<i class="fas fa-bolt"></i><span>Instant checkout</span>'
          );
        }
        if (isAffiliate) {
          pushLink(root + 'promote-products.html', '<i class="fas fa-tag"></i><span>Promote Products</span>');
        }
      }

      applySellerAffiliateSpecs(linkSpecs);
      SuperAffiliateAPI.applyActiveNavState();
    } catch (e) {
      const fallback = [];
      if (!isSeller && !isAffiliate) {
        fallback.push({
          href: root + 'become-seller.html',
          className: 'user-menu-item',
          inner: '<i class="fas fa-store"></i><span>Become a Seller</span>',
        });
        fallback.push({
          href: root + 'become-affiliate.html',
          className: 'user-menu-item',
          inner: '<i class="fas fa-user-tie"></i><span>Become an Affiliate</span>',
        });
      }
      applySellerAffiliateSpecs(fallback.length ? fallback : linkSpecs);
      SuperAffiliateAPI.applyActiveNavState();
    }
  })();

  // Check Super Affiliate status and add Dashboard link if applicable
  SuperAffiliateAPI.getMyStatus().then(status => {
    const dashRoot = SuperAffiliateAPI.getPathToSiteRoot();
    document.querySelectorAll('.dashboardMenuPlaceholder').forEach((placeholder) => {
      if (placeholder && status && (status.status === 'active' || status.status === 'invited')) {
        const a = document.createElement('a');
        a.href = dashRoot + 'super-affiliate-dashboard.html';
        a.className = 'user-menu-item user-menu-item-highlight';
        a.innerHTML = '<i class="fas fa-tachometer-alt"></i><span>Super Affiliate Dashboard</span>';
        placeholder.replaceWith(a);
      } else if (placeholder) {
        placeholder.remove();
      }
    });
    SuperAffiliateAPI.applyActiveNavState();
  }).catch(() => {
    document.querySelectorAll('.dashboardMenuPlaceholder').forEach((placeholder) => {
      if (placeholder) placeholder.remove();
    });
  });

  // Update cart badge if authenticated
  if (SuperAffiliateAPI.isAuthenticated()) {
    SuperAffiliateAPI.apiRequest('/commerce/cart/').then(cart => {
      const itemCount = (cart.items || []).reduce((sum, item) => sum + item.quantity, 0);
      const badge = document.getElementById('cart-badge');
      if (badge) {
        badge.textContent = itemCount;
        badge.style.display = itemCount > 0 ? 'flex' : 'none';
      }
    }).catch(() => {
      // Silently fail
    });
  }

  SuperAffiliateAPI.applyActiveNavState();
  setTimeout(() => SuperAffiliateAPI.applyActiveNavState(), 450);
};

// Add helper functions
/** Above desktop L/R rails (10001–10002), user menu (10000), shopping assistant (10051–10055). */
window.TANDA_WEB_TOAST_Z_INDEX = 100600;

window.showToast = function(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  const z = typeof window.TANDA_WEB_TOAST_Z_INDEX === 'number' ? window.TANDA_WEB_TOAST_Z_INDEX : 100600;
  toast.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: ${type === 'success' ? '#00f2ea' : '#ff0050'};
    color: white;
    padding: 1rem 2rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    z-index: ${z};
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  /* Shared nav buttons for top-right auth area */
  .tanda-nav-btn {
    text-decoration: none;
    color: #ffffff;
    background: rgba(255,255,255,0.08);
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    margin-left: 0.5rem;
    white-space: nowrap;
  }
  .tanda-nav-btn:hover { opacity: 0.9; }
  .tanda-nav-btn-primary {
    background: linear-gradient(135deg, #ff0050, #00f2ea);
  }
  .tanda-nav-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow-x: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    position: relative; /* Ensure dropdown can escape overflow */
  }
  .tanda-nav-container::-webkit-scrollbar { display: none; }
  
  /* Mobile: Ensure tanda-nav-container is scrollable */
  @media (max-width: 768px) {
    .tanda-nav-container {
      flex: 1;
      min-width: 0;
      max-width: 100%;
    }
    
    .tanda-nav-container .user-menu-wrapper {
      min-width: max-content;
      width: max-content;
    }
  }
  
  /* Ensure user menu dropdown can escape overflow clipping */
  .tanda-nav-container .user-menu-wrapper {
    position: relative;
    z-index: 10001; /* Higher than container */
  }
  
  .tanda-nav-container .user-menu-dropdown {
    overflow: visible !important;
  }

  /* Mobile: icon-first, compact, never overflow */
  @media (max-width: 520px) {
    .tanda-nav-btn {
      padding: 0.6rem 0.75rem;
      border-radius: 0.85rem;
      margin-left: 0.35rem;
      gap: 0.45rem;
      font-weight: 800;
    }
    .tanda-nav-label {
      display: none;
    }
    .tanda-nav-btn i {
      font-size: 1.05rem;
    }
  }

  /* Mobile: Reduce spacing between nav links */
  @media (max-width: 768px) {
    .user-menu-wrapper {
      gap: 0.35rem !important;
    }
    .nav-link-btn {
      padding: 0.5rem 0.75rem !important;
      font-size: 0.85rem !important;
    }
    .nav-link-btn i {
      font-size: 0.8rem !important;
    }
    .user-menu-toggle {
      padding: 0.5rem 0.75rem !important;
      font-size: 0.85rem !important;
    }
  }

  @media (max-width: 480px) {
    .user-menu-wrapper {
      gap: 0.25rem !important;
    }
    .nav-link-btn {
      padding: 0.45rem 0.6rem !important;
      font-size: 0.8rem !important;
    }
    .nav-link-btn i {
      font-size: 0.75rem !important;
    }
    .user-menu-toggle {
      padding: 0.45rem 0.6rem !important;
      font-size: 0.8rem !important;
    }
  }
`;
document.head.appendChild(style);

safeLog('✅ Tanda Super Affiliate API Helper loaded');


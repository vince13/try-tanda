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
            errorMessage.includes('No Super Affiliate invitation found');
          
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
   * Refresh authentication token
   */
  static async refreshToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      // Add timeout using Promise.race for better browser compatibility
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Token refresh timeout')), 10000); // 10 second timeout
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
        // If refresh token is invalid, clear tokens
        if (response.status === 401 || response.status === 403) {
          this.clearTokens();
        }
        return false;
      }

      const data = await response.json();
      if (data.access) {
        this.setToken(data.access);
        // If new refresh token provided, update it
        if (data.refresh) {
          this.setRefreshToken(data.refresh);
        }
        return true;
      }

      return false;
    } catch (error) {
      // Handle network errors, timeouts, and other failures
      if (error.message === 'Token refresh timeout' || error.name === 'TypeError') {
        // Network error or timeout - don't clear tokens, might be temporary
        // Only log in development
        if (typeof process === 'undefined' || process.env?.NODE_ENV === 'development') {
          console.error('Token refresh network error:', error);
        }
      } else {
        // Other errors - clear tokens as they might be invalid
        this.clearTokens();
        if (typeof process === 'undefined' || process.env?.NODE_ENV === 'development') {
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
      const response = await this.apiRequest('/users/token/', {
        method: 'POST',
        body: JSON.stringify({ username: emailOrUsername, password }),
      });

      // JWT TokenObtainPairView returns { access: "...", refresh: "..." }
      if (response.access) {
        this.setTokensFromResponse(response);
        return response;
      } else {
        throw new Error('Invalid response format from login endpoint');
      }
    } catch (error) {
      // Re-throw with more user-friendly message
      if (error.message.includes('credentials') || error.message.includes('Invalid')) {
        throw new Error('Invalid email/username or password. Please check your credentials and try again.');
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
   * Logout user
   */
  static logout() {
    this.clearTokens();
    window.location.href = 'index.html';
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
   */
  static async multipartRequest(endpoint, formData, options = {}) {
    const token = this.getToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: options.method || 'POST',
      headers, // NOTE: do NOT set Content-Type, browser will set boundary
      body: formData,
    });

    const rawText = await response.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const errorText = (data && (data.error || data.detail || data.message)) || rawText || `Upload failed (${response.status})`;
      throw new Error(errorText);
    }

    return data;
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
  static async publishVideo({ file, caption = '', isPublic = true }) {
    const form = new FormData();
    form.append('video', file);
    form.append('caption', caption);
    form.append('privacy_settings', JSON.stringify({ isPublic }));
    form.append('advanced_settings', JSON.stringify({}));

    return await this.multipartRequest('/videos/publish/', form, { method: 'POST' });
  }

  /**
   * List current user's videos
   * Backend endpoint: GET /api/videos/my-videos/
   */
  static async getMyVideos(page = 1) {
    const qp = new URLSearchParams({ page: String(page) }).toString();
    return await this.apiRequest(`/videos/my-videos/?${qp}`, { method: 'GET' });
  }

  /**
   * Get the main video feed (TikTok-like infinite feed).
   * Backend endpoint: GET /api/videos/feed/?page=1&per_page=20
   */
  static async getFeed({ page = 1, perPage = 10, refresh = false } = {}) {
    const qp = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      refresh: refresh ? '1' : '0',
    }).toString();
    return await this.apiRequest(`/videos/feed/?${qp}`, { method: 'GET' });
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
   * Cart Management Methods
   */
  static async getCart() {
    // Add cache-busting parameter to ensure fresh data
    const cacheBuster = new Date().getTime();
    return await this.apiRequest(`/commerce/cart/?_t=${cacheBuster}`);
  }

  static async addToCart(productId, quantity = 1) {
    return await this.apiRequest('/commerce/cart/add/', {
      method: 'POST',
      body: JSON.stringify({
        product: productId,
        quantity: quantity,
      }),
    });
  }

  static async updateCartItem(itemId, quantity) {
    return await this.apiRequest(`/commerce/cart/items/${itemId}/update/`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
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
 * Render a standard auth header area.
 * - If logged out: Login / Sign up
 * - If logged in: Upload / My Videos / Logout
 *
 * Usage: <div id="authNav"></div> then SuperAffiliateAPI.renderAuthNav('authNav')
 */
SuperAffiliateAPI.renderAuthNav = function(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

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

  if (!isAuthed) {
    const homeLink = (isHomePage || isUploadPage || isMyVideosPage) ? '' : `
        <a href="index.html" class="nav-link-btn" aria-label="Home">
          <i class="fas fa-home"></i> Home
        </a>`;
    el.innerHTML = `
      <div class="auth-nav-buttons">
        ${homeLink}
        <a href="feed.html" class="nav-link-btn" aria-label="Feed">
          <i class="fas fa-play"></i> Feed
      </a>
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

  // Create elegant user menu dropdown
  // Don't add "Home" link on home page, upload page, or my-videos page (these pages have static Home link)
  const homeLink = (isHomePage || isUploadPage || isMyVideosPage) ? '' : `
      <a href="index.html" class="nav-link-btn" aria-label="Home">
        <i class="fas fa-home"></i> Home
      </a>`;
  const userMenuHTML = `
    <div class="user-menu-wrapper">
      ${homeLink}
      <a href="feed.html" class="nav-link-btn" aria-label="Feed">
        <i class="fas fa-play"></i> Feed
      </a>
      <a href="upload.html" class="nav-link-btn" aria-label="Upload">
        <i class="fas fa-cloud-upload-alt"></i> Upload
      </a>
      <a href="cart.html" class="nav-link-btn" aria-label="Shopping Cart" style="position: relative;" onclick="if(!SuperAffiliateAPI.isAuthenticated()) { event.preventDefault(); window.location.href='super-affiliate-login.html?redirect=' + encodeURIComponent('cart.html'); }">
        <i class="fas fa-shopping-cart"></i> Cart
        <span id="cart-badge" style="display: none; position: absolute; top: -8px; right: -8px; background: #ff0050; color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; font-weight: 700; z-index: 10;">0</span>
      </a>
      <div class="user-menu-dropdown">
        <button class="user-menu-toggle" id="userMenuToggle" aria-label="User menu">
          <i class="fas fa-user-circle"></i>
          <i class="fas fa-chevron-down"></i>
        </button>
        <div class="user-menu" id="userMenu">
          <a href="profile.html" class="user-menu-item">
            <i class="fas fa-user"></i>
            <span>Profile & Settings</span>
          </a>
          <a href="wallet.html" class="user-menu-item">
            <i class="fas fa-wallet"></i>
            <span>Wallet & Transactions</span>
          </a>
          <a href="analytics.html" class="user-menu-item">
            <i class="fas fa-chart-line"></i>
            <span>Analytics</span>
          </a>
          <a href="wishlist.html" class="user-menu-item">
            <i class="fas fa-heart"></i>
            <span>My Wishlist</span>
          </a>
          <a href="orders.html" class="user-menu-item">
            <i class="fas fa-shopping-bag"></i>
            <span>My Orders</span>
          </a>
          <a href="my-videos.html" class="user-menu-item">
            <i class="fas fa-film"></i>
            <span>My Videos</span>
          </a>
          <div class="user-menu-divider" style="margin: 0.5rem 0; border-top: 1px solid rgba(255,255,255,0.1);"></div>
          <span id="sellerAffiliateMenuPlaceholder"></span>
          <span id="dashboardMenuPlaceholder"></span>
          <div class="user-menu-divider"></div>
          <a href="#" class="user-menu-item user-menu-item-danger" id="logoutBtn">
            <i class="fas fa-sign-out-alt"></i>
            <span>Logout</span>
          </a>
        </div>
      </div>
    </div>
  `;
  
  el.innerHTML = userMenuHTML;
  
  // Inject navigation and user menu styles if not already present
  if (!document.getElementById('user-menu-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'user-menu-styles';
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
        top: -8px !important;
        right: -8px !important;
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
      
      .user-menu-dropdown .user-menu {
        position: fixed !important;
        background: #000000 !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-radius: 1rem !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
        backdrop-filter: blur(20px) !important;
        min-width: 220px !important;
        max-width: 280px !important;
        opacity: 0 !important;
        visibility: hidden !important;
        transform: translateY(-10px) !important;
        /* Don't animate left/right/top changes (we position in JS). */
        transition: opacity 0.2s ease, transform 0.2s ease, visibility 0s linear 0.2s !important;
        z-index: 10000 !important;
        padding: 0.5rem 0 !important;
        margin: 0 !important;
        list-style: none !important;
        display: block !important;
        pointer-events: none !important;
        overflow: visible !important;
        will-change: opacity, transform;
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
        transform: translateY(0) !important;
        pointer-events: auto !important;
        transition: opacity 0.2s ease, transform 0.2s ease, visibility 0s !important;
      }
      /* Close instantly (no animation) to avoid "flying away" on mobile. */
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
    
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isActive = userMenu.classList.contains('active');
      
      if (isActive) {
        // Close instantly (disable transition for this close)
        userMenu.classList.add('closing');
        userMenu.classList.remove('active');
        userMenuDropdown.classList.remove('active');
        userMenu.style.opacity = '0';
        userMenu.style.visibility = 'hidden';
        userMenu.style.transform = 'translateY(-10px)';
        userMenu.style.pointerEvents = 'none';
        // Reset positioning
        userMenu.style.position = '';
        userMenu.style.top = '';
        userMenu.style.left = '';
        userMenu.style.right = '';
        userMenu.style.bottom = '';
        userMenu.style.maxWidth = '';
        setTimeout(() => userMenu.classList.remove('closing'), 50);
        if (clickHandler) {
          document.removeEventListener('click', clickHandler);
          clickHandler = null;
        }
      } else {
        // Ensure we don't carry over the close override
        userMenu.classList.remove('closing');
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
        userMenu.style.opacity = '1';
        userMenu.style.visibility = 'visible';
        userMenu.style.transform = 'translateY(0)';
        userMenu.style.pointerEvents = 'auto';
        
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
            userMenu.style.opacity = '0';
            userMenu.style.visibility = 'hidden';
            userMenu.style.transform = 'translateY(-10px)';
            userMenu.style.pointerEvents = 'none';
            // Reset positioning
            userMenu.style.position = '';
            userMenu.style.top = '';
            userMenu.style.left = '';
            userMenu.style.right = '';
            userMenu.style.bottom = '';
            userMenu.style.maxWidth = '';
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
    });
  }, 50);
  
  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      SuperAffiliateAPI.logout();
    });
  }

  // Check seller/affiliate status and add appropriate links
  (async function() {
    const sellerAffiliatePlaceholder = document.getElementById('sellerAffiliateMenuPlaceholder');
    if (!sellerAffiliatePlaceholder) return;

    let isSeller = false;
    let isAffiliate = false;

    try {
      // Check seller status
      try {
        const sellerProfile = await SuperAffiliateAPI.apiRequest('/commerce/seller/profile/');
        if (sellerProfile && sellerProfile.id) {
          isSeller = true;
          const sellerDashboardLink = document.createElement('a');
          sellerDashboardLink.href = 'seller-dashboard.html';
          sellerDashboardLink.className = 'user-menu-item';
          sellerDashboardLink.innerHTML = '<i class="fas fa-store"></i><span>Seller Dashboard</span>';
          sellerAffiliatePlaceholder.parentNode.insertBefore(sellerDashboardLink, sellerAffiliatePlaceholder);
        }
      } catch (e) {
        // Not a seller - 404 is expected for non-sellers, don't log as error
        // Only log if it's not a 404 or "not found" error
        const errorMsg = e.message || '';
        const isExpectedError = errorMsg.includes('404') || 
                               errorMsg.includes('not found') || 
                               errorMsg.includes('Seller profile not found');
        if (!isExpectedError) {
          console.warn('Error checking seller status:', e);
        }
      }

      // Check affiliate status
      try {
        const affiliateProfile = await SuperAffiliateAPI.apiRequest('/commerce/affiliate/profile/');
        if (affiliateProfile && affiliateProfile.id) {
          isAffiliate = true;
          const affiliateDashboardLink = document.createElement('a');
          affiliateDashboardLink.href = 'affiliate-dashboard.html';
          affiliateDashboardLink.className = 'user-menu-item';
          affiliateDashboardLink.innerHTML = '<i class="fas fa-user-tie"></i><span>Affiliate Dashboard</span>';
          sellerAffiliatePlaceholder.parentNode.insertBefore(affiliateDashboardLink, sellerAffiliatePlaceholder);
        }
        // If affiliateProfile is null, it's an expected 404 (user is not an affiliate)
      } catch (e) {
        // Only log unexpected errors (apiRequest should return null for 404s, not throw)
        console.warn('Unexpected error checking affiliate status:', e);
      }

      // Only show "Become" links if user is NOT already registered
      if (!isSeller && !isAffiliate) {
        const becomeSellerLink = document.createElement('a');
        becomeSellerLink.href = 'become-seller.html';
        becomeSellerLink.className = 'user-menu-item';
        becomeSellerLink.innerHTML = '<i class="fas fa-store"></i><span>Become a Seller</span>';
        sellerAffiliatePlaceholder.parentNode.insertBefore(becomeSellerLink, sellerAffiliatePlaceholder);

        const becomeAffiliateLink = document.createElement('a');
        becomeAffiliateLink.href = 'become-affiliate.html';
        becomeAffiliateLink.className = 'user-menu-item';
        becomeAffiliateLink.innerHTML = '<i class="fas fa-user-tie"></i><span>Become an Affiliate</span>';
        sellerAffiliatePlaceholder.parentNode.insertBefore(becomeAffiliateLink, sellerAffiliatePlaceholder);
      } else {
        // If user is seller or affiliate, add quick action links
        if (isSeller) {
          const addProductLink = document.createElement('a');
          addProductLink.href = 'add-product.html';
          addProductLink.className = 'user-menu-item';
          addProductLink.innerHTML = '<i class="fas fa-plus-circle"></i><span>Add Product</span>';
          sellerAffiliatePlaceholder.parentNode.insertBefore(addProductLink, sellerAffiliatePlaceholder);
        }
        if (isAffiliate) {
          const promoteProductsLink = document.createElement('a');
          promoteProductsLink.href = 'promote-products.html';
          promoteProductsLink.className = 'user-menu-item';
          promoteProductsLink.innerHTML = '<i class="fas fa-tag"></i><span>Promote Products</span>';
          sellerAffiliatePlaceholder.parentNode.insertBefore(promoteProductsLink, sellerAffiliatePlaceholder);
        }
      }

      // Remove placeholder
      sellerAffiliatePlaceholder.remove();
    } catch (e) {
      // On error, show "Become" links as fallback
      if (!isSeller && !isAffiliate) {
        const becomeSellerLink = document.createElement('a');
        becomeSellerLink.href = 'become-seller.html';
        becomeSellerLink.className = 'user-menu-item';
        becomeSellerLink.innerHTML = '<i class="fas fa-store"></i><span>Become a Seller</span>';
        sellerAffiliatePlaceholder.parentNode.insertBefore(becomeSellerLink, sellerAffiliatePlaceholder);

        const becomeAffiliateLink = document.createElement('a');
        becomeAffiliateLink.href = 'become-affiliate.html';
        becomeAffiliateLink.className = 'user-menu-item';
        becomeAffiliateLink.innerHTML = '<i class="fas fa-user-tie"></i><span>Become an Affiliate</span>';
        sellerAffiliatePlaceholder.parentNode.insertBefore(becomeAffiliateLink, sellerAffiliatePlaceholder);
      }
      sellerAffiliatePlaceholder.remove();
    }
  })();

  // Check Super Affiliate status and add Dashboard link if applicable
  SuperAffiliateAPI.getMyStatus().then(status => {
    const placeholder = document.getElementById('dashboardMenuPlaceholder');
    if (placeholder && status && (status.status === 'active' || status.status === 'invited')) {
      placeholder.outerHTML = `
        <a href="super-affiliate-dashboard.html" class="user-menu-item user-menu-item-highlight">
          <i class="fas fa-tachometer-alt"></i>
          <span>Super Affiliate Dashboard</span>
        </a>
      `;
    } else if (placeholder) {
      placeholder.remove();
    }
  }).catch(() => {
    const placeholder = document.getElementById('dashboardMenuPlaceholder');
    if (placeholder) {
      placeholder.remove();
    }
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
};

// Add helper functions
window.showToast = function(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: ${type === 'success' ? '#00f2ea' : '#ff0050'};
    color: white;
    padding: 1rem 2rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    z-index: 9999;
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
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    position: relative; /* Ensure dropdown can escape overflow */
  }
  .tanda-nav-container::-webkit-scrollbar { display: none; }
  
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


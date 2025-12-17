/**
 * Tanda Super Affiliate API Helper
 * Handles all API calls to Django backend
 * 
 * Author: Tanda Team
 * Version: 1.0.0
 */

// ⚠️ UPDATE THIS URL TO YOUR ACTUAL BACKEND API URL
const API_BASE_URL = 'http://127.0.0.1:8000/api';  // CHANGE THIS IN PRODUCTION!

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
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401) {
        // Try to refresh token
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the request with new token
          headers['Authorization'] = `Bearer ${this.getToken()}`;
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
          });
          
          if (!retryResponse.ok) {
            throw new Error('Request failed after token refresh');
          }
          
          return await retryResponse.json();
        } else {
          // Refresh failed, redirect to login
          this.clearTokens();
          window.location.href = 'super-affiliate-login.html';
          throw new Error('Session expired. Please login again.');
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.detail || error.message || 'API request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
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
      const response = await fetch(`${API_BASE_URL}/users/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (data.access) {
        this.setToken(data.access);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  /**
   * Login user and get JWT token
   */
  static async login(email, password) {
    const response = await this.apiRequest('/users/token/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.access) {
      this.setToken(response.access);
      if (response.refresh) {
        this.setRefreshToken(response.refresh);
      }
    }

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
  static async acceptInvitation(token) {
    return await this.apiRequest('/users/super-affiliate-invitations/accept/', {
      method: 'POST',
      body: JSON.stringify({ 
        token,
        agreement_version: '1.0'
      }),
    });
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
      const status = await this.getMyStatus();
      return {
        affiliateCode: status.affiliate_code,
        totalReferrals: status.total_referrals || 0,
        totalEarned: status.total_earned || '0.00',
        totalPaid: status.total_commissions_paid || '0.00',
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
}

// Make it globally available
window.SuperAffiliateAPI = SuperAffiliateAPI;

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
`;
document.head.appendChild(style);

console.log('✅ Tanda Super Affiliate API Helper loaded');


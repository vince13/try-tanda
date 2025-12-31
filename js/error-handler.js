/**
 * Global Error Handler for Tanda Webapp
 * Catches and handles JavaScript errors gracefully
 */

(function() {
  'use strict';

  // Check if we're in development
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.includes('127.0.0.1');

  /**
   * Safe logging function - only logs in development
   */
  function safeLog(...args) {
    if (isDevelopment) {
      console.log(...args);
    }
  }

  /**
   * Report error to tracking service (Sentry, LogRocket, etc.)
   */
  function reportError(error, context = {}) {
    // In production, send to error tracking service
    if (window.Sentry) {
      window.Sentry.withScope((scope) => {
        Object.keys(context).forEach(key => {
          scope.setContext(key, context[key]);
        });
        window.Sentry.captureException(error);
      });
    } else if (window.LogRocket) {
      window.LogRocket.captureException(error, {
        tags: context
      });
    }
    
    // Always log in development
    if (isDevelopment) {
      console.error('Error reported:', error, context);
    }
  }

  /**
   * Show user-friendly error message
   */
  function showUserError(message) {
    // Check if error container exists
    let errorContainer = document.getElementById('global-error-container');
    
    if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.id = 'global-error-container';
      errorContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      `;
      document.body.appendChild(errorContainer);
    }
    
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorContainer.style.display = 'none';
    }, 5000);
  }

  /**
   * Handle uncaught JavaScript errors
   */
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message);
    const context = {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // Report to error tracking
    reportError(error, {
      type: 'uncaught_error',
      ...context
    });

    // Show user-friendly message
    showUserError('An unexpected error occurred. Please refresh the page or contact support if the problem persists.');

    // Prevent default browser error handling in production
    if (!isDevelopment) {
      event.preventDefault();
    }
  });

  /**
   * Handle unhandled promise rejections
   */
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    const context = {
      type: 'unhandled_promise_rejection',
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // Report to error tracking
    reportError(error, context);

    // Show user-friendly message for network errors
    if (error.message && error.message.includes('fetch')) {
      showUserError('Network error. Please check your connection and try again.');
    } else {
      showUserError('An error occurred. Please try again.');
    }

    // Prevent default browser error handling in production
    if (!isDevelopment) {
      event.preventDefault();
    }
  });

  /**
   * API Error Handler Wrapper
   * Wraps API calls to catch and handle errors gracefully
   */
  window.handleApiError = function(error, userMessage = null) {
    const context = {
      type: 'api_error',
      url: window.location.href,
      endpoint: error.endpoint || 'unknown'
    };

    // Report to error tracking
    reportError(error, context);

    // Show user-friendly message
    if (userMessage) {
      showUserError(userMessage);
    } else if (error.message) {
      // Extract user-friendly message from error
      let message = error.message;
      
      if (message.includes('401') || message.includes('Unauthorized')) {
        message = 'Your session has expired. Please log in again.';
      } else if (message.includes('403') || message.includes('Forbidden')) {
        message = 'You do not have permission to perform this action.';
      } else if (message.includes('404') || message.includes('Not Found')) {
        message = 'The requested resource was not found.';
      } else if (message.includes('500') || message.includes('Internal Server Error')) {
        message = 'A server error occurred. Please try again later.';
      } else if (message.includes('Network') || message.includes('fetch')) {
        message = 'Network error. Please check your connection.';
      } else {
        message = 'An error occurred. Please try again.';
      }
      
      showUserError(message);
    }
  };

  /**
   * Safe API Request Wrapper
   * Wraps fetch calls with error handling
   */
  window.safeApiRequest = async function(url, options = {}) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const error = new Error(`API request failed: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.endpoint = url;
        throw error;
      }
      
      return await response.json();
    } catch (error) {
      window.handleApiError(error);
      throw error; // Re-throw for caller to handle if needed
    }
  };

  // Log initialization (only in development)
  safeLog('✅ Global Error Handler loaded');

})();


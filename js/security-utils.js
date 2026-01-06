/**
 * Security Utilities for Tanda Web App
 * Provides input sanitization, XSS protection, and validation
 */

(function() {
  'use strict';

  /**
   * Input Sanitizer - Prevents XSS attacks
   */
  const SecurityUtils = {
    /**
     * Sanitize text input to prevent XSS
     * @param {string} text - Text to sanitize
     * @param {boolean} allowHTML - Whether to allow HTML (default: false)
     * @returns {string} - Sanitized text
     */
    sanitizeText(text, allowHTML = false) {
      if (!text || typeof text !== 'string') {
        return '';
      }

      // If HTML is not allowed, escape all HTML
      if (!allowHTML) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      // If HTML is allowed, remove dangerous patterns
      let sanitized = text;
      
      // Remove script tags and event handlers
      const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi, // onclick, onerror, etc.
        /data:text\/html/gi,
        /vbscript:/gi,
      ];

      dangerousPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
      });

      return sanitized;
    },

    /**
     * Sanitize HTML content (for trusted content only)
     * @param {string} html - HTML to sanitize
     * @returns {string} - Sanitized HTML
     */
    sanitizeHTML(html) {
      if (!html || typeof html !== 'string') {
        return '';
      }

      // Create a temporary element
      const temp = document.createElement('div');
      temp.innerHTML = html;

      // Remove script tags and event handlers
      const scripts = temp.querySelectorAll('script');
      scripts.forEach(script => script.remove());

      // Remove event handlers from all elements
      const allElements = temp.querySelectorAll('*');
      allElements.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('on')) {
            el.removeAttribute(attr.name);
          }
          if (attr.name === 'href' && attr.value.startsWith('javascript:')) {
            el.removeAttribute('href');
          }
        });
      });

      return temp.innerHTML;
    },

    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} - True if valid
     */
    validateEmail(email) {
      if (!email || typeof email !== 'string') {
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email.trim());
    },

    /**
     * Validate URL
     * @param {string} url - URL to validate
     * @returns {boolean} - True if valid
     */
    validateURL(url) {
      if (!url || typeof url !== 'string') {
        return false;
      }
      try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
      } catch (e) {
        return false;
      }
    },

    /**
     * Validate numeric input
     * @param {string|number} value - Value to validate
     * @param {object} options - Validation options
     * @returns {boolean} - True if valid
     */
    validateNumber(value, options = {}) {
      const { min, max, integer = false } = options;
      
      if (value === null || value === undefined || value === '') {
        return false;
      }

      const num = Number(value);
      if (isNaN(num)) {
        return false;
      }

      if (integer && !Number.isInteger(num)) {
        return false;
      }

      if (min !== undefined && num < min) {
        return false;
      }

      if (max !== undefined && num > max) {
        return false;
      }

      return true;
    },

    /**
     * Validate text length
     * @param {string} text - Text to validate
     * @param {object} options - Validation options
     * @returns {boolean} - True if valid
     */
    validateLength(text, options = {}) {
      const { min = 0, max = Infinity } = options;
      
      if (text === null || text === undefined) {
        return min === 0;
      }

      const length = String(text).length;
      return length >= min && length <= max;
    },

    /**
     * Safe set text content (prevents XSS)
     * @param {HTMLElement} element - Element to set text
     * @param {string} text - Text to set
     */
    setTextContent(element, text) {
      if (!element) return;
      element.textContent = this.sanitizeText(text, false);
    },

    /**
     * Safe set innerHTML (with sanitization)
     * @param {HTMLElement} element - Element to set HTML
     * @param {string} html - HTML to set
     * @param {boolean} trusted - Whether content is trusted (default: false)
     */
    setInnerHTML(element, html, trusted = false) {
      if (!element) return;
      
      if (trusted) {
        element.innerHTML = this.sanitizeHTML(html);
      } else {
        // For untrusted content, use textContent instead
        this.setTextContent(element, html);
      }
    },

    /**
     * Validate form input
     * @param {HTMLElement} input - Input element
     * @param {object} rules - Validation rules
     * @returns {object} - { valid: boolean, error: string }
     */
    validateInput(input, rules = {}) {
      if (!input) {
        return { valid: false, error: 'Input element not found' };
      }

      const value = input.value;
      const type = input.type || 'text';
      const errors = [];

      // Required check
      if (rules.required && (!value || value.trim() === '')) {
        errors.push('This field is required');
      }

      if (value) {
        // Email validation
        if (type === 'email' || rules.email) {
          if (!this.validateEmail(value)) {
            errors.push('Please enter a valid email address');
          }
        }

        // URL validation
        if (type === 'url' || rules.url) {
          if (!this.validateURL(value)) {
            errors.push('Please enter a valid URL');
          }
        }

        // Number validation
        if (type === 'number' || rules.number) {
          if (!this.validateNumber(value, rules.numberOptions)) {
            errors.push('Please enter a valid number');
          }
        }

        // Length validation
        if (rules.length) {
          if (!this.validateLength(value, rules.length)) {
            const { min, max } = rules.length;
            if (min && max) {
              errors.push(`Please enter between ${min} and ${max} characters`);
            } else if (min) {
              errors.push(`Please enter at least ${min} characters`);
            } else if (max) {
              errors.push(`Please enter no more than ${max} characters`);
            }
          }
        }

        // Pattern validation
        if (rules.pattern) {
          const regex = new RegExp(rules.pattern);
          if (!regex.test(value)) {
            errors.push(rules.patternError || 'Invalid format');
          }
        }
      }

      return {
        valid: errors.length === 0,
        error: errors[0] || null
      };
    }
  };

  // Export to global scope
  window.SecurityUtils = SecurityUtils;

  // Log initialization (only in development)
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
  if (isDevelopment) {
    console.log('✅ Security Utils loaded');
  }
})();


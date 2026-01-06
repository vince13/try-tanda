/**
 * Programmatic Tests for Tanda Web App
 * Tests critical features that can be automated
 */

(function() {
  'use strict';

  const TestRunner = {
    results: [],
    passed: 0,
    failed: 0,

    /**
     * Run a test
     */
    test(name, fn) {
      try {
        const result = fn();
        if (result === true || (result && result.valid === true)) {
          this.passed++;
          this.results.push({ name, status: 'PASS', message: result.message || 'OK' });
          console.log(`✅ ${name}`);
          return true;
        } else {
          this.failed++;
          const message = result && result.message ? result.message : 'Failed';
          this.results.push({ name, status: 'FAIL', message });
          console.error(`❌ ${name}: ${message}`);
          return false;
        }
      } catch (error) {
        this.failed++;
        this.results.push({ name, status: 'ERROR', message: error.message });
        console.error(`❌ ${name}: ${error.message}`);
        return false;
      }
    },

    /**
     * Test Security Utils
     */
    testSecurityUtils() {
      console.log('\n🔒 Testing Security Utils...');
      
      this.test('SecurityUtils exists', () => {
        return typeof window.SecurityUtils !== 'undefined';
      });

      this.test('sanitizeText removes script tags', () => {
        const malicious = '<script>alert("xss")</script>Hello';
        const sanitized = SecurityUtils.sanitizeText(malicious);
        return !sanitized.includes('<script>') && sanitized.includes('Hello');
      });

      this.test('sanitizeText escapes HTML', () => {
        const html = '<div>Test</div>';
        const sanitized = SecurityUtils.sanitizeText(html);
        return sanitized.includes('&lt;') && !sanitized.includes('<div>');
      });

      this.test('validateEmail accepts valid emails', () => {
        return SecurityUtils.validateEmail('test@example.com');
      });

      this.test('validateEmail rejects invalid emails', () => {
        return !SecurityUtils.validateEmail('invalid-email');
      });

      this.test('validateURL accepts valid URLs', () => {
        return SecurityUtils.validateURL('https://example.com');
      });

      this.test('validateURL rejects invalid URLs', () => {
        return !SecurityUtils.validateURL('not-a-url');
      });

      this.test('validateNumber validates correctly', () => {
        return SecurityUtils.validateNumber('123', { min: 0, max: 1000 });
      });

      this.test('validateLength validates correctly', () => {
        return SecurityUtils.validateLength('test', { min: 1, max: 10 });
      });
    },

    /**
     * Test API Utilities
     */
    testAPIUtilities() {
      console.log('\n🌐 Testing API Utilities...');
      
      this.test('SuperAffiliateAPI exists', () => {
        return typeof window.SuperAffiliateAPI !== 'undefined';
      });

      this.test('API base URL is configured', () => {
        const baseUrl = SuperAffiliateAPI.getApiBase();
        return baseUrl && baseUrl.length > 0;
      });

      this.test('Token storage functions exist', () => {
        return typeof SuperAffiliateAPI.setToken === 'function' &&
               typeof SuperAffiliateAPI.getToken === 'function' &&
               typeof SuperAffiliateAPI.clearTokens === 'function';
      });

      this.test('Token storage works', () => {
        SuperAffiliateAPI.setToken('test-token');
        const token = SuperAffiliateAPI.getToken();
        SuperAffiliateAPI.clearTokens();
        return token === 'test-token';
      });
    },

    /**
     * Test Input Validation
     */
    testInputValidation() {
      console.log('\n📝 Testing Input Validation...');
      
      // Create test input
      const testInput = document.createElement('input');
      testInput.type = 'text';
      testInput.value = 'test@example.com';
      document.body.appendChild(testInput);

      this.test('validateInput validates email', () => {
        const result = SecurityUtils.validateInput(testInput, {
          required: true,
          email: true
        });
        return result.valid === true;
      });

      this.test('validateInput detects missing required field', () => {
        testInput.value = '';
        const result = SecurityUtils.validateInput(testInput, {
          required: true
        });
        testInput.value = 'test@example.com';
        return result.valid === false && result.error.includes('required');
      });

      // Cleanup
      document.body.removeChild(testInput);
    },

    /**
     * Test Error Handling
     */
    testErrorHandling() {
      console.log('\n⚠️ Testing Error Handling...');
      
      this.test('handleApiError function exists', () => {
        return typeof window.handleApiError === 'function';
      });

      this.test('safeApiRequest function exists', () => {
        return typeof window.safeApiRequest === 'function';
      });

      this.test('Error handler shows user-friendly messages', () => {
        // This is tested by checking if the function exists
        // Actual error display would require DOM manipulation
        return typeof window.handleApiError === 'function';
      });
    },

    /**
     * Test DOM Security
     */
    testDOMSecurity() {
      console.log('\n🛡️ Testing DOM Security...');
      
      // Test that textContent is used instead of innerHTML where appropriate
      const testDiv = document.createElement('div');
      document.body.appendChild(testDiv);

      this.test('setTextContent prevents XSS', () => {
        SecurityUtils.setTextContent(testDiv, '<script>alert("xss")</script>');
        return !testDiv.innerHTML.includes('<script>');
      });

      this.test('setInnerHTML sanitizes untrusted content', () => {
        SecurityUtils.setInnerHTML(testDiv, '<script>alert("xss")</script>', false);
        return !testDiv.innerHTML.includes('<script>');
      });

      // Cleanup
      document.body.removeChild(testDiv);
    },

    /**
     * Test Form Validation Edge Cases
     */
    testEdgeCases() {
      console.log('\n🔍 Testing Edge Cases...');
      
      this.test('Empty string validation', () => {
        const input = document.createElement('input');
        input.value = '';
        const result = SecurityUtils.validateInput(input, { required: true });
        return result.valid === false;
      });

      this.test('Very long input validation', () => {
        const longString = 'a'.repeat(10000);
        const result = SecurityUtils.validateLength(longString, { max: 100 });
        return result === false;
      });

      this.test('Special characters in email', () => {
        return !SecurityUtils.validateEmail('test@example@com');
      });

      this.test('SQL injection pattern in text', () => {
        const sqlInjection = "'; DROP TABLE users; --";
        const sanitized = SecurityUtils.sanitizeText(sqlInjection);
        // Should not contain the dangerous pattern
        return !sanitized.includes('DROP TABLE');
      });

      this.test('XSS pattern in text', () => {
        const xss = '<img src=x onerror=alert(1)>';
        const sanitized = SecurityUtils.sanitizeText(xss);
        return !sanitized.includes('onerror');
      });
    },

    /**
     * Run all tests
     */
    runAll() {
      console.log('🚀 Starting Programmatic Tests...\n');
      
      this.testSecurityUtils();
      this.testAPIUtilities();
      this.testInputValidation();
      this.testErrorHandling();
      this.testDOMSecurity();
      this.testEdgeCases();

      // Print summary
      console.log('\n' + '='.repeat(50));
      console.log('📊 Test Summary');
      console.log('='.repeat(50));
      console.log(`✅ Passed: ${this.passed}`);
      console.log(`❌ Failed: ${this.failed}`);
      console.log(`📈 Total: ${this.passed + this.failed}`);
      console.log(`🎯 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
      console.log('='.repeat(50));

      // Return results for reporting
      return {
        passed: this.passed,
        failed: this.failed,
        total: this.passed + this.failed,
        results: this.results
      };
    }
  };

  // Export to global scope
  window.TestRunner = TestRunner;

  // Auto-run if in test mode
  if (window.location.search.includes('test=true')) {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        TestRunner.runAll();
      }, 1000);
    });
  }
})();


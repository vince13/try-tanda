/**
 * Node.js Test Runner for Tanda Web App
 * Can be run with: node tests/test-runner-node.js
 * 
 * Note: This is a simplified version. Full tests require browser environment.
 * Use tests/run-tests.html in a browser for complete testing.
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Tanda Web App - Programmatic Test Runner\n');
console.log('='.repeat(50));

// Test 1: Check if security-utils.js exists
console.log('\n📁 File Existence Tests:');
const securityUtilsPath = path.join(__dirname, '../js/security-utils.js');
if (fs.existsSync(securityUtilsPath)) {
  console.log('✅ security-utils.js exists');
} else {
  console.log('❌ security-utils.js not found');
}

// Test 2: Check if security-utils.js has required functions
console.log('\n🔒 Security Utils Function Tests:');
const securityUtilsContent = fs.readFileSync(securityUtilsPath, 'utf8');
const requiredFunctions = [
  'sanitizeText',
  'sanitizeHTML',
  'validateEmail',
  'validateURL',
  'validateNumber',
  'validateLength',
  'setTextContent',
  'setInnerHTML',
  'validateInput'
];

requiredFunctions.forEach(func => {
  if (securityUtilsContent.includes(`${func}(`)) {
    console.log(`✅ ${func} function exists`);
  } else {
    console.log(`❌ ${func} function not found`);
  }
});

// Test 3: Check if programmatic-tests.js exists
console.log('\n📝 Test Script Tests:');
const testScriptPath = path.join(__dirname, 'programmatic-tests.js');
if (fs.existsSync(testScriptPath)) {
  console.log('✅ programmatic-tests.js exists');
} else {
  console.log('❌ programmatic-tests.js not found');
}

// Test 4: Check if test HTML page exists
console.log('\n🌐 Test Page Tests:');
const testPagePath = path.join(__dirname, 'run-tests.html');
if (fs.existsSync(testPagePath)) {
  console.log('✅ run-tests.html exists');
} else {
  console.log('❌ run-tests.html not found');
}

// Test 5: Check critical pages for security-utils inclusion
console.log('\n📄 Page Security Utils Inclusion:');
const criticalPages = [
  '../index.html',
  '../tag-products.html',
  '../subscription.html'
];

criticalPages.forEach(page => {
  const pagePath = path.join(__dirname, page);
  if (fs.existsSync(pagePath)) {
    const content = fs.readFileSync(pagePath, 'utf8');
    if (content.includes('security-utils.js')) {
      console.log(`✅ ${page} includes security-utils.js`);
    } else {
      console.log(`⚠️  ${page} does not include security-utils.js`);
    }
  }
});

// Test 6: Check for unsafe innerHTML patterns
console.log('\n🛡️  XSS Protection Checks:');
const htmlFiles = [
  '../tag-products.html',
  '../subscription.html'
];

htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Check for innerHTML with user data patterns
    const unsafePatterns = [
      /innerHTML\s*=\s*[`'"][^`'"]*\$\{/g,
      /innerHTML\s*=\s*[`'"][^`'"]*\+.*user/gi,
      /innerHTML\s*=\s*[`'"][^`'"]*\+.*input/gi
    ];
    
    let hasUnsafePattern = false;
    unsafePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        hasUnsafePattern = true;
      }
    });
    
    if (hasUnsafePattern) {
      console.log(`⚠️  ${file} may have unsafe innerHTML usage (review needed)`);
    } else {
      console.log(`✅ ${file} appears safe from obvious XSS patterns`);
    }
  }
});

console.log('\n' + '='.repeat(50));
console.log('\n📊 Summary:');
console.log('✅ Basic file structure checks completed');
console.log('⚠️  Full functionality tests require browser environment');
console.log('💡 Run tests/run-tests.html in a browser for complete testing');
console.log('\n' + '='.repeat(50));


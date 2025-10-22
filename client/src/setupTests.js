// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom

import '@testing-library/jest-dom';
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
// Silence Mongoose jsdom warning
process.env.SUPPRESS_JEST_WARNINGS = 'true';

// Fake Braintree creds so productController can construct the gateway
process.env.BRAINTREE_MERCHANT_ID = 'test-merchant';
process.env.BRAINTREE_PUBLIC_KEY  = 'test-public';
process.env.BRAINTREE_PRIVATE_KEY = 'test-private';

// Suppress CSS selector errors from Ant Design 5.x that are incompatible with jsdom's nwsapi
// This is a known issue: https://github.com/jsdom/jsdom/issues/3634
// Wrap getComputedStyle to catch and suppress selector errors
if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function(element, pseudoElt) {
    try {
      return originalGetComputedStyle.call(this, element, pseudoElt);
    } catch (error) {
      if (error.message && error.message.includes('is not a valid selector')) {
        // Return a mock CSSStyleDeclaration for invalid selectors
        return {
          getPropertyValue: () => '',
          pointerEvents: 'auto',
        };
      }
      throw error;
    }
  };
}
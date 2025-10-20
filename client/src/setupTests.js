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
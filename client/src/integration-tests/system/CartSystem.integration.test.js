import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

// Real components
import HomePage from '../../pages/HomePage';
import ProductDetails from '../../pages/ProductDetails';
import CartPage from '../../pages/CartPage';
import Login from '../../pages/Auth/Login';

// Real providers
import { AuthProvider } from '../../context/auth';
import { SearchProvider } from '../../context/search';
import { CartProvider } from '../../context/cart';

// Mock external dependencies
jest.mock('../../components/Layout', () => {
  const React = require('react');
  const { Link } = require('react-router-dom');
  const { useAuth } = require('../../context/auth');
  const { useCart } = require('../../context/cart');

  return {
    __esModule: true,
    default: ({ children }) => {
      const [auth] = useAuth();
      const { cart } = useCart();

      return (
        <div data-testid="mock-layout">
          <nav data-testid="mock-header">
            <Link to="/">Home</Link>
            {!auth?.user ? (
              <>
                <Link to="/register">Register</Link>
                <Link to="/login">Login</Link>
              </>
            ) : (
              <div>
                <span>{auth.user.name}</span>
                <Link to="/dashboard/user/profile">Profile</Link>
                <Link to="/dashboard/user/orders">Orders</Link>
              </div>
            )}
            <Link to="/cart">Cart ({Object.keys(cart || {}).length})</Link>
          </nav>
          {children}
        </div>
      );
    }
  };
});

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('braintree-web-drop-in-react', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ options, onInstance }) => {
      React.useEffect(() => {
        const mockInstance = {
          requestPaymentMethod: jest.fn().mockResolvedValue({
            nonce: 'fake-payment-nonce-123'
          })
        };
        onInstance(mockInstance);
      }, [onInstance]);
      return React.createElement('div', { 'data-testid': 'braintree-dropin-mock' }, 'Payment UI');
    }
  };
});

// Mock data structures (complete - Anti-Pattern #4 compliant)
const mockProducts = {
  'iphone-14': {
    _id: 'prod-iphone-123',
    slug: 'iphone-14',
    name: 'iPhone 14',
    description: 'Latest iPhone with advanced features',
    price: 999,
    quantity: 50,
    category: {
      _id: 'cat-electronics-001',
      name: 'Electronics',
      slug: 'electronics'
    },
    shipping: true,
    photo: {
      data: Buffer.from([]),
      contentType: 'image/jpeg'
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z'
  },
  'macbook-pro': {
    _id: 'prod-macbook-456',
    slug: 'macbook-pro',
    name: 'MacBook Pro',
    description: 'Powerful laptop for professionals',
    price: 2499,
    quantity: 30,
    category: {
      _id: 'cat-computers-002',
      name: 'Computers',
      slug: 'computers'
    },
    shipping: true,
    photo: {
      data: Buffer.from([]),
      contentType: 'image/jpeg'
    },
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-20T00:00:00.000Z'
  }
};

const mockLoginResponse = {
  success: true,
  message: 'Login successfully',
  user: {
    _id: 'user123',
    name: 'John Doe',
    email: 'john@test.com',
    phone: '91234567',
    address: '123 Main Street, Singapore 123456',
    role: 0,
    answer: 'security-answer',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z'
  },
  token: 'jwt-test-token-abc123'
};

const mockBraintreeToken = {
  success: true,
  clientToken: 'sandbox_test_token_abc123xyz'
};

const mockPaymentSuccess = {
  success: true,
  message: 'Payment completed successfully',
  orderId: 'order-789xyz'
};

// Provider wrapper
const Providers = ({ children }) => (
  <AuthProvider>
    <SearchProvider>
      <CartProvider>
        {children}
      </CartProvider>
    </SearchProvider>
  </AuthProvider>
);

// Router configuration
const AppRoutes = () => (
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/product/:slug" element={<ProductDetails />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard/user/profile" element={<div data-testid="profile-page">Profile</div>} />
      <Route path="/dashboard/user/orders" element={<div data-testid="orders-page">Orders</div>} />
    </Routes>
  </MemoryRouter>
);

// Render helper
const renderApp = () => {
  return render(
    <Providers>
      <AppRoutes />
    </Providers>
  );
};

// Test suite setup
describe('CartSystem Integration Tests', () => {
  let mockAxios;

  beforeAll(() => {
    mockAxios = new MockAdapter(axios);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockAxios.reset();

    // Setup API mocks for HomePage
    mockAxios.onGet('/api/v1/category/get-category').reply(200, {
      success: true,
      category: []
    });

    mockAxios.onGet('/api/v1/product/product-count').reply(200, {
      success: true,
      total: 2
    });

    mockAxios.onGet(/\/api\/v1\/product\/product-list\//).reply(200, {
      success: true,
      products: [mockProducts['iphone-14'], mockProducts['macbook-pro']]
    });

    mockAxios.onGet(/\/api\/v1\/product\/get-product\//).reply((config) => {
      const slug = config.url.split('/').pop();
      return [200, { product: mockProducts[slug] }];
    });

    mockAxios.onPost('/api/v1/auth/login').reply(200, mockLoginResponse);

    mockAxios.onGet('/api/v1/product/braintree/token').reply(200, mockBraintreeToken);
    mockAxios.onPost('/api/v1/product/braintree/payment').reply(200, mockPaymentSuccess);

    mockAxios.onGet(/\/api\/v1\/product\/related-product\//).reply(200, {
      success: true,
      products: []
    });

    mockAxios.onGet(/\/api\/v1\/product\/product-photo\//).reply(200);
  });

  afterAll(() => {
    mockAxios.restore();
  });

  describe('Guest to Authenticated Flow', () => {
    it('Guest user adds items, logs in, and completes checkout', async () => {
      // Step 1: Start on HomePage (guest user)
      renderApp();

      // Wait for HomePage to load
      await waitFor(() => {
        expect(screen.getByText(/iPhone 14/i)).toBeInTheDocument();
      });

      // Step 2: Add item from HomePage
      const addToCartBtn = screen.getAllByRole('button', { name: /add to cart/i })[0];
      await userEvent.click(addToCartBtn);

      // Verify cart updated
      await waitFor(() => {
        const cartData = JSON.parse(localStorage.getItem('cart-guest'));
        expect(cartData['iphone-14']).toBeDefined();
        expect(cartData['iphone-14'].quantity).toBe(1);
        expect(cartData['iphone-14'].price).toBe(999);
      });

      // Step 3: Navigate to CartPage
      const cartLink = screen.getByRole('link', { name: /cart/i });
      await userEvent.click(cartLink);

      // Wait for CartPage to render
      await waitFor(() => {
        expect(screen.getByText(/cart summary/i)).toBeInTheDocument();
      });

      // Verify product appears
      expect(screen.getByText('iphone-14')).toBeInTheDocument();

      // Step 4: Navigate to Login page
      const loginLink = screen.getByRole('link', { name: /login/i });
      await userEvent.click(loginLink);

      // Wait for Login page to render
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
      });

      // Step 5: Submit login credentials
      const emailInput = screen.getByPlaceholderText(/enter your email/i);
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });

      await userEvent.type(emailInput, 'john@test.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(loginButton);

      // Wait for auth to update
      await waitFor(() => {
        const auth = JSON.parse(localStorage.getItem('auth'));
        expect(auth).toBeDefined();
        expect(auth.user.name).toBe('John Doe');
      }, { timeout: 5000 });

      // Verify guest cart still exists but user cart is now active (empty initially)
      // Note: Current implementation does NOT transfer guest cart to authenticated user
      // Guest cart stays in cart-guest, authenticated user starts with empty cart
      await waitFor(() => {
        const guestCart = JSON.parse(localStorage.getItem('cart-guest'));
        const userCart = JSON.parse(localStorage.getItem('cart-John Doe'));

        // Guest cart still has the item
        expect(guestCart['iphone-14']).toBeDefined();

        // User cart is empty (no automatic transfer)
        expect(userCart).toEqual({});
      }, { timeout: 5000 });

      // Add item to authenticated user's cart
      // Navigate back to home to add product as authenticated user
      const homeLink = screen.getByRole('link', { name: /home/i });
      await userEvent.click(homeLink);

      // Wait for HomePage to load
      await waitFor(() => {
        expect(screen.getByText(/iPhone 14/i)).toBeInTheDocument();
      });

      // Add item to cart as authenticated user
      const addToCartBtnAuth = screen.getAllByRole('button', { name: /add to cart/i })[0];
      await userEvent.click(addToCartBtnAuth);

      // Verify item added to authenticated user's cart
      await waitFor(() => {
        const userCart = JSON.parse(localStorage.getItem('cart-John Doe'));
        expect(userCart['iphone-14']).toBeDefined();
        expect(userCart['iphone-14'].quantity).toBe(1);
      });

      // Navigate to cart
      const cartLinkAfterLogin = screen.getByRole('link', { name: /cart/i });
      await userEvent.click(cartLinkAfterLogin);

      // Wait for CartPage with authenticated view
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('iphone-14')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Step 6: Complete checkout
      // Wait for Braintree to load
      await waitFor(() => {
        expect(screen.getByTestId('braintree-dropin-mock')).toBeInTheDocument();
      });

      // Click Make Payment button
      const paymentButton = screen.getByRole('button', { name: /make payment/i });
      await userEvent.click(paymentButton);

      // Wait for payment to complete and navigation to orders
      await waitFor(() => {
        expect(screen.getByTestId('orders-page')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify cart cleared
      const clearedCart = JSON.parse(localStorage.getItem('cart-John Doe'));
      expect(clearedCart).toEqual({});
    }, 30000); // 30 second timeout for complex journey
  });

  describe('Multi-Page Shopping Flow', () => {
    it('User adds items from both HomePage and ProductDetails page', async () => {
      // Step 1: Start on HomePage
      renderApp();

      // Wait for HomePage to load
      await waitFor(() => {
        expect(screen.getByText(/iPhone 14/i)).toBeInTheDocument();
      });

      // Step 2: Add first item from HomePage
      const addToCartButtons = screen.getAllByRole('button', { name: /add to cart/i });
      const iphoneAddBtn = addToCartButtons[0]; // Assuming iPhone is first
      await userEvent.click(iphoneAddBtn);

      // Verify first item added to cart
      await waitFor(() => {
        const cartData = JSON.parse(localStorage.getItem('cart-guest'));
        expect(cartData['iphone-14']).toBeDefined();
        expect(cartData['iphone-14'].quantity).toBe(1);
      });

      // Step 3: Navigate to ProductDetails page for MacBook Pro
      // Find "More Details" button for MacBook Pro (second product)
      const moreDetailsButtons = screen.getAllByRole('button', { name: /more details/i });
      const macbookDetailsBtn = moreDetailsButtons[1]; // MacBook is second product
      await userEvent.click(macbookDetailsBtn);

      // Wait for ProductDetails page to render
      await waitFor(() => {
        expect(screen.getByText(/powerful laptop for professionals/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify we're on ProductDetails page (text is part of "Name : MacBook Pro")
      expect(screen.getByText(/MacBook Pro/i)).toBeInTheDocument();
      expect(screen.getByText(/\$2,499/i)).toBeInTheDocument();

      // Step 4: Add second item from ProductDetails
      const addToCartFromDetails = screen.getByRole('button', { name: /add to cart/i });
      await userEvent.click(addToCartFromDetails);

      // Verify second item added to cart
      await waitFor(() => {
        const cartData = JSON.parse(localStorage.getItem('cart-guest'));
        expect(cartData['macbook-pro']).toBeDefined();
        expect(cartData['macbook-pro'].quantity).toBe(1);
        // First item still present
        expect(cartData['iphone-14']).toBeDefined();
      });

      // Step 5: Navigate to CartPage
      const cartLink = screen.getByRole('link', { name: /cart/i });
      await userEvent.click(cartLink);

      // Wait for CartPage to render
      await waitFor(() => {
        expect(screen.getByText(/cart summary/i)).toBeInTheDocument();
      });

      // Verify both items visible in cart (CartPage displays slugs)
      expect(screen.getByText(/iphone-14/i)).toBeInTheDocument();
      expect(screen.getByText(/macbook-pro/i)).toBeInTheDocument();

      // Verify total price calculation (999 + 2499 = 3498)
      expect(screen.getByText(/total.*\$3,498/i)).toBeInTheDocument();

      // Verify cart data in localStorage has both items
      const finalCart = JSON.parse(localStorage.getItem('cart-guest'));
      expect(Object.keys(finalCart)).toHaveLength(2);
      expect(finalCart['iphone-14']).toEqual({
        quantity: 1,
        price: 999,
        productId: 'prod-iphone-123'
      });
      expect(finalCart['macbook-pro']).toEqual({
        quantity: 1,
        price: 2499,
        productId: 'prod-macbook-456'
      });
    }, 20000); // 20 second timeout
  });
});

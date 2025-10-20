// CategoryProduct.integration.test.js
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import axios from 'axios';
jest.mock('axios');

import CategoryProduct from '../../pages/CategoryProduct';
import { AuthProvider } from '../../context/auth';
import { CartProvider } from '../../context/cart';
import { SearchProvider } from '../../context/search';

// ---------- fixtures ----------
const catElectronics = { _id: 'cat1', name: 'Electronics', slug: 'electronics' };
const products = [
  { _id: 'p1', name: 'Gaming Laptop', slug: 'gaming-laptop',
    description: 'High-performance gaming laptop with RGB keyboard and RTX graphics card', price: 1500 },
  { _id: 'p2', name: 'Wireless Mouse', slug: 'wireless-mouse',
    description: 'Ergonomic wireless mouse with customizable buttons and long battery life', price: 50 },
  { _id: 'p3', name: 'Mechanical Keyboard', slug: 'mechanical-keyboard',
    description: 'RGB mechanical keyboard with Cherry MX switches for gaming and typing', price: 120 },
];

// ---------- helpers ----------
const renderAt = (route = '/category/electronics', ui = <CategoryProduct />) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <SearchProvider>
          <CartProvider>
            <Routes>
              <Route path="/category/:slug" element={ui} />
              <Route path="/product/:slug" element={<div>Product Details Page</div>} />
            </Routes>
          </CartProvider>
        </SearchProvider>
      </AuthProvider>
    </MemoryRouter>
  );

// always stub Header’s categories fetch + allow per-test product response
const mockAxiosFor = (map) => {
  axios.get.mockImplementation((url) => {
    if (url.includes('/api/v1/category/get-category')) {
      return Promise.resolve({ data: { category: [] } });
    }
    const hit = map[url];
    if (hit) return Promise.resolve({ data: hit });
    return Promise.reject(new Error('Unexpected GET ' + url));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('CategoryProduct — integration (Router + Providers + axios boundary)', () => {
  it('renders category header and products from API', async () => {
    // Arrange
    mockAxiosFor({
      '/api/v1/product/product-category/electronics': { products, category: catElectronics },
    });

    // Act
    renderAt();

    // Assert
    await screen.findByText('Category - Electronics');
    expect(screen.getByText('3 result found')).toBeInTheDocument();
    expect(screen.getByText('Gaming Laptop')).toBeInTheDocument();
    expect(screen.getByAltText('Gaming Laptop'))
      .toHaveAttribute('src', '/api/v1/product/product-photo/p1');
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
  });

  it('uses slug from URL to call the endpoint', async () => {
    // Arrange
    mockAxiosFor({
      '/api/v1/product/product-category/electronics': { products, category: catElectronics },
    });

    // Act
    renderAt('/category/electronics');

    // Assert
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-category/electronics')
    );
  });

  it('makes a new request when slug changes', async () => {
    // Arrange
    mockAxiosFor({
      '/api/v1/product/product-category/electronics': {
        products,
        category: catElectronics,
      },
      '/api/v1/product/product-category/books': {
        products: [],
        category: { _id: 'cat2', name: 'Books', slug: 'books' },
      },
    });

    // Act
    const first = renderAt('/category/electronics');
    await screen.findByText('Category - Electronics');
    expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-category/electronics');

    first.unmount();
    renderAt('/category/books');

    // Assert
    await screen.findByText('Category - Books');
    expect(screen.getByText('0 result found')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-category/books');
  });

  it('navigates to product details when "More Details" is clicked', async () => {
    // Arrange
    mockAxiosFor({
      '/api/v1/product/product-category/electronics': { products, category: catElectronics },
    });

    // Act
    renderAt();

    // Assert
    await screen.findByText('Gaming Laptop');
    const card = screen.getByText('Gaming Laptop').closest('.card');
    await userEvent.click(within(card).getByRole('button', { name: /More Details/i }));
    await screen.findByText('Product Details Page');
  });

  it('shows empty state for category with no products', async () => {
    // Arrange
    mockAxiosFor({
      '/api/v1/product/product-category/electronics': { products: [], category: catElectronics },
    });

    // Act
    renderAt();

    // Assert
    await screen.findByText('Category - Electronics');
    expect(screen.getByText('0 result found')).toBeInTheDocument();
  });

  it('handles API failure gracefully', async () => {
    // Arrange
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/category/get-category')) {
        return Promise.resolve({ data: { category: [] } });
      }
      if (url === '/api/v1/product/product-category/electronics') {
        return Promise.reject(new Error('Network Error'));
      }
      return Promise.reject(new Error('Unexpected GET ' + url));
    });

    // Act
    renderAt();

    // Assert
    await screen.findByText(/Category -/);
    expect(screen.queryByText('Gaming Laptop')).not.toBeInTheDocument();
  });

  it('truncates description to 60 chars and appends ellipsis', async () => {
    // Arrange
    const long = { ...products[0], description: 'x'.repeat(61) };
    mockAxiosFor({
      '/api/v1/product/product-category/electronics': { products: [long], category: catElectronics },
    });

    // Act
    renderAt();

    // Assert
    const card = await screen.findByText('Gaming Laptop').then(n => n.closest('.card'));
    const text = within(card).getByText(/x+/).textContent;
    expect(text.endsWith('...')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(63);
  });

  it('does not crash with malformed product objects', async () => {
    // Arrange
    const malformed = [{ _id: 'x' }, { slug: 'y' }];
    mockAxiosFor({
      '/api/v1/product/product-category/electronics': { products: malformed, category: catElectronics },
    });

    // Act
    renderAt();

    // Assert
    await screen.findByText('Category - Electronics');
  });

  it('supports slugs with special characters in the route', async () => {
    // Arrange
    mockAxiosFor({
      '/api/v1/product/product-category/sports-outdoors': {
        products: [],
        category: { _id: 'cat4', name: 'Sports & Outdoors', slug: 'sports-outdoors' },
      },
    });

    // Act
    renderAt('/category/sports-outdoors');

    // Assert
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-category/sports-outdoors')
    );
    await screen.findByText('Category - Sports & Outdoors');
  });

  it('renders $0.00 when price is missing or zero', async () => {
    // Arrange
    mockAxiosFor({
      '/api/v1/product/product-category/electronics': {
        products: [{ ...products[0], price: undefined }, { ...products[1], price: 0 }],
        category: catElectronics,
      },
    });

    // Act
    renderAt();

    // Assert
    await screen.findByText('Category - Electronics');
    const zeros = screen.getAllByText('$0.00');
    expect(zeros).toHaveLength(2);
  });

  it.each([
    // Arrange table: price → expected formatted
    [0, '$0.00'],
    [50, '$50.00'],
    [999999.99, '$999,999.99'],
  ])('formats price %s as %s (combinatorial)', async (price, expected) => {
    // Arrange
    const one = [{ ...products[0], price }];
    mockAxiosFor({
      '/api/v1/product/product-category/electronics': { products: one, category: catElectronics },
    });

    // Act
    renderAt();

    // Assert
    await screen.findByText('Category - Electronics');
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

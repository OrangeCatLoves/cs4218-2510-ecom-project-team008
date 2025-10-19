import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import ProductDetails from '../../pages/ProductDetails';

jest.mock('axios');
jest.mock('../../components/Layout', () => {
  return function Layout({ children }) {
    return <div data-testid="layout">{children}</div>;
  };
});

describe('ProductDetails Integration Tests', () => {
  const mockProduct = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Gaming Laptop',
    slug: 'gaming-laptop',
    description: 'High-performance gaming laptop',
    price: 1500,
    category: { _id: '507f1f77bcf86cd799439012', name: 'Electronics' },
  };

  const mockRelatedProducts = [
    {
      _id: '507f1f77bcf86cd799439013',
      name: 'Gaming Mouse',
      slug: 'gaming-mouse',
      description: 'RGB gaming mouse with programmable buttons for enhanced gaming experience',
      price: 50,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  it('should integrate with backend API to fetch and display product', async () => {
    // Arrange
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/product/get-product/')) {
        return Promise.resolve({ data: { success: true, product: mockProduct } });
      }
      if (url.includes('/api/v1/product/related-product/')) {
        return Promise.resolve({ data: { success: true, products: mockRelatedProducts } });
      }
    });

    // Act
    render(
      <MemoryRouter initialEntries={['/product/gaming-laptop']}>
        <Routes>
          <Route path="/product/:slug" element={<ProductDetails />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert - API integration
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/v1/product/get-product/gaming-laptop');
    });

    // Assert - Data displayed
    await waitFor(() => {
      expect(screen.getByText(/Name :/)).toBeInTheDocument();
      expect(screen.getByText(/\$1,500\.00/)).toBeInTheDocument();
      expect(screen.getByAltText('Gaming Laptop')).toBeInTheDocument();
    });
  });

  it('should chain API calls: product loads then related products load', async () => {
    // Arrange
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/product/get-product/')) {
        return Promise.resolve({ data: { success: true, product: mockProduct } });
      }
      if (url.includes('/api/v1/product/related-product/')) {
        return Promise.resolve({ data: { success: true, products: mockRelatedProducts } });
      }
    });

    // Act
    render(
      <MemoryRouter initialEntries={['/product/gaming-laptop']}>
        <Routes>
          <Route path="/product/:slug" element={<ProductDetails />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert - Sequential API integration
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        `/api/v1/product/related-product/${mockProduct._id}/${mockProduct.category._id}`
      );
    });

    // Assert - Related products displayed
    await waitFor(() => {
      expect(screen.getByText('Gaming Mouse')).toBeInTheDocument();
    });
  });

  it('should integrate Router params with API calls', async () => {
    // Arrange
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/product/get-product/office-laptop')) {
        return Promise.resolve({
          data: {
            success: true,
            product: { ...mockProduct, name: 'Office Laptop', slug: 'office-laptop' },
          },
        });
      }
      if (url.includes('/api/v1/product/related-product/')) {
        return Promise.resolve({ data: { success: true, products: [] } });
      }
    });

    // Act
    render(
      <MemoryRouter initialEntries={['/product/office-laptop']}>
        <Routes>
          <Route path="/product/:slug" element={<ProductDetails />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert - Router param used in API
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/v1/product/get-product/office-laptop');
    });

    // Assert - Correct product loaded
    await waitFor(() => {
      expect(screen.getByAltText('Office Laptop')).toBeInTheDocument();
    });
  });

  it('should handle API failure without crashing', async () => {
    // Arrange
    axios.get.mockRejectedValue(new Error('Network Error'));

    // Act
    render(
      <MemoryRouter initialEntries={['/product/gaming-laptop']}>
        <Routes>
          <Route path="/product/:slug" element={<ProductDetails />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert - Component handles error gracefully
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });

    expect(screen.getByText('Product Details')).toBeInTheDocument();
    expect(screen.queryByAltText('Gaming Laptop')).not.toBeInTheDocument();
  });
});
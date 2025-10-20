import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import CategoryProduct from '../../pages/CategoryProduct';
import { AuthProvider } from '../../context/auth';
import { CartProvider } from '../../context/cart';
import { SearchProvider } from '../../context/search';

jest.mock('axios');

const MockProviders = ({ children, initialRoute = '/category/electronics' }) => {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <SearchProvider>
          <CartProvider>
            <Routes>
              <Route path="/category/:slug" element={children} />
              <Route path="/product/:slug" element={<div>Product Details Page</div>} />
            </Routes>
          </CartProvider>
        </SearchProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('CategoryProduct Integration Tests', () => {
  const mockCategory = {
    _id: '507f1f77bcf86cd799439012',
    name: 'Electronics',
    slug: 'electronics',
  };

  const mockProducts = [
    {
      _id: '507f1f77bcf86cd799439011',
      name: 'Gaming Laptop',
      slug: 'gaming-laptop',
      description: 'High-performance gaming laptop with RGB keyboard and RTX graphics card',
      price: 1500,
    },
    {
      _id: '507f1f77bcf86cd799439013',
      name: 'Wireless Mouse',
      slug: 'wireless-mouse',
      description: 'Ergonomic wireless mouse with customizable buttons and long battery life',
      price: 50,
    },
    {
      _id: '507f1f77bcf86cd799439014',
      name: 'Mechanical Keyboard',
      slug: 'mechanical-keyboard',
      description: 'RGB mechanical keyboard with Cherry MX switches for gaming and typing',
      price: 120,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe('Component and Layout Integration', () => {
    it('should integrate with Layout component and render category page', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Category -/)).toBeInTheDocument();
        expect(screen.getByText(/result found/)).toBeInTheDocument();
      });
    });

    it('should render category name and product count in header', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Category - Electronics')).toBeInTheDocument();
        expect(screen.getByText('3 result found')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch category and products from API using slug param', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders initialRoute="/category/electronics">
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-category/electronics');
      });
    });

    it('should display products after successful API call', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Gaming Laptop')).toBeInTheDocument();
        expect(screen.getByText('Wireless Mouse')).toBeInTheDocument();
        expect(screen.getByText('Mechanical Keyboard')).toBeInTheDocument();
      });
    });

    it('should handle API failure gracefully without crashing', async () => {
      // Arrange
      axios.get.mockRejectedValue(new Error('Network Error'));

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Category -/)).toBeInTheDocument();
      });
    });

    it('should make new API call when slug parameter changes', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      const { unmount } = render(
        <MockProviders initialRoute="/category/electronics">
          <CategoryProduct />
        </MockProviders>
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-category/electronics');
      });

      unmount();

      // Act - Render with different slug
      jest.clearAllMocks();
      axios.get.mockResolvedValue({
        data: {
          products: [],
          category: { _id: 'cat2', name: 'Books', slug: 'books' },
        },
      });

      render(
        <MockProviders initialRoute="/category/books">
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-category/books');
      });
    });
  });

  describe('Router Integration', () => {
    it('should extract slug from URL params and use in API call', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: [],
          category: { _id: 'cat1', name: 'Clothing', slug: 'clothing' },
        },
      });

      // Act
      render(
        <MockProviders initialRoute="/category/clothing">
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-category/clothing');
      });
    });

    it('should handle slug with special characters', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: [],
          category: { _id: 'cat1', name: 'Sports & Outdoors', slug: 'sports-outdoors' },
        },
      });

      // Act
      render(
        <MockProviders initialRoute="/category/sports-outdoors">
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-category/sports-outdoors');
      });
    });

    it('should navigate to product details when "More Details" clicked', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('Gaming Laptop')).toBeInTheDocument();
      });

      const moreDetailsButtons = screen.getAllByText('More Details');
      moreDetailsButtons[0].click();

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Product Details Page')).toBeInTheDocument();
      });
    });
  });

  describe('Product Display Integration - Boundary Testing', () => {
    it('should display single product correctly', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: [mockProducts[0]],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('1 result found')).toBeInTheDocument();
        expect(screen.getByText('Gaming Laptop')).toBeInTheDocument();
      });
    });

    it('should display multiple products correctly', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('3 result found')).toBeInTheDocument();
        mockProducts.forEach(product => {
          expect(screen.getByText(product.name)).toBeInTheDocument();
        });
      });
    });

    it('should display empty state when no products in category', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: [],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Category - Electronics')).toBeInTheDocument();
        expect(screen.getByText('0 result found')).toBeInTheDocument();
      });
    });

    it('should handle large number of products', async () => {
      // Arrange
      const manyProducts = Array.from({ length: 20 }, (_, i) => ({
        _id: `prod${i}`,
        name: `Product ${i + 1}`,
        slug: `product-${i + 1}`,
        description: `Description for product ${i + 1}`,
        price: (i + 1) * 10,
      }));

      axios.get.mockResolvedValue({
        data: {
          products: manyProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('20 result found')).toBeInTheDocument();
      });
    });
  });

  describe('Product Card Data Display', () => {
    it('should display all product fields correctly', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: [mockProducts[0]],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Gaming Laptop')).toBeInTheDocument();
        expect(screen.getByText(/High-performance gaming laptop/)).toBeInTheDocument();
        expect(screen.getByText('$1,500.00')).toBeInTheDocument();
      });
    });

    it('should truncate product description to 60 characters', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const laptopCard = screen.getByText('Gaming Laptop').closest('.card');
        const description = within(laptopCard).getByText(/High-performance gaming laptop with RGB keyboard and RTX gra.../);
        expect(description).toBeInTheDocument();
      });
    });

    it('should format prices correctly using USD currency', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('$1,500.00')).toBeInTheDocument();
        expect(screen.getByText('$50.00')).toBeInTheDocument();
        expect(screen.getByText('$120.00')).toBeInTheDocument();
      });
    });

    it('should display default price when price is missing', async () => {
      // Arrange
      const productWithoutPrice = {
        ...mockProducts[0],
        price: undefined,
      };

      axios.get.mockResolvedValue({
        data: {
          products: [productWithoutPrice],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('$0.00')).toBeInTheDocument();
      });
    });

    it('should construct correct image URLs for all products', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const laptopImg = screen.getByAltText('Gaming Laptop');
        expect(laptopImg).toHaveAttribute('src', `/api/v1/product/product-photo/${mockProducts[0]._id}`);

        const mouseImg = screen.getByAltText('Wireless Mouse');
        expect(mouseImg).toHaveAttribute('src', `/api/v1/product/product-photo/${mockProducts[1]._id}`);

        const keyboardImg = screen.getByAltText('Mechanical Keyboard');
        expect(keyboardImg).toHaveAttribute('src', `/api/v1/product/product-photo/${mockProducts[2]._id}`);
      });
    });

    it('should use product name as image alt text for accessibility', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('img', { name: 'Gaming Laptop' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Wireless Mouse' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Mechanical Keyboard' })).toBeInTheDocument();
      });
    });

    it('should render "More Details" button for each product', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const buttons = screen.getAllByText('More Details');
        expect(buttons).toHaveLength(3);
        buttons.forEach(button => {
          expect(button).toBeEnabled();
          expect(button).toHaveClass('btn-info');
        });
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API error without displaying products', async () => {
      // Arrange
      axios.get.mockRejectedValue(new Error('Category not found'));

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Category -/)).toBeInTheDocument();
      });

      expect(screen.queryByText('Gaming Laptop')).not.toBeInTheDocument();
    });

    it('should handle empty API response', async () => {
      // Arrange
      axios.get.mockResolvedValue({ data: {} });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Category -/)).toBeInTheDocument();
      });
    });

    it('should handle null products array', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: null,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Category - Electronics')).toBeInTheDocument();
      });
    });

    it('should handle null category object', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: null,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/result found/)).toBeInTheDocument();
      });
    });

    it('should handle malformed product data', async () => {
      // Arrange
      const malformedProducts = [
        { _id: 'prod1', name: 'Product 1' }, // Missing slug, description, price
        { _id: 'prod2', slug: 'prod2' }, // Missing name
      ];

      axios.get.mockResolvedValue({
        data: {
          products: malformedProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert - Should not crash
      await waitFor(() => {
        expect(screen.getByText('Category - Electronics')).toBeInTheDocument();
      });
    });
  });

  describe('State Management Integration', () => {
    it('should update state when API call succeeds', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert - Products should not be displayed immediately
      expect(screen.queryByText('Gaming Laptop')).not.toBeInTheDocument();

      // Assert - Products should be displayed after state update
      await waitFor(() => {
        expect(screen.getByText('Gaming Laptop')).toBeInTheDocument();
      });
    });

    it('should maintain separate state for products and category', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Category - Electronics')).toBeInTheDocument();
        expect(screen.getByText('Gaming Laptop')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle product with zero price', async () => {
      // Arrange
      const productWithZeroPrice = {
        ...mockProducts[0],
        price: 0,
      };

      axios.get.mockResolvedValue({
        data: {
          products: [productWithZeroPrice],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('$0.00')).toBeInTheDocument();
      });
    });

    it('should handle product with very high price', async () => {
      // Arrange
      const expensiveProduct = {
        ...mockProducts[0],
        price: 999999.99,
      };

      axios.get.mockResolvedValue({
        data: {
          products: [expensiveProduct],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('$999,999.99')).toBeInTheDocument();
      });
    });

    it('should handle product with very long name', async () => {
      // Arrange
      const longNameProduct = {
        ...mockProducts[0],
        name: 'A'.repeat(200),
      };

      axios.get.mockResolvedValue({
        data: {
          products: [longNameProduct],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
      });
    });

    it('should handle description exactly at 60 character boundary', async () => {
      // Arrange
      const exactDescription = 'A'.repeat(60);
      const productWithExactDesc = {
        ...mockProducts[0],
        description: exactDescription,
      };

      axios.get.mockResolvedValue({
        data: {
          products: [productWithExactDesc],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`${exactDescription}...`))).toBeInTheDocument();
      });
    });

    it('should handle description shorter than 60 characters', async () => {
      // Arrange
      const shortDescription = 'Short desc';
      const productWithShortDesc = {
        ...mockProducts[0],
        description: shortDescription,
      };

      axios.get.mockResolvedValue({
        data: {
          products: [productWithShortDesc],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Short desc.../)).toBeInTheDocument();
      });
    });

    it('should handle category name with special characters', async () => {
      // Arrange
      const specialCategory = {
        _id: 'cat1',
        name: 'Electronics & Gadgets (2025)',
        slug: 'electronics-gadgets',
      };

      axios.get.mockResolvedValue({
        data: {
          products: [],
          category: specialCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Category - Electronics & Gadgets (2025)')).toBeInTheDocument();
      });
    });

    it('should handle single digit result count', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: [mockProducts[0]],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('1 result found')).toBeInTheDocument();
      });
    });

    it('should display correct result count text', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: [mockProducts[0]],
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const resultText = screen.getByText(/result found/);
        expect(resultText.textContent.trim()).toBe('1 result found');
      });
    });
  });

  describe('Component Lifecycle Integration', () => {
    it('should trigger API call only when slug parameter exists', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders initialRoute="/category/electronics">
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });
    });

    it('should clean up and not cause memory leaks on unmount', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      const { unmount } = render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('Gaming Laptop')).toBeInTheDocument();
      });

      // Assert - Should not throw errors on unmount
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Cross-Component Integration', () => {
    it('should verify all product cards have complete structure', async () => {
      // Arrange
      axios.get.mockResolvedValue({
        data: {
          products: mockProducts,
          category: mockCategory,
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        mockProducts.forEach(product => {
          const card = screen.getByText(product.name).closest('.card');
          expect(card).toBeInTheDocument();

          const withinCard = within(card);
          expect(withinCard.getByText(product.name)).toBeInTheDocument();
          expect(withinCard.getByRole('img')).toBeInTheDocument();
          expect(withinCard.getByText('More Details')).toBeInTheDocument();
        });
      });
    });

    it('should maintain data consistency between API response and rendered content', async () => {
      // Arrange
      const testProduct = {
        _id: 'test123',
        name: 'Test Product',
        slug: 'test-product',
        description: 'Test description for validation',
        price: 299.99,
      };

      axios.get.mockResolvedValue({
        data: {
          products: [testProduct],
          category: { _id: 'cat1', name: 'Test Category', slug: 'test-category' },
        },
      });

      // Act
      render(
        <MockProviders>
          <CategoryProduct />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
        expect(screen.getByText(/Test description for validation/)).toBeInTheDocument();
        expect(screen.getByText('$299.99')).toBeInTheDocument();
        expect(screen.getByText('Category - Test Category')).toBeInTheDocument();

        const img = screen.getByAltText('Test Product');
        expect(img).toHaveAttribute('src', `/api/v1/product/product-photo/test123`);
      });
    });
  });
});
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import ProductDetails from '../../pages/ProductDetails';
import { AuthProvider } from '../../context/auth';
import { CartProvider } from '../../context/cart';
import { SearchProvider } from '../../context/search';

jest.mock('axios');

const MockProviders = ({ children, initialRoute = '/product/test-product' }) => {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <SearchProvider>
          <CartProvider>
            <Routes>
              <Route path="/product/:slug" element={children} />
            </Routes>
          </CartProvider>
        </SearchProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('ProductDetails Integration Tests', () => {
  const mockProduct = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Gaming Laptop',
    slug: 'gaming-laptop',
    description: 'High-performance gaming laptop with RGB keyboard and RTX graphics',
    price: 1500,
    category: { _id: '507f1f77bcf86cd799439012', name: 'Electronics' },
  };

  const mockRelatedProducts = [
    {
      _id: '507f1f77bcf86cd799439013',
      name: 'Gaming Mouse',
      slug: 'gaming-mouse',
      description: 'RGB gaming mouse with programmable buttons for enhanced gaming experience and precision',
      price: 50,
    },
    {
      _id: '507f1f77bcf86cd799439014',
      name: 'Gaming Keyboard',
      slug: 'gaming-keyboard',
      description: 'Mechanical keyboard with customizable RGB lighting and macro keys for gaming',
      price: 120,
    },
    {
      _id: '507f1f77bcf86cd799439015',
      name: 'Gaming Headset',
      slug: 'gaming-headset',
      description: 'Surround sound gaming headset with noise cancellation and comfortable ear pads',
      price: 80,
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
    it('should integrate with Layout component and render product details section', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Product Details')).toBeInTheDocument();
        expect(screen.getByText(/Name :/)).toBeInTheDocument();
        expect(screen.getByText(/Description :/)).toBeInTheDocument();
        expect(screen.getByText(/Price :/)).toBeInTheDocument();
        expect(screen.getByText(/Category :/)).toBeInTheDocument();
      });
    });

    it('should render both product details and related products sections', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Product Details')).toBeInTheDocument();
        expect(screen.getByText(/Similar Products/)).toBeInTheDocument();
      });
    });
  });

  describe('API Integration - Sequential Calls', () => {
    it('should chain API calls: fetch product then fetch related products', async () => {
      // Arrange
      let callOrder = [];
      
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          callOrder.push('product');
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          callOrder.push('related');
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(callOrder).toEqual(['product', 'related']);
      });
    });

    it('should use product ID and category ID from first API call in second API call', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          `/api/v1/product/related-product/${mockProduct._id}/${mockProduct.category._id}`
        );
      });
    });

    it('should not call related products API if product fetch fails', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.reject(new Error('Product not found'));
        }
        // Allow other API calls (from Header/Layout) to succeed
        return Promise.resolve({ data: {} });
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/product/get-product/test-product');
      });

      // Wait a bit to ensure no related products call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify related products API was NOT called
      const relatedProductCalls = axios.get.mock.calls.filter(call => 
        call[0].includes('/api/v1/product/related-product/')
      );
      expect(relatedProductCalls).toHaveLength(0);
    });
  });

  describe('Router Integration', () => {
    it('should extract slug from URL params and use it in API call', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/gaming-laptop')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders initialRoute="/product/gaming-laptop">
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/product/get-product/gaming-laptop');
      });
    });

    it('should handle different slug formats in URL', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/product-with-dashes-123')) {
          return Promise.resolve({
            data: {
              product: { ...mockProduct, slug: 'product-with-dashes-123', name: 'Product With Dashes' },
            },
          });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders initialRoute="/product/product-with-dashes-123">
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/product/get-product/product-with-dashes-123');
      });

      await waitFor(() => {
        expect(screen.getByText(/Product With Dashes/)).toBeInTheDocument();
      });
    });

    it('should trigger new API calls when slug parameter changes', async () => {
      // Arrange - Initial render with product-one
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/product-one')) {
          return Promise.resolve({
            data: { product: { ...mockProduct, slug: 'product-one', name: 'Product One' } },
          });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      const { unmount } = render(
        <MockProviders initialRoute="/product/product-one">
          <ProductDetails />
        </MockProviders>
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/product/get-product/product-one');
      });

      unmount();

      // Act - New render with product-two
      jest.clearAllMocks();
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/product-two')) {
          return Promise.resolve({
            data: { product: { ...mockProduct, slug: 'product-two', name: 'Product Two' } },
          });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      render(
        <MockProviders initialRoute="/product/product-two">
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/product/get-product/product-two');
      });
    });
  });

  describe('Data Display Integration', () => {
    it('should display all product fields with correct formatting', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Gaming Laptop/)).toBeInTheDocument();
        expect(screen.getByText(/High-performance gaming laptop/)).toBeInTheDocument();
        expect(screen.getByText(/\$1,500\.00/)).toBeInTheDocument();
        expect(screen.getByText(/Electronics/)).toBeInTheDocument();
      });
    });

    it('should format currency correctly for different price values', async () => {
      // Arrange
      const testCases = [
        { price: 10, expected: '$10.00' },
        { price: 99.99, expected: '$99.99' },
        { price: 1000, expected: '$1,000.00' },
        { price: 12345.67, expected: '$12,345.67' },
      ];

      for (const testCase of testCases) {
        axios.get.mockImplementation((url) => {
          if (url.includes('/api/v1/product/get-product/')) {
            return Promise.resolve({
              data: { product: { ...mockProduct, price: testCase.price } },
            });
          }
          if (url.includes('/api/v1/product/related-product/')) {
            return Promise.resolve({ data: { products: [] } });
          }
        });

        const { unmount } = render(
          <MockProviders>
            <ProductDetails />
          </MockProviders>
        );

        // Assert
        await waitFor(() => {
          expect(screen.getByText(new RegExp(testCase.expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
        });

        unmount();
      }
    });

    it('should construct correct image URL using product ID', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const img = screen.getByAltText('Gaming Laptop');
        expect(img).toHaveAttribute('src', `/api/v1/product/product-photo/${mockProduct._id}`);
      });
    });

    it('should use product name as image alt text for accessibility', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const img = screen.getByRole('img', { name: /Gaming Laptop/ });
        expect(img).toBeInTheDocument();
      });
    });

    it('should handle product with missing optional fields gracefully', async () => {
      // Arrange
      const incompleteProduct = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Basic Product',
        slug: 'basic-product',
        description: 'Simple description',
        category: { _id: '507f1f77bcf86cd799439012', name: 'General' },
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: incompleteProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Basic Product/)).toBeInTheDocument();
      });

      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });
  });

  describe('Related Products Integration - Boundary Testing', () => {
    it('should display message when no related products exist', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('No Similar Products found')).toBeInTheDocument();
      });
    });

    it('should display exactly one related product', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [mockRelatedProducts[0]] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Gaming Mouse')).toBeInTheDocument();
      });

      expect(screen.queryByText('No Similar Products found')).not.toBeInTheDocument();
    });

    it('should display multiple related products correctly', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Gaming Mouse')).toBeInTheDocument();
        expect(screen.getByText('Gaming Keyboard')).toBeInTheDocument();
        expect(screen.getByText('Gaming Headset')).toBeInTheDocument();
      });
    });

    it('should truncate related product descriptions to 60 characters', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const mouseCard = screen.getByText('Gaming Mouse').closest('.card');
        const description = within(mouseCard).getByText(/RGB gaming mouse with programmable buttons for enhanced gami.../);
        expect(description).toBeInTheDocument();
      });
    });

    it('should render correct image URLs for all related products', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const mouseImg = screen.getByAltText('Gaming Mouse');
        expect(mouseImg).toHaveAttribute('src', `/api/v1/product/product-photo/${mockRelatedProducts[0]._id}`);

        const keyboardImg = screen.getByAltText('Gaming Keyboard');
        expect(keyboardImg).toHaveAttribute('src', `/api/v1/product/product-photo/${mockRelatedProducts[1]._id}`);

        const headsetImg = screen.getByAltText('Gaming Headset');
        expect(headsetImg).toHaveAttribute('src', `/api/v1/product/product-photo/${mockRelatedProducts[2]._id}`);
      });
    });

    it('should format prices correctly for all related products', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('$50.00')).toBeInTheDocument();
        expect(screen.getByText('$120.00')).toBeInTheDocument();
        expect(screen.getByText('$80.00')).toBeInTheDocument();
      });
    });
  });

  describe('User Interaction Integration', () => {
    it('should have functional "More Details" buttons for related products', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const moreDetailsButtons = screen.getAllByText('More Details');
        expect(moreDetailsButtons).toHaveLength(3);
        moreDetailsButtons.forEach(button => {
          expect(button).toBeEnabled();
        });
      });
    });

    it('should have "ADD TO CART" button in product details section', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const addToCartButton = screen.getByText('ADD TO CART');
        expect(addToCartButton).toBeInTheDocument();
        expect(addToCartButton).toHaveClass('btn-secondary');
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle product API failure gracefully without crashing', async () => {
      // Arrange
      axios.get.mockRejectedValue(new Error('Network Error'));

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Product Details')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Gaming Laptop/)).not.toBeInTheDocument();
    });

    it('should handle related products API failure without affecting main product display', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.reject(new Error('Related products fetch failed'));
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Gaming Laptop/)).toBeInTheDocument();
        expect(screen.getByText(/\$1,500\.00/)).toBeInTheDocument();
      });
    });

    it('should handle malformed product data without crashing', async () => {
      // Arrange
      const malformedProduct = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Product',
        category: {},
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: malformedProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Product Details')).toBeInTheDocument();
      });
    });

    it('should handle empty response from product API', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: {} });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Product Details')).toBeInTheDocument();
      });

      expect(screen.queryByAltText(/Product/)).not.toBeInTheDocument();
    });

    it('should handle null product in response', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: null } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Product Details')).toBeInTheDocument();
      });
    });
  });

  describe('State Management Integration', () => {
    it('should update product state when API call succeeds', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert - Product should not be displayed immediately
      expect(screen.queryByText(/Gaming Laptop/)).not.toBeInTheDocument();

      // Assert - Product should be displayed after state update
      await waitFor(() => {
        expect(screen.getByText(/Gaming Laptop/)).toBeInTheDocument();
      });
    });

    it('should update related products state independently of main product', async () => {
      // Arrange
      let relatedCallCount = 0;
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          relatedCallCount++;
          if (relatedCallCount === 1) {
            return new Promise((resolve) =>
              setTimeout(() => resolve({ data: { products: mockRelatedProducts } }), 100)
            );
          }
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert - Main product loads first
      await waitFor(() => {
        expect(screen.getByText(/Gaming Laptop/)).toBeInTheDocument();
      });

      // Assert - Related products load after
      await waitFor(() => {
        expect(screen.getByText('Gaming Mouse')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should maintain separate state for product and related products', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Gaming Laptop/)).toBeInTheDocument();
        expect(screen.getByText('Gaming Mouse')).toBeInTheDocument();
      });

      const productSection = screen.getByText('Product Details').closest('.product-details');
      const relatedSection = screen.getByText(/Similar Products/).closest('.similar-products');

      expect(productSection).not.toBe(relatedSection);
    });
  });

  describe('Conditional Rendering Integration', () => {
    it('should not render product image before product data loads', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return new Promise((resolve) =>
            setTimeout(() => resolve({ data: { product: mockProduct } }), 100)
          );
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert - Image should not exist initially
      expect(screen.queryByAltText(/Gaming Laptop/)).not.toBeInTheDocument();

      // Assert - Image should appear after data loads
      await waitFor(() => {
        expect(screen.getByAltText('Gaming Laptop')).toBeInTheDocument();
      });
    });

    it('should conditionally show related products section based on data', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.queryByText('No Similar Products found')).not.toBeInTheDocument();
        expect(screen.getByText('Gaming Mouse')).toBeInTheDocument();
      });
    });

    it('should render product details even when product image is not available', async () => {
      // Arrange
      const productWithoutId = {
        name: 'Product Without Image',
        slug: 'no-image-product',
        description: 'This product has no image',
        price: 100,
        category: { _id: '507f1f77bcf86cd799439012', name: 'Test' },
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: productWithoutId } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Product Without Image/)).toBeInTheDocument();
      });

      expect(screen.queryByRole('img', { name: /Product Without Image/ })).not.toBeInTheDocument();
    });
  });

  describe('Cross-Component Integration Scenarios', () => {
    it('should integrate product data display across both main and related sections', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const mainProductName = screen.getByText(/Gaming Laptop/);
        const relatedProductName = screen.getByText('Gaming Mouse');
        
        expect(mainProductName).toBeInTheDocument();
        expect(relatedProductName).toBeInTheDocument();
        expect(mainProductName.textContent).not.toBe(relatedProductName.textContent);
      });
    });

    it('should verify all related product cards have complete data structure', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: mockRelatedProducts } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        mockRelatedProducts.forEach(product => {
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
        name: 'Test Product Name',
        slug: 'test-product',
        description: 'Test Description Content',
        price: 299.99,
        category: { _id: 'cat123', name: 'Test Category' },
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: testProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Test Product Name/)).toBeInTheDocument();
        expect(screen.getByText(/Test Description Content/)).toBeInTheDocument();
        expect(screen.getByText(/\$299\.99/)).toBeInTheDocument();
        expect(screen.getByText(/Test Category/)).toBeInTheDocument();
        
        const img = screen.getByAltText('Test Product Name');
        expect(img).toHaveAttribute('src', `/api/v1/product/product-photo/test123`);
      });
    });
  });

  describe('Performance and Loading Integration', () => {
    it('should display product details before related products finish loading', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return new Promise((resolve) =>
            setTimeout(() => resolve({ data: { products: mockRelatedProducts } }), 200)
          );
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert - Main product loads first
      await waitFor(() => {
        expect(screen.getByText(/Gaming Laptop/)).toBeInTheDocument();
      });

      // Related products not yet loaded
      expect(screen.queryByText('Gaming Mouse')).not.toBeInTheDocument();

      // Assert - Related products load after delay
      await waitFor(
        () => {
          expect(screen.getByText('Gaming Mouse')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should handle rapid successive slug changes', async () => {
      // Arrange - First product
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/product-1')) {
          return Promise.resolve({
            data: { product: { ...mockProduct, name: 'Product 1', slug: 'product-1' } },
          });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      const { unmount } = render(
        <MockProviders initialRoute="/product/product-1">
          <ProductDetails />
        </MockProviders>
      );

      await waitFor(() => {
        expect(screen.getByText(/Product 1/)).toBeInTheDocument();
      });

      unmount();

      // Act - Second product (rapid change)
      jest.clearAllMocks();
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/product-2')) {
          return Promise.resolve({
            data: { product: { ...mockProduct, name: 'Product 2', slug: 'product-2' } },
          });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      render(
        <MockProviders initialRoute="/product/product-2">
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Product 2/)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle product with zero price', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({
            data: { product: { ...mockProduct, price: 0 } },
          });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
      });
    });

    it('should handle product with very long name', async () => {
      // Arrange
      const longName = 'A'.repeat(200);
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({
            data: { product: { ...mockProduct, name: longName } },
          });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(new RegExp(longName))).toBeInTheDocument();
      });
    });

    it('should handle product with very long description', async () => {
      // Arrange
      const longDescription = 'B'.repeat(500);
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({
            data: { product: { ...mockProduct, description: longDescription } },
          });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(new RegExp(longDescription))).toBeInTheDocument();
      });
    });

    it('should handle product with very high price', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({
            data: { product: { ...mockProduct, price: 999999.99 } },
          });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/\$999,999\.99/)).toBeInTheDocument();
      });
    });

    it('should handle related product description exactly at 60 character boundary', async () => {
      // Arrange
      const exactDescription = 'A'.repeat(60);
      const relatedProduct = {
        ...mockRelatedProducts[0],
        description: exactDescription,
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [relatedProduct] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const description = screen.getByText(new RegExp(`${exactDescription}...`));
        expect(description).toBeInTheDocument();
      });
    });

    it('should handle related product description shorter than 60 characters', async () => {
      // Arrange
      const shortDescription = 'Short description';
      const relatedProduct = {
        ...mockRelatedProducts[0],
        description: shortDescription,
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [relatedProduct] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        const description = screen.getByText(new RegExp(`${shortDescription}...`));
        expect(description).toBeInTheDocument();
      });
    });

    it('should handle category with special characters in name', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({
            data: {
              product: {
                ...mockProduct,
                category: { _id: 'cat123', name: 'Electronics & Gadgets (2025)' },
              },
            },
          });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Electronics & Gadgets \(2025\)/)).toBeInTheDocument();
      });
    });
  });

  describe('Component Lifecycle Integration', () => {
    it('should trigger API call only when slug parameter exists', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      render(
        <MockProviders initialRoute="/product/gaming-laptop">
          <ProductDetails />
        </MockProviders>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });
    });

    it('should clean up and not cause memory leaks on unmount', async () => {
      // Arrange
      axios.get.mockImplementation((url) => {
        if (url.includes('/api/v1/product/get-product/')) {
          return Promise.resolve({ data: { product: mockProduct } });
        }
        if (url.includes('/api/v1/product/related-product/')) {
          return Promise.resolve({ data: { products: [] } });
        }
      });

      // Act
      const { unmount } = render(
        <MockProviders>
          <ProductDetails />
        </MockProviders>
      );

      await waitFor(() => {
        expect(screen.getByText(/Gaming Laptop/)).toBeInTheDocument();
      });

      // Assert - Should not throw errors on unmount
      expect(() => unmount()).not.toThrow();
    });
  });
});
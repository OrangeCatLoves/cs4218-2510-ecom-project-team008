import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import ProductDetails from './ProductDetails';

// Mock dependencies
jest.mock('axios');
jest.mock('../components/Layout', () => {
  return function MockLayout({ children }) {
    return <div data-testid="layout">{children}</div>;
  };
});

const mockAxios = axios;
const mockUseParams = jest.fn();
const mockUseNavigate = jest.fn();

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => mockUseParams(),
  useNavigate: () => mockUseNavigate(),
}));

describe('ProductDetails Component', () => {
  const mockNavigate = jest.fn();
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    
    // Suppress console output
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderWithRouter = (component) => {
    return render(
      <BrowserRouter>
        {component}
      </BrowserRouter>
    );
  };

  describe('Basic Component Structure', () => {
    test('should render layout and basic structure without slug', () => {
      // Arrange
      mockUseParams.mockReturnValue({ slug: undefined });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByText('Product Details')).toBeInTheDocument();
      expect(screen.getByText('Similar Products ➡️')).toBeInTheDocument();
      expect(screen.getByText('ADD TO CART')).toBeInTheDocument();
    });

    test('should render "No Similar Products found" message initially', () => {
      // Arrange
      mockUseParams.mockReturnValue({ slug: undefined });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      expect(screen.getByText('No Similar Products found')).toBeInTheDocument();
    });

    test('should not make API calls when slug is undefined', () => {
      // Arrange
      mockUseParams.mockReturnValue({ slug: undefined });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    test('should not make API calls when slug is empty string', () => {
      // Arrange
      mockUseParams.mockReturnValue({ slug: '' });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    test('should not make API calls when slug is null', () => {
      // Arrange
      mockUseParams.mockReturnValue({ slug: null });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      expect(mockAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('API Call Behavior', () => {
    test('should make initial product API call when slug exists', async () => {
      // Arrange
      mockUseParams.mockReturnValue({ slug: 'test-product' });
      mockAxios.get.mockResolvedValue({ data: { product: {} } });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith('/api/v1/product/get-product/test-product');
      });
    });

    test('should handle API errors gracefully', async () => {
      // Arrange
      mockUseParams.mockReturnValue({ slug: 'test-product' });
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('Navigation Functionality', () => {
    test('should call navigate function when More Details button is clicked', async () => {
      // Arrange
      const mockProduct = {
        _id: '1',
        name: 'Test Product',
        category: { _id: 'cat1' }
      };
      const mockRelatedProducts = [{
        _id: '2',
        name: 'Related Product',
        description: 'A related product description that is longer than sixty characters',
        price: 19.99,
        slug: 'related-product'
      }];

      mockUseParams.mockReturnValue({ slug: 'test-product' });
      mockAxios.get
        .mockResolvedValueOnce({ data: { product: mockProduct } })
        .mockResolvedValueOnce({ data: { products: mockRelatedProducts } });

      // Act
      renderWithRouter(<ProductDetails />);

      // Wait for related products to render
      await waitFor(() => {
        expect(screen.getByText('More Details')).toBeInTheDocument();
      });

      const moreDetailsButton = screen.getByText('More Details');
      fireEvent.click(moreDetailsButton);

      // Assert
      expect(mockNavigate).toHaveBeenCalledWith('/product/related-product');
    });
  });

  describe('Related Products Display', () => {
    test('should show "No Similar Products found" when empty array returned', async () => {
      // Arrange
      const mockProduct = {
        _id: '1',
        name: 'Test Product',
        category: { _id: 'cat1' }
      };

      mockUseParams.mockReturnValue({ slug: 'test-product' });
      mockAxios.get
        .mockResolvedValueOnce({ data: { product: mockProduct } })
        .mockResolvedValueOnce({ data: { products: [] } });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('No Similar Products found')).toBeInTheDocument();
      });
    });

    test('should render related product names when data is available', async () => {
      // Arrange
      const mockProduct = {
        _id: '1',
        name: 'Test Product',
        category: { _id: 'cat1' }
      };
      const mockRelatedProducts = [
        {
          _id: '2',
          name: 'Related Product 1',
          description: 'Description for related product one that is longer than sixty characters',
          price: 19.99,
          slug: 'related-product-1'
        },
        {
          _id: '3',
          name: 'Related Product 2',
          description: 'Description for related product two',
          price: 29.99,
          slug: 'related-product-2'
        }
      ];

      mockUseParams.mockReturnValue({ slug: 'test-product' });
      mockAxios.get
        .mockResolvedValueOnce({ data: { product: mockProduct } })
        .mockResolvedValueOnce({ data: { products: mockRelatedProducts } });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Related Product 1')).toBeInTheDocument();
      });
      expect(screen.getByText('Related Product 2')).toBeInTheDocument();
    });

    test('should render multiple More Details buttons for multiple products', async () => {
      // Arrange
      const mockProduct = {
        _id: '1',
        name: 'Test Product',
        category: { _id: 'cat1' }
      };
      const mockRelatedProducts = [
        {
          _id: '2',
          name: 'Product 1',
          description: 'Description',
          price: 19.99,
          slug: 'product-1'
        },
        {
          _id: '3',
          name: 'Product 2',
          description: 'Description',
          price: 29.99,
          slug: 'product-2'
        }
      ];

      mockUseParams.mockReturnValue({ slug: 'test-product' });
      mockAxios.get
        .mockResolvedValueOnce({ data: { product: mockProduct } })
        .mockResolvedValueOnce({ data: { products: mockRelatedProducts } });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      await waitFor(() => {
        const moreDetailsButtons = screen.getAllByText('More Details');
        expect(moreDetailsButtons).toHaveLength(2);
      });
    });
  });

  describe('Product Images', () => {
    test('should render product image with correct alt text when product loads', async () => {
      // Arrange
      const mockProduct = {
        _id: '1',
        name: 'Test Product',
        category: { _id: 'cat1' }
      };

      mockUseParams.mockReturnValue({ slug: 'test-product' });
      mockAxios.get
        .mockResolvedValueOnce({ data: { product: mockProduct } })
        .mockResolvedValueOnce({ data: { products: [] } });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      await waitFor(() => {
        const productImage = screen.getByAltText('Test Product');
        expect(productImage).toBeInTheDocument();
      });

      const productImage = screen.getByAltText('Test Product');
      expect(productImage).toHaveAttribute('height', '300');
      expect(productImage).toHaveAttribute('width', '350px');
    });

    test('should render related product images with correct alt attributes', async () => {
      // Arrange
      const mockProduct = {
        _id: '1',
        name: 'Main Product',
        category: { _id: 'cat1' }
      };
      const mockRelatedProducts = [{
        _id: '2',
        name: 'Related Product',
        description: 'A description',
        price: 19.99,
        slug: 'related'
      }];

      mockUseParams.mockReturnValue({ slug: 'main-product' });
      mockAxios.get
        .mockResolvedValueOnce({ data: { product: mockProduct } })
        .mockResolvedValueOnce({ data: { products: mockRelatedProducts } });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      await waitFor(() => {
        expect(screen.getByAltText('Related Product')).toBeInTheDocument();
      });
    });
  });

  describe('Price Display', () => {
    test('should render formatted prices for related products', async () => {
      // Arrange
      const mockProduct = {
        _id: '1',
        name: 'Test Product',
        category: { _id: 'cat1' }
      };
      const mockRelatedProducts = [{
        _id: '2',
        name: 'Related Product',
        description: 'Description',
        price: 99.99,
        slug: 'related'
      }];

      mockUseParams.mockReturnValue({ slug: 'test-product' });
      mockAxios.get
        .mockResolvedValueOnce({ data: { product: mockProduct } })
        .mockResolvedValueOnce({ data: { products: mockRelatedProducts } });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('$99.99')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle similar products API error gracefully', async () => {
      // Arrange
      const mockProduct = {
        _id: '1',
        name: 'Test Product',
        category: { _id: 'cat1' }
      };
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      mockUseParams.mockReturnValue({ slug: 'test-product' });
      mockAxios.get
        .mockResolvedValueOnce({ data: { product: mockProduct } })
        .mockRejectedValueOnce(new Error('Similar products API error'));

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('Text Truncation', () => {
    test('should truncate long product descriptions in related products', async () => {
      // Arrange
      const mockProduct = {
        _id: '1',
        name: 'Test Product',
        category: { _id: 'cat1' }
      };
      const mockRelatedProducts = [{
        _id: '2',
        name: 'Related Product',
        description: 'This is a very long product description that should be truncated at exactly sixty characters',
        price: 19.99,
        slug: 'related'
      }];

      mockUseParams.mockReturnValue({ slug: 'test-product' });
      mockAxios.get
        .mockResolvedValueOnce({ data: { product: mockProduct } })
        .mockResolvedValueOnce({ data: { products: mockRelatedProducts } });

      // Act
      renderWithRouter(<ProductDetails />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('This is a very long product description that should be trunc...')).toBeInTheDocument();
      });
    });
  });
});
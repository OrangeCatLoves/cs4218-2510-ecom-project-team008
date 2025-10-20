// Header.test.js
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../context/auth';
import { useCart } from '../context/cart';
import useCategory from '../hooks/useCategory';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('../context/auth');
jest.mock('../context/cart');
jest.mock('../hooks/useCategory');
jest.mock('react-hot-toast');
jest.mock('./Form/SearchInput', () => () => <div>SearchInput</div>);

describe('Header Component', () => {
  const mockSetAuth = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const renderHeader = () => {
    return render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );
  };

  describe('Authentication - Not Logged In', () => {
    it('should display Register and Login links when user is not authenticated', () => {
      // Arrange
      useAuth.mockReturnValue([{ user: null }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert
      expect(screen.getByText('Register')).toBeInTheDocument();
      expect(screen.getByText('Login')).toBeInTheDocument();
    });

    it('should not display user dropdown when user is not authenticated', () => {
      // Arrange
      useAuth.mockReturnValue([{ user: null }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Logout')).not.toBeInTheDocument();
    });
  });

  describe('Authentication - Logged In', () => {
    it('should display user name when authenticated', () => {
      // Arrange
      const mockUser = { name: 'John Doe', role: 0 };
      useAuth.mockReturnValue([{ user: mockUser }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should not display Register and Login links when authenticated', () => {
      // Arrange
      const mockUser = { name: 'John Doe', role: 0 };
      useAuth.mockReturnValue([{ user: mockUser }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert
      expect(screen.queryByText('Register')).not.toBeInTheDocument();
      expect(screen.queryByText('Login')).not.toBeInTheDocument();
    });

    it('should display Dashboard and Logout options when authenticated', () => {
      // Arrange
      const mockUser = { name: 'John Doe', role: 0 };
      useAuth.mockReturnValue([{ user: mockUser }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });

  describe('Role-Based Dashboard Routing', () => {
    it('should link to user dashboard when user role is not admin', () => {
      // Arrange
      const mockUser = { name: 'John Doe', role: 0 };
      useAuth.mockReturnValue([{ user: mockUser }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('href', '/dashboard/user');
    });

    it('should link to admin dashboard when user role is admin', () => {
      // Arrange
      const mockUser = { name: 'Admin User', role: 1 };
      useAuth.mockReturnValue([{ user: mockUser }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('href', '/dashboard/admin');
    });
  });

  describe('Logout Functionality', () => {
    it('should clear auth state and localStorage on logout', () => {
      // Arrange
      const mockUser = { name: 'John Doe', role: 0, token: 'abc123' };
      const mockAuth = { user: mockUser, token: 'abc123' };
      useAuth.mockReturnValue([mockAuth, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);
      localStorage.setItem('auth', JSON.stringify(mockAuth));

      // Act
      renderHeader();
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);

      // Assert
      expect(mockSetAuth).toHaveBeenCalledWith({
        user: mockUser,
        token: 'abc123',
        user: null,
        token: '',
      });
      expect(localStorage.getItem('auth')).toBeNull();
      expect(toast.success).toHaveBeenCalledWith('Logout Successfully');
    });
  });

  describe('Category Rendering', () => {
    it('should render all categories in dropdown', () => {
      // Arrange
      const mockCategories = [
        { _id: '1', name: 'Electronics', slug: 'electronics' },
        { _id: '2', name: 'Clothing', slug: 'clothing' },
        { _id: '3', name: 'Books', slug: 'books' },
      ];
      useAuth.mockReturnValue([{ user: null }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([mockCategories]);

      // Act
      renderHeader();

      // Assert
      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('Clothing')).toBeInTheDocument();
      expect(screen.getByText('Books')).toBeInTheDocument();
    });

    it('should render "All Categories" link', () => {
      // Arrange
      useAuth.mockReturnValue([{ user: null }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert
      expect(screen.getByText('All Categories')).toBeInTheDocument();
    });

    it('should handle empty categories array', () => {
      // Arrange
      useAuth.mockReturnValue([{ user: null }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert - should still render without crashing
      expect(screen.getByText('Categories')).toBeInTheDocument();
    });
  });

  describe('Cart Badge Display', () => {
    it('should display cart count badge with correct number', () => {
      // Arrange
      const mockCartItems = {
        'product-1': { quantity: 1, price: 100, productId: '1' },
        'product-2': { quantity: 2, price: 200, productId: '2' },
        'product-3': { quantity: 1, price: 150, productId: '3' }
      };
      useAuth.mockReturnValue([{ user: null }, mockSetAuth]);
      useCart.mockReturnValue({ cart: mockCartItems, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert
      const badge = screen.getByText('3');
      expect(badge).toBeInTheDocument();
    });

    it('should display cart badge even when cart is empty', () => {
      // Arrange
      useAuth.mockReturnValue([{ user: null }, mockSetAuth]);
      useCart.mockReturnValue({ cart: {}, addToCart: jest.fn(), removeFromCart: jest.fn(), updateQuantity: jest.fn(), clearCart: jest.fn() });
      useCategory.mockReturnValue([[]]);

      // Act
      renderHeader();

      // Assert
      expect(screen.getByText('Cart')).toBeInTheDocument();
      // Badge should show 0 due to showZero prop
    });
  });
});
import React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import Orders from "../../pages/user/Orders";
import {AuthProvider} from "../../context/auth";
import {CartProvider} from "../../context/cart";
import {SearchProvider} from "../../context/search";
import axios from "axios";
import {MemoryRouter, Route, Router, Routes} from "react-router-dom";
import PrivateRoute from "../../components/Routes/Private";

jest.mock('axios');

describe('Integration between Orders page and other frontend dependencies', () => {
  const mockUser = {
    name: "Mock Name",
    email: "Mock Email",
    password: "Mock password",
    phone: "Mock Phone",
    address: "Mock Address",
    role: 0
  }

  const mockProduct1 = {
    _id: 1,
    name: "Mock Product1",
    description: "Mock Description1",
    price: 19.99
  };
  const mockProduct2 = {
    _id: 2,
    name: "Mock Product2",
    description: "Mock Description2",
    price: 199.99
  };

  const mockOrder1 = {
    _id: 1,
    products: [mockProduct1],
    payment: {
      success: true,
      message: "Mock Message1"
    },
    buyer: {
      name: "Mock Buyer1"
    }
  };
  const mockOrder2 = {
    _id: 2,
    products: [mockProduct1, mockProduct2],
    payment: {
      success: false,
      message: "Mock Message2"
    },
    buyer: {
      name: "Mock Buyer2"
    }
  };

  const mockOrders = [mockOrder1, mockOrder2];

  const Providers = ({children}) => {
    return (
      <AuthProvider>
        <CartProvider>
          <SearchProvider>
            {children}
          </SearchProvider>
        </CartProvider>
      </AuthProvider>
    );
  };

  const Routers = ({children}) => {
    return (
      <MemoryRouter initialEntries={["/dashboard/user/orders"]}>
        <Routes>
          <Route path='/dashboard' element={<PrivateRoute />}>
            <Route path='user/orders' element={children}/>
          </Route>
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    axios.get.mockImplementation((url) => {
      if(url.includes('/api/v1/auth/user-auth')) {
        return Promise.resolve({
          data: {
            ok: true
          }
        });
      } else if(url.includes("/api/v1/auth/orders")) {
        return Promise.resolve({
          data: mockOrders
        });
      }
    });
    localStorage.setItem('auth', JSON.stringify({
      user: mockUser, token: "Mock Token"
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });



  it('should render correctly with Layout and User Menu', async() => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Orders />
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      // Layout
      expect(document.title).toBe('Your Orders');

      // User Menu
      expect(screen.getByRole('heading', {name: 'Dashboard', level: 4})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Profile'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Orders'})).toBeInTheDocument();

      // Orders Page
      expect(screen.getByText('All Orders')).toBeInTheDocument();
    });
  });

  it('should render correct header for authenticated user', async() => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Orders />
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('button', {name: mockUser.name})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Dashboard'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Logout'})).toBeInTheDocument();
    });
  });

  it('should receive and render all mock orders correctly for authenticated user', async() => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Orders />
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      expect(screen.getAllByTestId('order')).toHaveLength(2);
      expect(screen.getAllByTestId('order-status')).toHaveLength(2);
      expect(screen.getAllByTestId('order-buyer')).toHaveLength(2);
      expect(screen.getAllByTestId('order-payment-success')).toHaveLength(2);
      expect(screen.getAllByTestId('order-products-count')).toHaveLength(2);

      expect(screen.getAllByTestId('product-name')).toHaveLength(3);
      expect(screen.getAllByTestId('product-description')).toHaveLength(3);
      expect(screen.getAllByTestId('product-price')).toHaveLength(3);

      expect(screen.getAllByText(mockProduct1.name)).toHaveLength(2);
      expect(screen.getAllByText(mockProduct1.description.substring(0, 30))).toHaveLength(2);
      expect(screen.getAllByText("Price : " + mockProduct1.price)).toHaveLength(2);

      expect(screen.getAllByText(mockProduct2.name)).toHaveLength(1);
      expect(screen.getAllByText(mockProduct2.description.substring(0, 30))).toHaveLength(1);
      expect(screen.getAllByText("Price : " + mockProduct2.price)).toHaveLength(1);
    });
  });

  it('should redirect non-authenticated user to login page', async() => {
    // Arrange
    localStorage.removeItem('auth');
    axios.get.mockImplementation((url) => {
      if(url.includes('/api/v1/auth/user-auth')) {
        return Promise.resolve({
          data: {
            ok: false
          }
        });
      } else if(url.includes("/api/v1/auth/all-orders")) {
        return Promise.resolve({
          data: mockOrders
        })
      }
    });
    const page = (
      <Providers>
        <Routers>
          <Orders />
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('heading', {name: /redirecting/i, level: 1})).toBeInTheDocument();
      expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
    });
  });
});
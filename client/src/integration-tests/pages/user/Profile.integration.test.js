import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import {AuthProvider} from "../../../context/auth";
import {CartProvider} from "../../../context/cart";
import {SearchProvider} from "../../../context/search";
import axios from "axios";
import {MemoryRouter, Route, Router, Routes} from "react-router-dom";
import PrivateRoute from "../../../components/Routes/Private";
import toast from "react-hot-toast";
import Profile from "../../../pages/user/Profile";

jest.mock('axios');

jest.spyOn(toast, 'success');
jest.spyOn(toast, 'error');

describe('Integration between Profile page and other frontend dependencies', () => {
  const mockUser = {
    name: "Mock Name",
    email: "Mock Email",
    password: "Mock password",
    phone: "Mock Phone",
    address: "Mock Address",
    role: 0
  };

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
      <MemoryRouter initialEntries={["/dashboard/user/profile"]}>
        <Routes>
          <Route path='/dashboard' element={<PrivateRoute />}>
            <Route path='user/profile' element={children}/>
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
      } else if(url.includes("/api/v1/auth/profile")) {
        return Promise.resolve({
          data: {
            updatedUser: mockUser,
          }
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
    const page = (
      <Providers>
        <Routers>
          <Profile />
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      // Layout
      expect(document.title).toBe('Your Profile');

      // User Menu
      expect(screen.getByRole('heading', {name: 'Dashboard', level: 4})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Profile'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Orders'})).toBeInTheDocument();

      // Profile Page
      expect(screen.getByRole('heading', {name: "USER PROFILE", level: 4})).toBeInTheDocument();
      expect(screen.getByTestId("exampleInputName1")).toBeInTheDocument();
      expect(screen.getByTestId("exampleInputPhone1")).toBeInTheDocument();
      expect(screen.getByTestId("exampleInputEmail1")).toBeInTheDocument();
      expect(screen.getByTestId("exampleInputPhone1")).toBeInTheDocument();
      expect(screen.getByTestId("exampleInputPassword1")).toBeInTheDocument();
      expect(screen.getByTestId("exampleInputAddress1")).toBeInTheDocument();
      expect(screen.getByRole('button', {name: "UPDATE"})).toBeInTheDocument();
    });
  });

  it('should render correct header for authenticated user', async() => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Profile />
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

  it('should fetch correct user profile from backend and render the profile correctly', async() => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Profile />
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("exampleInputName1")).toHaveValue(mockUser.name);
      expect(screen.getByTestId("exampleInputPhone1")).toHaveValue(mockUser.phone);
      expect(screen.getByTestId("exampleInputEmail1")).toBeInTheDocument(mockUser.email);
      expect(screen.getByTestId("exampleInputPhone1")).toBeInTheDocument(mockUser.address);
    });
  });

  it('should redirect non-authenticated user to login page', async() => {
    // Arrange
    axios.get.mockImplementation((url) => {
      if(url.includes('/api/v1/auth/user-auth')) {
        return Promise.resolve({
          data: {
            ok: false
          }
        });
      }
    });
    const page = (
      <Providers>
        <Routers>
          <Profile />
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

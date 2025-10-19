import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import Users from "../../../pages/admin/Users";
import {AuthProvider} from "../../../context/auth";
import {CartProvider} from "../../../context/cart";
import {SearchProvider} from "../../../context/search";
import axios from "axios";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import toast from "react-hot-toast";
import AdminRoute from "../../../components/Routes/AdminRoute";

jest.mock('axios');

jest.spyOn(toast, 'success');
const toastErrorSpy = jest.spyOn(toast, 'error');

describe('Integration between Admin User View Page and other frontend dependenencies', () => {
  const admin = {
    name: "Mock Admin",
    email: "Mock Admin Email",
    password: "Mock Admin Password",
    phone: "Mock Admin Phone",
    address: "Mock Admin Address",
    role: 1
  };

  const mockUser1 = {
    name: "Mock User1",
    email: "Mock Email1",
    password: "Mock Password1",
    phone: "Mock Phone1",
    address: "Mock Address1",
    role: 0
  };

  const mockUser2 = {
    name: "Mock User2",
    email: "Mock Email2",
    password: "Mock Password2",
    phone: "Mock Phone2",
    address: "Mock Address2",
    role: 0
  };

  const mockUser3 = {
    name: "Mock User3",
    email: "Mock Email3",
    password: "Mock Password3",
    phone: "Mock Phone3",
    address: "Mock Address3",
    role: 0
  };

  const mockCategory = {
    name: "Mock Category",
  }

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
      <MemoryRouter initialEntries={["/dashboard/admin/users"]}>
        <Routes>
          <Route path='/dashboard' element={<AdminRoute />}>
            <Route path='admin/users' element={children}/>
          </Route>
        </Routes>
      </MemoryRouter>
    );
  };

  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      value: jest.fn(() => {
        return {
          matches: true,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        };
      }),
    });
  });

  beforeEach(() => {
    axios.get.mockImplementation((url) => {
      if(url.includes('/api/v1/auth/admin-auth')) {
        return Promise.resolve({
          data: {
            ok: true
          }
        });
      } else if(url.includes("/api/v1/auth/all-users")) {
        return Promise.resolve({
          data: [mockUser1, mockUser2, mockUser3]
        });
      } else if(url.includes("/api/v1/category/get-category")) {
        return Promise.resolve({
          data: {
            category: [mockCategory]
          }
        });
      }
    });
    localStorage.setItem('auth', JSON.stringify({
      user: admin, token: "Mock Token"
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render Layout and Admin Menu correctly', async() => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Users/>
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      // Layout
      expect(document.title).toBe("Dashboard - All Users");

      // Admin Menu
      expect(screen.getByRole('link', {name: 'Create Category'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Create Product'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Products'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Orders'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Users'})).toBeInTheDocument();

      // Users
      expect(screen.getByRole('heading', {name: 'All Users', level: 1})).toBeInTheDocument();
    });
  });

  it('should render correct header for authenticated user', async() => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Users />
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('button', {name: admin.name})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Dashboard'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Logout'})).toBeInTheDocument();
    });
  });

  it('should fetch all users from backend and render the users correctly', async() => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Users />
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      expect(screen.getAllByTestId("username")).toHaveLength(3);
      expect(screen.getAllByTestId("email")).toHaveLength(3);
      expect(screen.getAllByTestId("phone")).toHaveLength(3);
      expect(screen.getAllByTestId("address")).toHaveLength(3);

      expect(screen.getByText(mockUser1.name)).toBeInTheDocument();
      expect(screen.getByText("Email: " + mockUser1.email)).toBeInTheDocument();
      expect(screen.getByText("Phone: " + mockUser1.phone)).toBeInTheDocument();
      expect(screen.getByText("Address: " + mockUser1.address)).toBeInTheDocument();

      expect(screen.getByText(mockUser2.name)).toBeInTheDocument();
      expect(screen.getByText("Email: " + mockUser2.email)).toBeInTheDocument();
      expect(screen.getByText("Phone: " + mockUser2.phone)).toBeInTheDocument();
      expect(screen.getByText("Address: " + mockUser2.address)).toBeInTheDocument();
    });
  });

  it('should redirect non-admin user to login page', async() => {
    // Arrange
    axios.get.mockImplementation((url) => {
      if(url.includes('/api/v1/auth/admin-auth')) {
        return Promise.resolve({
          data: {
            ok: false
          }
        });
      } else if(url.includes("/api/v1/auth/all-users")) {
        return Promise.resolve({
          data: [mockUser1, mockUser2, mockUser3]
        });
      } else if(url.includes("/api/v1/category/get-category")) {
        return Promise.resolve({
          data: {
            category: [mockCategory]
          }
        });
      }
    });
    const page = (
      <Providers>
        <Routers>
          <Users />
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

  it('should render error message with react toast if fetching all users failed', async() => {
    const error = new Error("An Error Occurred.");
    axios.get.mockImplementation((url) => {
      if(url.includes('/api/v1/auth/admin-auth')) {
        return Promise.resolve({
          data: {
            ok: true
          }
        });
      } else if(url.includes("/api/v1/auth/all-users")) {
        return Promise.reject(error);
      } else if(url.includes("/api/v1/category/get-category")) {
        return Promise.resolve({
          data: {
            category: [mockCategory]
          }
        });
      }
    });
    const page = (
      <Providers>
        <Routers>
          <Users />
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith("Something Went Wrong");
    });
  });
});
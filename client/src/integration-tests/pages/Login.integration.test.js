import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../context/auth";
import { CartProvider } from "../../context/cart";
import { SearchProvider } from "../../context/search";
import Login from "../../pages/Auth/Login";

jest.mock("axios");
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="mock-layout">{children}</div>,
}));

const Providers = ({ children }) => (
  <AuthProvider>
    <SearchProvider>
      <CartProvider>{children}</CartProvider>
    </SearchProvider>
  </AuthProvider>
);

const Routers = ({ children }) => (
  <MemoryRouter initialEntries={["/login"]}>
    <Routes>
      <Route path="/login" element={children} />
      <Route path="/" element={<div>🏠 Home Page</div>} />
      <Route path="/forgot-password" element={<div>🔑 Forgot Password Page</div>} />
    </Routes>
  </MemoryRouter>
);

describe("Integration between Login page and frontend dependencies", () => {
  const validCredentials = {
    email: "mockuser@email.com",
    password: "mockpassword",
  };

  const mockUser = {
    name: "Mock User",
    email: "mockuser@email.com",
    phone: "91234567",
    address: "Mock Address",
    role: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("renders login form correctly", async () => {
    render(
      <Providers>
        <Routers>
          <Login />
        </Routers>
      </Providers>
    );

    expect(screen.getByText("LOGIN FORM")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LOGIN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forgot Password" })).toBeInTheDocument();
  });

  it("logs in successfully and redirects to home page", async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        message: "Login successful",
        user: mockUser,
        token: "mock-token-123",
      },
    });

    render(
      <Providers>
        <Routers>
          <Login />
        </Routers>
      </Providers>
    );

    await userEvent.type(screen.getByPlaceholderText("Enter Your Email"), validCredentials.email);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Password"), validCredentials.password);
    await userEvent.click(screen.getByRole("button", { name: "LOGIN" }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith("/api/v1/auth/login", validCredentials)
    );

    await waitFor(() => expect(screen.getByText("🏠 Home Page")).toBeInTheDocument());

    const storedAuth = JSON.parse(localStorage.getItem("auth"));
    expect(storedAuth.user.email).toBe(mockUser.email);
    expect(storedAuth.token).toBe("mock-token-123");

    expect(toast.success).toHaveBeenCalledWith("Login successful", expect.any(Object));
  });

  it("shows backend error message when credentials are invalid", async () => {
    axios.post.mockResolvedValueOnce({
      data: { success: false, message: "Invalid credentials" },
    });

    render(
      <Providers>
        <Routers>
          <Login />
        </Routers>
      </Providers>
    );

    await userEvent.type(screen.getByPlaceholderText("Enter Your Email"), validCredentials.email);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Password"), validCredentials.password);
    await userEvent.click(screen.getByRole("button", { name: "LOGIN" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials")
    );
  });

  it("displays generic error message when API call fails", async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { message: "Server unavailable" } },
    });

    render(
      <Providers>
        <Routers>
          <Login />
        </Routers>
      </Providers>
    );

    await userEvent.type(screen.getByPlaceholderText("Enter Your Email"), validCredentials.email);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Password"), validCredentials.password);
    await userEvent.click(screen.getByRole("button", { name: "LOGIN" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Server unavailable")
    );
  });

  it("navigates to Forgot Password page when button is clicked", async () => {
    render(
      <Providers>
        <Routers>
          <Login />
        </Routers>
      </Providers>
    );

    await userEvent.click(screen.getByRole("button", { name: "Forgot Password" }));

    await waitFor(() =>
      expect(screen.getByText("🔑 Forgot Password Page")).toBeInTheDocument()
    );
  });

  it("keeps password field masked while typing", async () => {
    render(
      <Providers>
        <Routers>
          <Login />
        </Routers>
      </Providers>
    );

    const passwordInput = screen.getByPlaceholderText("Enter Your Password");
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});

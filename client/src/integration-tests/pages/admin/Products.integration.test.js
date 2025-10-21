import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter } from "react-router-dom";

import Products from "../../../pages/admin/Products.js";
import { AuthProvider } from "../../../context/auth.js";
import { CartProvider } from "../../../context/cart.js";
import { SearchProvider } from "../../../context/search.js";

// shallow shells for speed
jest.mock("../../../components/Layout.js", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));
jest.mock("../../../components/AdminMenu.js", () => () => (
  <div data-testid="admin-menu">Admin Menu</div>
));

jest.mock("axios");
jest.mock("react-hot-toast");

const tick = () => new Promise((r) => setTimeout(r, 0));
const actAsync = async (fn) => {
  await act(async () => {
    await fn();
    await tick();
  });
};

describe("Products Page — Integration", () => {
  const mockAdmin = { name: "Admin User", email: "admin@test.com", role: 1 };
  const baseProducts = [
    {
      _id: "prod1",
      name: "Gaming Laptop",
      slug: "gaming-laptop",
      description: "High performance laptop",
    },
    {
      _id: "prod2",
      name: "Wireless Mouse",
      slug: "wireless-mouse",
      description: "Ergonomic wireless mouse",
    },
    {
      _id: "prod3",
      name: "Mechanical Keyboard",
      slug: "mechanical-keyboard",
      description: "RGB mechanical keyboard",
    },
  ];

  const Providers = ({ children }) => (
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </SearchProvider>
      </CartProvider>
    </AuthProvider>
  );

  beforeAll(() => {
    // AntD/Browser features some components use
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: mockAdmin, token: "mock-token" })
    );
    axios.get.mockResolvedValue({ data: { products: baseProducts } });
    toast.error = jest.fn();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderPage = () =>
    render(
      <Providers>
        <Products />
      </Providers>
    );

  // fetch and render
  test("fetches products from API on mount and renders list", async () => {
    renderPage();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/product/get-product");
    });

    expect(await screen.findByText("Gaming Laptop")).toBeInTheDocument();
    expect(screen.getByText("Wireless Mouse")).toBeInTheDocument();
    expect(screen.getByText("Mechanical Keyboard")).toBeInTheDocument();
  });

  // image endpoints
  test("renders product images using correct photo API src", async () => {
    renderPage();

    const img1 = await screen.findByAltText("Gaming Laptop");
    const img2 = screen.getByAltText("Wireless Mouse");
    const img3 = screen.getByAltText("Mechanical Keyboard");

    expect(img1).toHaveAttribute("src", "/api/v1/product/product-photo/prod1");
    expect(img2).toHaveAttribute("src", "/api/v1/product/product-photo/prod2");
    expect(img3).toHaveAttribute("src", "/api/v1/product/product-photo/prod3");
  });

  // navigation
  test("each product card links to its UpdateProduct route", async () => {
    renderPage();

    const link1 = (await screen.findByText("Gaming Laptop")).closest("a");
    const link2 = screen.getByText("Wireless Mouse").closest("a");
    const link3 = screen.getByText("Mechanical Keyboard").closest("a");

    expect(link1).toHaveAttribute(
      "href",
      "/dashboard/admin/product/gaming-laptop"
    );
    expect(link2).toHaveAttribute(
      "href",
      "/dashboard/admin/product/wireless-mouse"
    );
    expect(link3).toHaveAttribute(
      "href",
      "/dashboard/admin/product/mechanical-keyboard"
    );
  });

  // loading / lifecycle
  test("shows a loading state while fetching, then hides it", async () => {
    // delay the response to force a loading state
    axios.get.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: { products: baseProducts } }), 80)
        )
    );

    renderPage();

    // implementation shows "Loading" text; adapt if your component uses a spinner text/role
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    expect(await screen.findByText("Gaming Laptop")).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  // null-safety
  test("handles empty list safely (no crash, page structure intact)", async () => {
    axios.get.mockResolvedValueOnce({ data: { products: [] } });

    renderPage();

    expect(await screen.findByText("All Products List")).toBeInTheDocument();
    expect(screen.queryByText("Gaming Laptop")).not.toBeInTheDocument();
  });

  test("handles null/undefined products array safely", async () => {
    axios.get.mockResolvedValueOnce({ data: { products: null } });
    renderPage();
    expect(
      (await screen.findAllByText("All Products List")).length
    ).toBeGreaterThan(0);

    axios.get.mockResolvedValueOnce({ data: {} });
    renderPage();
    expect(
      (await screen.findAllByText("All Products List")).length
    ).toBeGreaterThan(0);
  });

  // error path
  test("API failure → error toast, but keeps page shell", async () => {
    const err = new Error("Network Error");
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    axios.get.mockRejectedValueOnce(err);

    renderPage();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Something Went Wrong");
      expect(screen.getByText("All Products List")).toBeInTheDocument();
    });

    expect(spy).toHaveBeenCalledWith(err);
    spy.mockRestore();
  });

  // large data sanity
  test("renders a large list without refetching on re-render", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      _id: `id${i}`,
      name: `Product ${i}`,
      slug: `product-${i}`,
      description: `Desc ${i}`,
    }));
    axios.get.mockResolvedValueOnce({ data: { products: many } });

    const { rerender } = renderPage();

    expect(await screen.findByText("Product 0")).toBeInTheDocument();
    expect(screen.getByText("Product 29")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(1);

    // re-render with same tree → should not refetch
    rerender(
      <Providers>
        <Products />
      </Providers>
    );
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  // Layout/AdminMenu smoke (integration presence only)
  test("renders within Layout + AdminMenu", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByText("Admin Menu")).toBeInTheDocument();
      expect(screen.getByText("All Products List")).toBeInTheDocument();
    });
  });
});

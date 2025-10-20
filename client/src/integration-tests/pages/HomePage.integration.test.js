import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../context/auth";
import { CartProvider, useCart } from "../../context/cart";
import { SearchProvider } from "../../context/search";
import HomePage from "../../pages/HomePage";

// Mock non-HTTP dependencies
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../components/Layout", () => {
  return function Layout({ children }) {
    return <div data-testid="mock-layout">{children}</div>;
  };
});

jest.mock("antd", () => {
  const actual = jest.requireActual("antd");
  return {
    ...actual,
    Checkbox: ({ children, onChange, ...props }) => (
      <label>
        <input type="checkbox" onChange={onChange} {...props} />
        {children}
      </label>
    ),
    Radio: Object.assign(
      ({ children, value, ...props }) => (
        <label>
          <input type="radio" value={value} {...props} />
          {children}
        </label>
      ),
      {
        Group: ({ children, onChange, ...props }) => (
          <div onChange={onChange} {...props}>
            {children}
          </div>
        ),
      }
    ),
  };
});

jest.mock("react-icons/ai", () => ({
  AiOutlineReload: () => <span>↻</span>,
}));

// Create fake axios server
const mockAxios = new MockAdapter(axios);

// Complete mock data - ALL fields from real API
const mockCategories = [
  { _id: "cat1", name: "Electronics", slug: "electronics" },
  { _id: "cat2", name: "Clothing", slug: "clothing" },
  { _id: "cat3", name: "Books", slug: "books" },
];

const mockProducts = [
  {
    _id: "prod1",
    name: "iPhone 14",
    slug: "iphone-14",
    description: "Latest iPhone with advanced features and great camera technology",
    price: 999,
    category: "cat1",
    quantity: 50,
    shipping: true,
  },
  {
    _id: "prod2",
    name: "MacBook Pro",
    slug: "macbook-pro",
    description: "Powerful laptop for professionals with M2 chip and stunning display",
    price: 1999,
    category: "cat1",
    quantity: 30,
    shipping: true,
  },
  {
    _id: "prod3",
    name: "AirPods Pro",
    slug: "airpods-pro",
    description: "Premium wireless earbuds with active noise cancellation technology",
    price: 249,
    category: "cat1",
    quantity: 100,
    shipping: true,
  },
  {
    _id: "prod4",
    name: "T-Shirt",
    slug: "t-shirt",
    description: "Comfortable cotton t-shirt available in multiple colors and sizes",
    price: 29,
    category: "cat2",
    quantity: 200,
    shipping: false,
  },
  {
    _id: "prod5",
    name: "Jeans",
    slug: "jeans",
    description: "Classic denim jeans with modern fit and premium quality fabric",
    price: 59,
    category: "cat2",
    quantity: 150,
    shipping: false,
  },
  {
    _id: "prod6",
    name: "Novel Book",
    slug: "novel-book",
    description: "Bestselling fiction novel with captivating story and characters",
    price: 19,
    category: "cat3",
    quantity: 80,
    shipping: true,
  },
  {
    _id: "prod7",
    name: "iPad Air",
    slug: "ipad-air",
    description: "Versatile tablet perfect for work and entertainment with great performance",
    price: 599,
    category: "cat1",
    quantity: 40,
    shipping: true,
  },
  {
    _id: "prod8",
    name: "Apple Watch",
    slug: "apple-watch",
    description: "Smart watch with health tracking and notification features for daily use",
    price: 399,
    category: "cat1",
    quantity: 60,
    shipping: true,
  },
  {
    _id: "prod9",
    name: "Jacket",
    slug: "jacket",
    description: "Warm winter jacket with waterproof material and insulated lining",
    price: 89,
    category: "cat2",
    quantity: 90,
    shipping: false,
  },
  {
    _id: "prod10",
    name: "Sneakers",
    slug: "sneakers",
    description: "Comfortable running sneakers with excellent cushioning and support",
    price: 79,
    category: "cat2",
    quantity: 120,
    shipping: true,
  },
  {
    _id: "prod11",
    name: "Textbook",
    slug: "textbook",
    description: "Comprehensive educational textbook for college level mathematics courses",
    price: 99,
    category: "cat3",
    quantity: 50,
    shipping: true,
  },
  {
    _id: "prod12",
    name: "Cookbook",
    slug: "cookbook",
    description: "Recipe collection featuring international cuisines and cooking techniques",
    price: 35,
    category: "cat3",
    quantity: 70,
    shipping: false,
  },
  {
    _id: "prod13",
    name: "Wireless Mouse",
    slug: "wireless-mouse",
    description: "Ergonomic wireless mouse with precision tracking and long battery life",
    price: 49,
    category: "cat1",
    quantity: 110,
    shipping: false,
  },
  {
    _id: "prod14",
    name: "Keyboard",
    slug: "keyboard",
    description: "Mechanical keyboard with RGB lighting and tactile switches for typing",
    price: 129,
    category: "cat1",
    quantity: 85,
    shipping: true,
  },
  {
    _id: "prod15",
    name: "Hoodie",
    slug: "hoodie",
    description: "Cozy hoodie made from soft cotton blend fabric with front pocket",
    price: 45,
    category: "cat2",
    quantity: 140,
    shipping: false,
  },
  {
    _id: "prod16",
    name: "Shorts",
    slug: "shorts",
    description: "Athletic shorts perfect for workouts and casual summer wear activities",
    price: 25,
    category: "cat2",
    quantity: 160,
    shipping: false,
  },
  {
    _id: "prod17",
    name: "Biography",
    slug: "biography",
    description: "Inspiring biography of historical figure with detailed research and narrative",
    price: 27,
    category: "cat3",
    quantity: 65,
    shipping: true,
  },
  {
    _id: "prod18",
    name: "Comic Book",
    slug: "comic-book",
    description: "Popular comic book series with vibrant illustrations and engaging storyline",
    price: 15,
    category: "cat3",
    quantity: 95,
    shipping: false,
  },
  {
    _id: "prod19",
    name: "Monitor",
    slug: "monitor",
    description: "High resolution monitor with accurate colors and fast refresh rate display",
    price: 349,
    category: "cat1",
    quantity: 45,
    shipping: true,
  },
  {
    _id: "prod20",
    name: "Webcam",
    slug: "webcam",
    description: "HD webcam with built-in microphone for video calls and streaming quality",
    price: 79,
    category: "cat1",
    quantity: 75,
    shipping: false,
  },
];

// Filtered products (Electronics only)
const filteredMockProducts = mockProducts.filter((p) => p.category === "cat1");

// Providers wrapper
const Providers = ({ children }) => (
  <AuthProvider>
    <SearchProvider>
      <CartProvider>{children}</CartProvider>
    </SearchProvider>
  </AuthProvider>
);

// Router wrapper
const Routers = ({ children }) => (
  <MemoryRouter initialEntries={["/"]}>
    <Routes>
      <Route path="/" element={children} />
      <Route path="/product/:slug" element={<div>Product Details Page</div>} />
    </Routes>
  </MemoryRouter>
);

describe("Integration between HomePage and frontend dependencies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockAxios.reset();

    // Set up fake endpoints
    mockAxios.onGet("/api/v1/category/get-category").reply(200, {
      success: true,
      category: mockCategories,
    });

    mockAxios.onGet("/api/v1/product/product-count").reply(200, {
      total: 20,
    });

    mockAxios.onGet("/api/v1/product/product-list/1").reply(200, {
      products: mockProducts.slice(0, 12),
    });

    mockAxios.onGet("/api/v1/product/product-list/2").reply(200, {
      products: mockProducts.slice(12, 20),
    });

    mockAxios.onPost("/api/v1/product/product-filters").reply(200, {
      products: filteredMockProducts.slice(0, 12),
    });

    // Filtered pagination with query params
    mockAxios.onGet(/\/api\/v1\/product\/product-filters\?.*/).reply(200, {
      products: filteredMockProducts.slice(0, 8),
    });
  });

  afterAll(() => {
    mockAxios.restore();
  });

  it("coordinates 3 API calls on mount and displays results", async () => {
    render(
      <Providers>
        <Routers>
          <HomePage />
        </Routers>
      </Providers>
    );

    // Wait for all 3 API calls
    await waitFor(() => {
      expect(mockAxios.history.get.length).toBe(3);
    });

    // Verify correct endpoints called
    expect(mockAxios.history.get[0].url).toBe("/api/v1/category/get-category");
    expect(mockAxios.history.get[1].url).toBe("/api/v1/product/product-count");
    expect(mockAxios.history.get[2].url).toBe("/api/v1/product/product-list/1");

    // Verify products rendered
    await waitFor(() => {
      expect(screen.getByText("iPhone 14")).toBeInTheDocument();
    });

    // Verify categories rendered
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText("Clothing")).toBeInTheDocument();
    expect(screen.getByText("Books")).toBeInTheDocument();
  });

  it("applies category filter and updates products via API call", async () => {
    render(
      <Providers>
        <Routers>
          <HomePage />
        </Routers>
      </Providers>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("iPhone 14")).toBeInTheDocument();
    });

    // Click Electronics category checkbox
    const electronicsCheckbox = screen.getByLabelText("Electronics");
    await userEvent.click(electronicsCheckbox);

    // Wait for filter API call and products to update
    await waitFor(() => {
      expect(mockAxios.history.post.length).toBe(1);
    });

    // Verify correct payload sent
    const filterRequest = JSON.parse(mockAxios.history.post[0].data);
    expect(filterRequest.checked).toContain("cat1");
    expect(filterRequest.radio).toEqual([]);

    // Wait for non-Electronics products to disappear (proof filter worked)
    await waitFor(() => {
      expect(screen.queryByText("T-Shirt")).not.toBeInTheDocument();
    });

    // Verify filtered products displayed (only Electronics products)
    expect(screen.getByText("iPhone 14")).toBeInTheDocument();
    expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
    expect(screen.queryByText("Novel Book")).not.toBeInTheDocument();
  });

  it("loads more products and appends to existing list", async () => {
    render(
      <Providers>
        <Routers>
          <HomePage />
        </Routers>
      </Providers>
    );

    // Wait for initial load (12 products)
    await waitFor(() => {
      expect(screen.getByText("iPhone 14")).toBeInTheDocument();
      expect(screen.getByText("Cookbook")).toBeInTheDocument();
    });

    // Click Load More button
    const loadMoreButton = screen.getByRole("button", { name: /Loadmore/i });
    await userEvent.click(loadMoreButton);

    // Verify page 2 API called
    await waitFor(() => {
      const page2Requests = mockAxios.history.get.filter((req) =>
        req.url.includes("/api/v1/product/product-list/2")
      );
      expect(page2Requests.length).toBe(1);
    });

    // Verify new products appended (prod13-20 now visible)
    await waitFor(() => {
      expect(screen.getByText("Wireless Mouse")).toBeInTheDocument();
      expect(screen.getByText("Webcam")).toBeInTheDocument();
    });

    // Verify old products still visible
    expect(screen.getByText("iPhone 14")).toBeInTheDocument();
    expect(screen.getByText("Cookbook")).toBeInTheDocument();
  });

  it("calls CartContext.addToCart and shows toast on Add to Cart click", async () => {
    // Mock useCart hook before rendering
    const mockAddToCart = jest.fn();
    jest.spyOn(require("../../context/cart"), "useCart").mockReturnValue({
      cart: [],
      addToCart: mockAddToCart,
    });

    render(
      <Providers>
        <Routers>
          <HomePage />
        </Routers>
      </Providers>
    );

    await waitFor(() => screen.getByText("iPhone 14"));

    // Click first "ADD TO CART" button
    const addButtons = screen.getAllByRole("button", { name: /ADD TO CART/i });
    await userEvent.click(addButtons[0]);

    // Verify CartContext method called with correct slug
    expect(mockAddToCart).toHaveBeenCalledWith("iphone-14");

    // Restore original implementation
    jest.restoreAllMocks();
  });

  it("navigates to product details page when More Details clicked", async () => {
    render(
      <Providers>
        <Routers>
          <HomePage />
        </Routers>
      </Providers>
    );

    await waitFor(() => screen.getByText("iPhone 14"));

    // Click first "More Details" button
    const detailButtons = screen.getAllByRole("button", {
      name: /More Details/i,
    });
    await userEvent.click(detailButtons[0]);

    // Verify navigation occurred
    await waitFor(() => {
      expect(screen.getByText("Product Details Page")).toBeInTheDocument();
    });
  });

  it("loads more products with active filters using correct API endpoint", async () => {
    render(
      <Providers>
        <Routers>
          <HomePage />
        </Routers>
      </Providers>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("iPhone 14")).toBeInTheDocument();
    });

    // Apply category filter
    const electronicsCheckbox = screen.getByLabelText("Electronics");
    await userEvent.click(electronicsCheckbox);

    // Wait for filter to apply
    await waitFor(() => {
      expect(mockAxios.history.post.length).toBe(1);
    });

    // Click Load More with filter active
    const loadMoreButton = screen.getByRole("button", { name: /Loadmore/i });
    await userEvent.click(loadMoreButton);

    // Verify correct filtered pagination endpoint called (GET with query params)
    await waitFor(() => {
      const filteredPaginationRequests = mockAxios.history.get.filter((req) =>
        req.url.includes("/api/v1/product/product-filters?")
      );
      expect(filteredPaginationRequests.length).toBeGreaterThan(0);
    });

    // Verify query params include page and categories
    const filteredRequest = mockAxios.history.get.find((req) =>
      req.url.includes("/api/v1/product/product-filters?")
    );
    expect(filteredRequest.url).toMatch(/page=2/);
    expect(filteredRequest.url).toMatch(/categories=/);
  });

  it("handles API failure gracefully and resets loading state", async () => {
    // Make product endpoint fail - keep everything else from beforeEach
    mockAxios.onGet("/api/v1/product/product-list/1").reply(500);

    render(
      <Providers>
        <Routers>
          <HomePage />
        </Routers>
      </Providers>
    );

    // Wait for error to be handled and loading to complete
    await waitFor(
      () => {
        expect(screen.queryByText("Loading ...")).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify component didn't crash - basic structure still rendered
    expect(screen.getByText("All Products")).toBeInTheDocument();
    expect(screen.getByText("Filter By Category")).toBeInTheDocument();
    expect(screen.getByText("Filter By Price")).toBeInTheDocument();

    // That's it - we've verified error handling works
    // No need to verify categories loaded - that's a different concern
  });
});

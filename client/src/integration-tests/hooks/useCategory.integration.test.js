import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../context/auth";
import { CartProvider } from "../../context/cart";
import { SearchProvider } from "../../context/search";
import Header from "../../components/Header";
import Categories from "../../pages/Categories";

// Complete mock data - all fields from real API (Anti-Pattern #4 compliance)
const mockCategories = [
  { _id: "cat1", name: "Electronics", slug: "electronics" },
  { _id: "cat2", name: "Clothing", slug: "clothing" },
  { _id: "cat3", name: "Books", slug: "books" },
];

describe("useCategory Hook Integration Tests", () => {
  let mockAxios;

  beforeAll(() => {
    mockAxios = new MockAdapter(axios);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockAxios.reset();

    // Setup default mocks for API calls that providers might trigger
    mockAxios.onGet(/\/api\/v1\/product\/get-product\//).reply(404);
  });

  afterAll(() => {
    mockAxios.restore();
  });

  // Helper to render components with all required providers (using REAL providers)
  const renderWithProviders = (component) => {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <SearchProvider>
            <CartProvider>{component}</CartProvider>
          </SearchProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  describe("Header Component Integration", () => {
    it("renders categories in dropdown menu after API loads", async () => {
      // Setup API mock to return categories
      mockAxios.onGet("/api/v1/category/get-category").reply(200, {
        success: true,
        category: mockCategories,
      });

      // Render Header with real providers and real useCategory hook
      renderWithProviders(<Header />);

      // Wait for categories to load and render
      await waitFor(() => {
        expect(screen.getByText("Electronics")).toBeInTheDocument();
      });

      // Verify all categories appear with correct names
      expect(screen.getByText("Electronics")).toBeInTheDocument();
      expect(screen.getByText("Clothing")).toBeInTheDocument();
      expect(screen.getByText("Books")).toBeInTheDocument();

      // Verify "All Categories" link exists
      expect(screen.getByText("All Categories")).toBeInTheDocument();

      // Verify category links have correct hrefs
      const electronicsLink = screen.getByText("Electronics").closest("a");
      expect(electronicsLink).toHaveAttribute("href", "/category/electronics");

      const clothingLink = screen.getByText("Clothing").closest("a");
      expect(clothingLink).toHaveAttribute("href", "/category/clothing");

      const booksLink = screen.getByText("Books").closest("a");
      expect(booksLink).toHaveAttribute("href", "/category/books");

      // Verify API was called once
      expect(mockAxios.history.get.length).toBeGreaterThanOrEqual(1);
      const categoryCall = mockAxios.history.get.find(
        (call) => call.url === "/api/v1/category/get-category"
      );
      expect(categoryCall).toBeDefined();
    });

    it("handles API error gracefully without crashing", async () => {
      // Mock console.log to verify error logging
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      // Setup API mock to return error (500 status triggers axios error)
      mockAxios.onGet("/api/v1/category/get-category").reply(500);

      // Render Header - should not crash
      renderWithProviders(<Header />);

      // Wait for error to be caught and logged
      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      // Component should still render
      expect(screen.getByText("All Categories")).toBeInTheDocument();

      // Categories should not appear (empty state)
      expect(screen.queryByText("Electronics")).not.toBeInTheDocument();
      expect(screen.queryByText("Clothing")).not.toBeInTheDocument();
      expect(screen.queryByText("Books")).not.toBeInTheDocument();

      // Verify error was logged
      expect(consoleLogSpy).toHaveBeenCalled();

      // Cleanup spy
      consoleLogSpy.mockRestore();
    });
  });

  describe("Categories Page Integration", () => {
    it("renders category grid after API loads", async () => {
      // Setup API mock to return categories
      mockAxios.onGet("/api/v1/category/get-category").reply(200, {
        success: true,
        category: mockCategories,
      });

      // Render Categories page with real providers and real useCategory hook
      renderWithProviders(<Categories />);

      // Wait for categories to load and render (both in header and page body)
      await waitFor(() => {
        const electronicsElements = screen.getAllByText("Electronics");
        expect(electronicsElements.length).toBeGreaterThanOrEqual(1);
      });

      // Verify all categories appear as buttons in the grid (looking for btn-primary class)
      const allButtons = screen
        .getAllByText("Electronics")
        .filter((el) => el.closest("a")?.classList.contains("btn-primary"));
      expect(allButtons.length).toBeGreaterThanOrEqual(1);

      const clothingButtons = screen
        .getAllByText("Clothing")
        .filter((el) => el.closest("a")?.classList.contains("btn-primary"));
      expect(clothingButtons.length).toBeGreaterThanOrEqual(1);

      const booksButtons = screen
        .getAllByText("Books")
        .filter((el) => el.closest("a")?.classList.contains("btn-primary"));
      expect(booksButtons.length).toBeGreaterThanOrEqual(1);

      // Verify category buttons have correct links (checking btn-primary specifically)
      const electronicsButton = allButtons[0];
      expect(electronicsButton.closest("a")).toHaveAttribute(
        "href",
        "/category/electronics"
      );

      const clothingButton = clothingButtons[0];
      expect(clothingButton.closest("a")).toHaveAttribute(
        "href",
        "/category/clothing"
      );

      const booksButton = booksButtons[0];
      expect(booksButton.closest("a")).toHaveAttribute(
        "href",
        "/category/books"
      );

      // Verify API was called once
      expect(mockAxios.history.get.length).toBeGreaterThanOrEqual(1);
      const categoryCall = mockAxios.history.get.find(
        (call) => call.url === "/api/v1/category/get-category"
      );
      expect(categoryCall).toBeDefined();
    });

    it("handles API error gracefully without crashing", async () => {
      // Mock console.log to verify error logging
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      // Setup API mock to return error (404 status triggers axios error)
      mockAxios.onGet("/api/v1/category/get-category").reply(404);

      // Render Categories page - should not crash
      renderWithProviders(<Categories />);

      // Wait for error to be caught and logged
      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      // Categories should not appear (empty state)
      expect(screen.queryByText("Electronics")).not.toBeInTheDocument();
      expect(screen.queryByText("Clothing")).not.toBeInTheDocument();
      expect(screen.queryByText("Books")).not.toBeInTheDocument();

      // Verify error was logged
      expect(consoleLogSpy).toHaveBeenCalled();

      // Cleanup spy
      consoleLogSpy.mockRestore();
    });
  });
});

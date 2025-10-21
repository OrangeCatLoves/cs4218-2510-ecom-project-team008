import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import Categories from "../../pages/Categories";
import { AuthProvider } from "../../context/auth";
import { CartProvider } from "../../context/cart";
import { SearchProvider } from "../../context/search";

const mockCategories = [
  { _id: "cat1", name: "Electronics", slug: "electronics" },
  { _id: "cat2", name: "Clothing", slug: "clothing" },
  { _id: "cat3", name: "Books", slug: "books" },
];

describe("Categories Page Integration Tests", () => {
  let mockAxios;

  beforeAll(() => {
    mockAxios = new MockAdapter(axios);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockAxios.reset();
  });

  afterAll(() => {
    mockAxios.restore();
  });

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

  it("renders categories with correct links to category pages", async () => {
    mockAxios.onGet("/api/v1/category/get-category").reply(200, {
      success: true,
      category: mockCategories,
    });

    renderWithProviders(<Categories />);

    // Wait for API call to complete and state to settle
    await waitFor(() => {
      const categoryCall = mockAxios.history.get.find(
        (call) => call.url === "/api/v1/category/get-category"
      );
      expect(categoryCall).toBeDefined();
    });

    // Wait for API call and render
    await waitFor(() => {
      const allElectronics = screen.getAllByText("Electronics");
      expect(allElectronics.length).toBeGreaterThanOrEqual(1);
    });

    // Get category buttons from the page (not header dropdown)
    const categoryButtons = screen.getAllByRole("link").filter((link) =>
      link.classList.contains("btn-primary")
    );

    // Verify all 3 categories rendered as buttons
    expect(categoryButtons.length).toBe(3);

    // Verify links point to correct slugs
    const electronicsLink = categoryButtons.find((btn) =>
      btn.textContent.includes("Electronics")
    );
    expect(electronicsLink).toHaveAttribute("href", "/category/electronics");

    const clothingLink = categoryButtons.find((btn) =>
      btn.textContent.includes("Clothing")
    );
    expect(clothingLink).toHaveAttribute("href", "/category/clothing");

    const booksLink = categoryButtons.find((btn) =>
      btn.textContent.includes("Books")
    );
    expect(booksLink).toHaveAttribute("href", "/category/books");
  });

  it("handles empty categories array without crashing", async () => {
    mockAxios.onGet("/api/v1/category/get-category").reply(200, {
      success: true,
      category: [],
    });

    renderWithProviders(<Categories />);

    // Wait for API call to complete and state to settle
    await waitFor(() => {
      const categoryCall = mockAxios.history.get.find(
        (call) => call.url === "/api/v1/category/get-category"
      );
      expect(categoryCall).toBeDefined();
    });

    // Wait for API call to complete
    await waitFor(() => {
      expect(mockAxios.history.get.length).toBeGreaterThan(0);
    });

    // Verify no category buttons appear on the page
    const categoryButtons = screen.getAllByRole("link").filter((link) =>
      link.classList.contains("btn-primary")
    );
    expect(categoryButtons.length).toBe(0);

    // Verify page title still renders (Layout component works)
    expect(screen.getByText("All Categories")).toBeInTheDocument();
  });

  it("renders page within Layout component with correct title", async () => {
    mockAxios.onGet("/api/v1/category/get-category").reply(200, {
      success: true,
      category: mockCategories,
    });

    renderWithProviders(<Categories />);

    // Wait for API call to complete and state to settle
    await waitFor(() => {
      const categoryCall = mockAxios.history.get.find(
        (call) => call.url === "/api/v1/category/get-category"
      );
      expect(categoryCall).toBeDefined();
    });

    await waitFor(() => {
      const allElectronics = screen.getAllByText("Electronics");
      expect(allElectronics.length).toBeGreaterThanOrEqual(1);
    });

    // Verify Layout title is set (appears in document)
    expect(screen.getByText("All Categories")).toBeInTheDocument();

    // Verify categories appear within the container structure
    const categoryButtons = screen.getAllByRole("link").filter((link) =>
      link.classList.contains("btn-primary")
    );
    const electronicsButton = categoryButtons.find((btn) =>
      btn.textContent.includes("Electronics")
    );
    expect(electronicsButton.closest(".container")).toBeInTheDocument();
  });
});

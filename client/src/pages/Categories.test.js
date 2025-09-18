import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import axios from "axios";
import Categories from "./Categories";

// Mock axios
jest.mock("axios");

// Mock the Layout component to simplify testing
jest.mock("../components/Layout", () => {
  return function MockLayout({ children, title }) {
    return (
      <div data-testid="layout">
        <h1>{title}</h1>
        {children}
      </div>
    );
  };
});

// Mock the useCategory hook
jest.mock("../hooks/useCategory");

describe("Categories Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render the page title", () => {
    // Arrange
    const mockUseCategory = require("../hooks/useCategory").default;
    mockUseCategory.mockReturnValue([[], jest.fn()]);

    // Act
    const { getByText } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    expect(getByText("All Categories")).toBeInTheDocument();
  });

  it("should render categories list when categories are available", async () => {
    // Arrange
    const mockCategories = [
      { _id: "1", name: "Electronics", slug: "electronics" },
      { _id: "2", name: "Clothing", slug: "clothing" },
      { _id: "3", name: "Books", slug: "books" }
    ];
    const mockUseCategory = require("../hooks/useCategory").default;
    mockUseCategory.mockReturnValue([mockCategories, jest.fn()]);

    // Act
    const { getByText } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    expect(getByText("Electronics")).toBeInTheDocument();
    expect(getByText("Clothing")).toBeInTheDocument();
    expect(getByText("Books")).toBeInTheDocument();
  });

  it("should create correct navigation links for categories", () => {
    // Arrange
    const mockCategories = [
      { _id: "1", name: "Electronics", slug: "electronics" },
      { _id: "2", name: "Clothing", slug: "clothing" }
    ];
    const mockUseCategory = require("../hooks/useCategory").default;
    mockUseCategory.mockReturnValue([mockCategories, jest.fn()]);

    // Act
    const { getByRole } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    const electronicsLink = getByRole("link", { name: "Electronics" });
    const clothingLink = getByRole("link", { name: "Clothing" });

    expect(electronicsLink).toHaveAttribute("href", "/category/electronics");
    expect(clothingLink).toHaveAttribute("href", "/category/clothing");
  });

  it("should render categories with correct CSS classes", () => {
    // Arrange
    const mockCategories = [
      { _id: "1", name: "Electronics", slug: "electronics" }
    ];
    const mockUseCategory = require("../hooks/useCategory").default;
    mockUseCategory.mockReturnValue([mockCategories, jest.fn()]);

    // Act
    const { getByRole } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    const link = getByRole("link", { name: "Electronics" });
    expect(link).toHaveClass("btn", "btn-primary");
  });

  it("should render empty list when no categories are available", () => {
    // Arrange
    const mockUseCategory = require("../hooks/useCategory").default;
    mockUseCategory.mockReturnValue([[], jest.fn()]);

    // Act
    const { container } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    const categoryLinks = container.querySelectorAll(".btn-primary");
    expect(categoryLinks).toHaveLength(0);
  });

  it("should handle categories with special characters in names", () => {
    // Arrange
    const mockCategories = [
      { _id: "1", name: "Electronics & Gadgets", slug: "electronics-gadgets" },
      { _id: "2", name: "Home & Garden", slug: "home-garden" }
    ];
    const mockUseCategory = require("../hooks/useCategory").default;
    mockUseCategory.mockReturnValue([mockCategories, jest.fn()]);

    // Act
    const { getByText } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    expect(getByText("Electronics & Gadgets")).toBeInTheDocument();
    expect(getByText("Home & Garden")).toBeInTheDocument();
  });

  it("should render correct grid structure for categories", () => {
    // Arrange
    const mockCategories = [
      { _id: "1", name: "Electronics", slug: "electronics" },
      { _id: "2", name: "Clothing", slug: "clothing" }
    ];
    const mockUseCategory = require("../hooks/useCategory").default;
    mockUseCategory.mockReturnValue([mockCategories, jest.fn()]);

    // Act
    const { container } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    const row = container.querySelector(".row");
    const columns = container.querySelectorAll(".col-md-6");

    expect(row).toBeInTheDocument();
    expect(columns).toHaveLength(2);
  });

  it("should use the useCategory hook correctly", () => {
    // Arrange
    const mockUseCategory = require("../hooks/useCategory").default;
    mockUseCategory.mockReturnValue([[], jest.fn()]);

    // Act
    render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    expect(mockUseCategory).toHaveBeenCalledTimes(1);
  });

  it("should render multiple categories correctly", () => {
    // Arrange
    const mockCategories = Array.from({ length: 10 }, (_, i) => ({
      _id: `${i + 1}`,
      name: `Category ${i + 1}`,
      slug: `category-${i + 1}`
    }));
    const mockUseCategory = require("../hooks/useCategory").default;
    mockUseCategory.mockReturnValue([mockCategories, jest.fn()]);

    // Act
    const { container } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    const categoryLinks = container.querySelectorAll(".btn-primary");
    expect(categoryLinks).toHaveLength(10);

    // Verify first and last categories
    expect(container.querySelector('[href="/category/category-1"]')).toBeInTheDocument();
    expect(container.querySelector('[href="/category/category-10"]')).toBeInTheDocument();
  });
});
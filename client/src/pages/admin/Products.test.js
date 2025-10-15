import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import React from "react";
import Products from "./Products";

// mock axios
jest.mock("axios", () => ({
  get: jest.fn(),
}));

// mock toast
jest.mock("react-hot-toast", () => ({
  error: jest.fn(),
}));

// mock Layout component
jest.mock("../../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

// mock AdminMenu component
jest.mock("../../components/AdminMenu", () => () => (
  <nav data-testid="admin-menu" />
));

// helper to render with Router
const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("Products Component - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // component rendering tests
  describe("Component Rendering", () => {
    test("renders layout with admin menu", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: { products: [] } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
    });

    test("renders heading 'All Products List'", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: { products: [] } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      const heading = await screen.findByRole("heading", {
        name: /all products list/i,
      });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveClass("text-center");
    });

    test("renders empty state when no products", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: { products: [] } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByRole("heading", { name: /all products list/i });
      const links = screen.queryAllByRole("link");
      expect(links.length).toBe(0);
    });
  });

  // data fetching tests
  describe("Data Fetching on Mount", () => {
    test("fetches products on component mount", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "prod1",
          name: "Laptop",
          slug: "laptop",
          description: "Gaming laptop",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith("/api/v1/product/get-product");
        expect(axios.get).toHaveBeenCalledTimes(1);
      });
    });

    test("displays products after successful fetch", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "prod1",
          name: "MacBook Pro",
          slug: "macbook-pro",
          description: "Apple laptop with M1 chip",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByText("MacBook Pro");
      expect(screen.getByText("Apple laptop with M1 chip")).toBeInTheDocument();
    });

    test("displays error toast when fetch fails", async () => {
      // Arrange
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      axios.get.mockRejectedValueOnce(new Error("Network error"));

      // Act
      renderWithRouter(<Products />);

      // Assert
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Something Went Wrong");
      });
      consoleSpy.mockRestore();
    });

    test("handles missing products field with fallback to empty array", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: {} });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByRole("heading", { name: /all products list/i });
      const links = screen.queryAllByRole("link");
      expect(links.length).toBe(0);
    });

    test("handles null data response gracefully", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: null });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByRole("heading", { name: /all products list/i });
      const links = screen.queryAllByRole("link");
      expect(links.length).toBe(0);
    });
  });

  // product display tests
  describe("Product Display", () => {
    test("renders product card with correct structure", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "prod1",
          name: "iPhone 15",
          slug: "iphone-15",
          description: "Latest iPhone model",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByText("iPhone 15");
      const card = screen.getByText("iPhone 15").closest(".card");
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass("m-2");
      expect(card).toHaveStyle({ width: "18rem" });
    });

    test("renders product image with correct src and alt", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "prod123",
          name: "Samsung TV",
          slug: "samsung-tv",
          description: "4K Smart TV",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByText("Samsung TV");
      const img = screen.getByAltText("Samsung TV");
      expect(img).toHaveAttribute(
        "src",
        "/api/v1/product/product-photo/prod123"
      );
      expect(img).toHaveClass("card-img-top");
    });

    test("renders product name in card title", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "prod1",
          name: "Sony Headphones",
          slug: "sony-headphones",
          description: "Noise cancelling headphones",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      const title = await screen.findByText("Sony Headphones");
      expect(title).toHaveClass("card-title");
      expect(title.tagName).toBe("H5");
    });

    test("renders product description in card text", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "prod1",
          name: "Camera",
          slug: "camera",
          description: "Professional DSLR camera",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      const description = await screen.findByText("Professional DSLR camera");
      expect(description).toHaveClass("card-text");
      expect(description.tagName).toBe("P");
    });

    test("wraps product card in Link with correct route", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "prod1",
          name: "Tablet",
          slug: "ipad-air",
          description: "Apple iPad Air",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByText("Tablet");
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/dashboard/admin/product/ipad-air");
      expect(link).toHaveClass("product-link");
    });

    test("renders multiple products correctly", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "prod1",
          name: "Product A",
          slug: "product-a",
          description: "Description A",
        },
        {
          _id: "prod2",
          name: "Product B",
          slug: "product-b",
          description: "Description B",
        },
        {
          _id: "prod3",
          name: "Product C",
          slug: "product-c",
          description: "Description C",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByText("Product A");
      expect(screen.getByText("Product B")).toBeInTheDocument();
      expect(screen.getByText("Product C")).toBeInTheDocument();
      const links = screen.getAllByRole("link");
      expect(links.length).toBe(3);
    });
  });

  // edge cases
  describe("Edge Cases and Boundary Conditions", () => {
    test("handles product with empty description", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "prod1",
          name: "Widget",
          slug: "widget",
          description: "",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByText("Widget");
      const card = screen.getByText("Widget").closest(".card");
      const descEl = card.querySelector(".card-text");
      expect(descEl).toBeInTheDocument();
      expect(descEl.textContent).toBe("");
    });

    test("handles product with very long description", async () => {
      // Arrange
      const longDesc = "A".repeat(500);
      const mockProducts = [
        {
          _id: "prod1",
          name: "Book",
          slug: "book",
          description: longDesc,
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByText("Book");
      expect(screen.getByText(longDesc)).toBeInTheDocument();
    });

    test("handles product with special characters in name", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "prod1",
          name: "Product & Co. <Special>",
          slug: "product-co-special",
          description: "Special chars test",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByText("Product & Co. <Special>");
      expect(screen.getByText("Product & Co. <Special>")).toBeInTheDocument();
    });

    test("handles single product correctly", async () => {
      // Arrange
      const mockProducts = [
        {
          _id: "only1",
          name: "Only Product",
          slug: "only-product",
          description: "The only one",
        },
      ];
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByText("Only Product");
      const links = screen.getAllByRole("link");
      expect(links.length).toBe(1);
    });

    test("handles very large product list efficiently", async () => {
      // Arrange
      const mockProducts = Array.from({ length: 100 }, (_, i) => ({
        _id: `prod${i}`,
        name: `Product ${i}`,
        slug: `product-${i}`,
        description: `Description for product ${i}`,
      }));
      axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByText("Product 0");
      expect(screen.getByText("Product 99")).toBeInTheDocument();
      const links = screen.getAllByRole("link");
      expect(links.length).toBe(100);
    });
  });

  // error handling tests
  describe("Error Handling", () => {
    test("displays error toast on network failure", async () => {
      // Arrange
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      axios.get.mockRejectedValueOnce(new Error("Network timeout"));

      // Act
      renderWithRouter(<Products />);

      // Assert
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Something Went Wrong");
      });
      consoleSpy.mockRestore();
    });

    test("displays error toast on 500 server error", async () => {
      // Arrange
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      axios.get.mockRejectedValueOnce({
        response: { status: 500, data: { message: "Internal server error" } },
      });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Something Went Wrong");
      });
      consoleSpy.mockRestore();
    });

    test("displays error toast on 404 not found", async () => {
      // Arrange
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      axios.get.mockRejectedValueOnce({
        response: { status: 404, data: { message: "Not found" } },
      });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Something Went Wrong");
      });
      consoleSpy.mockRestore();
    });

    test("does not crash when API returns unexpected structure", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ unexpected: "structure" });

      // Act
      renderWithRouter(<Products />);

      // Assert
      await screen.findByRole("heading", { name: /all products list/i });
      expect(screen.queryAllByRole("link").length).toBe(0);
    });
  });
});

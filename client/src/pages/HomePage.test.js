import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import axios from "axios";
import toast from "react-hot-toast";
import HomePage from "./HomePage";

// Mock axios
jest.mock("axios");

// Mock react-hot-toast
jest.mock("react-hot-toast");

// Mock context providers
jest.mock("../context/cart", () => ({
  useCart: jest.fn(),
}));

// Mock the Layout component
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

// Mock Prices component
jest.mock("../components/Prices", () => ({
  Prices: [
    { _id: "1", name: "$0 to 19", array: [0, 19] },
    { _id: "2", name: "$20 to 39", array: [20, 39] },
    { _id: "3", name: "$40 to 99", array: [40, 99] },
  ],
}));

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Mock antd components
jest.mock("antd", () => {
  const RadioComponent = ({ children, value, ...props }) => (
    <label>
      <input
        type="radio"
        value={JSON.stringify(value)}
        data-testid={`radio-${children}`}
        {...props}
      />
      {children}
    </label>
  );

  RadioComponent.Group = ({ children, onChange, ...props }) => {
    const handleChange = (e) => {
      // Create a new event with the selected radio's value
      const radioValue = e.target.value;
      const newEvent = {
        target: { value: JSON.parse(radioValue) }
      };
      onChange(newEvent);
    };

    return (
      <div data-testid="radio-group" onChange={handleChange} {...props}>
        {children}
      </div>
    );
  };

  return {
    Checkbox: ({ children, onChange, ...props }) => {
      const handleChange = (e) => {
        // Create proper event object for checkbox
        const newEvent = {
          target: {
            checked: e.target.checked
          }
        };
        onChange(newEvent);
      };

      return (
        <label>
          <input
            type="checkbox"
            onChange={handleChange}
            data-testid={`checkbox-${children}`}
            {...props}
          />
          {children}
        </label>
      );
    },
    Radio: RadioComponent,
  };
});

// Mock react-icons
jest.mock("react-icons/ai", () => ({
  AiOutlineReload: () => <span data-testid="reload-icon">⟳</span>,
}));

describe("HomePage Component", () => {
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Setup useCart mock with default return value
    const { useCart } = require("../context/cart");
    useCart.mockReturnValue([[], jest.fn()]);

    // Mock window.location.reload
    delete window.location;
    window.location = { reload: jest.fn() };
  });

  beforeAll(() => {
    Object.defineProperty(window, "localStorage", {
      value: {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  afterAll(() => {
    if (consoleLogSpy) {
      consoleLogSpy.mockRestore();
    }
  });

  it("should render the page title and banner image", async () => {
    // Arrange
    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 0 }
      })
      .mockResolvedValueOnce({
        data: { products: [] }
      });

    // Act
    const { getByText, getByAltText } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(getByText("ALL Products - Best offers")).toBeInTheDocument();
      expect(getByText("All Products")).toBeInTheDocument();
      expect(getByAltText("bannerimage")).toHaveAttribute("src", "/images/Virtual.png");
    });
  });

  it("should fetch and display products on mount", async () => {
    // Arrange
    const mockProducts = [
      {
        _id: "1",
        name: "iPhone 14",
        slug: "iphone-14",
        price: 999,
        description: "Latest iPhone with advanced features and great camera quality"
      },
      {
        _id: "2",
        name: "Samsung Galaxy",
        slug: "samsung-galaxy",
        price: 899,
        description: "Powerful Android phone with excellent display and performance"
      }
    ];

    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 2 }
      })
      .mockResolvedValueOnce({
        data: { products: mockProducts }
      });

    // Act
    const { getByText } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(getByText("iPhone 14")).toBeInTheDocument();
      expect(getByText("Samsung Galaxy")).toBeInTheDocument();
      expect(getByText("$999.00")).toBeInTheDocument();
      expect(getByText("$899.00")).toBeInTheDocument();
    });

    expect(axios.get).toHaveBeenCalledWith("/api/v1/product/product-list/1");
  });

  it("should display truncated product descriptions", async () => {
    // Arrange
    const longDescription = "This is a very long product description that should be truncated after 60 characters to fit nicely in the card layout and maintain readability";
    const mockProducts = [
      {
        _id: "1",
        name: "Test Product",
        slug: "test-product",
        price: 100,
        description: longDescription
      }
    ];

    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 1 }
      })
      .mockResolvedValueOnce({
        data: { products: mockProducts }
      });

    // Act
    const { getByText } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      const truncatedText = longDescription.substring(0, 60) + "...";
      expect(getByText(truncatedText)).toBeInTheDocument();
    });
  });

  it("should handle More Details button clicks", async () => {
    // Arrange
    const mockProducts = [
      { _id: "1", name: "Test Product", slug: "test-product", price: 100, description: "Test description" }
    ];

    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 1 }
      })
      .mockResolvedValueOnce({
        data: { products: mockProducts }
      });

    // Act
    const { getByText } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByText("Test Product")).toBeInTheDocument();
    });

    const detailsButton = getByText("More Details");
    fireEvent.click(detailsButton);

    // Assert
    expect(mockNavigate).toHaveBeenCalledWith("/product/test-product");
  });

  it("should add product to cart when Add to Cart is clicked", async () => {
    // Arrange
    const { useCart } = require("../context/cart");
    const setCart = jest.fn();
    useCart.mockReturnValue([[], setCart]);

    const mockProducts = [
      { _id: "1", name: "Test Product", slug: "test-product", price: 100, description: "Test product" }
    ];

    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 1 }
      })
      .mockResolvedValueOnce({
        data: { products: mockProducts }
      });

    // Act
    const { getByText } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByText("Test Product")).toBeInTheDocument();
    });

    const addToCartButton = getByText("ADD TO CART");
    fireEvent.click(addToCartButton);

    // Assert
    expect(setCart).toHaveBeenCalledWith([mockProducts[0]]);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "cart",
      JSON.stringify([mockProducts[0]])
    );
    expect(toast.success).toHaveBeenCalledWith("Item Added to cart");
  });

  it("should handle category filter selection", async () => {
    // Arrange
    const mockCategories = [
      { _id: "1", name: "Electronics" },
      { _id: "2", name: "Clothing" }
    ];

    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: mockCategories }
      })
      .mockResolvedValueOnce({
        data: { total: 0 }
      })
      .mockResolvedValueOnce({
        data: { products: [] }
      });

    axios.post.mockResolvedValue({
      data: { products: [] }
    });

    // Act
    const { getByTestId } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByTestId("checkbox-Electronics")).toBeInTheDocument();
    });

    const electronicsCheckbox = getByTestId("checkbox-Electronics");
    fireEvent.click(electronicsCheckbox);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/v1/product/product-filters", {
        checked: ["1"],
        radio: [],
      });
    });
  });

  it("should handle price filter selection", async () => {
    // Arrange
    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 0 }
      })
      .mockResolvedValueOnce({
        data: { products: [] }
      });

    axios.post.mockResolvedValue({
      data: { products: [] }
    });

    // Act
    const { getByTestId } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByTestId("radio-$0 to 19")).toBeInTheDocument();
    });

    const priceRadio = getByTestId("radio-$0 to 19");
    fireEvent.click(priceRadio);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/v1/product/product-filters", {
        checked: [],
        radio: [0, 19],
      });
    });
  });

  it("should handle load more functionality", async () => {
    // Arrange
    const initialProducts = [
      { _id: "1", name: "Product 1", slug: "product-1", price: 100, description: "First product" }
    ];

    const additionalProducts = [
      { _id: "2", name: "Product 2", slug: "product-2", price: 200, description: "Second product" }
    ];

    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 2 }
      })
      .mockResolvedValueOnce({
        data: { products: initialProducts }
      })
      .mockResolvedValueOnce({
        data: { products: additionalProducts }
      });

    // Act
    const { getByText } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByText("Product 1")).toBeInTheDocument();
    });

    const loadMoreButton = getByText("Loadmore");
    fireEvent.click(loadMoreButton);

    // Assert
    await waitFor(() => {
      expect(getByText("Product 2")).toBeInTheDocument();
    });
    expect(axios.get).toHaveBeenCalledWith("/api/v1/product/product-list/2");
  });

  it("should handle reset filters button", async () => {
    // Arrange
    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 0 }
      })
      .mockResolvedValueOnce({
        data: { products: [] }
      });

    // Act
    const { getByText } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByText("RESET FILTERS")).toBeInTheDocument();
    });

    const resetButton = getByText("RESET FILTERS");
    fireEvent.click(resetButton);

    // Assert
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("should handle API errors when fetching products", async () => {
    // Arrange
    const apiError = new Error("Products API Error");
    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 0 }
      })
      .mockRejectedValueOnce(apiError);

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(apiError);
    });
  });

  it("should not show load more button when all products are loaded", async () => {
    // Arrange
    const mockProducts = [
      { _id: "1", name: "Product 1", slug: "product-1", price: 100, description: "Only product" }
    ];

    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 1 }
      })
      .mockResolvedValueOnce({
        data: { products: mockProducts }
      });

    // Act
    const { queryByText } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(queryByText("Loadmore")).not.toBeInTheDocument();
    });
  });

  it("should handle empty categories response", async () => {
    // Arrange
    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 0 }
      })
      .mockResolvedValueOnce({
        data: { products: [] }
      });

    // Act
    const { getByText, container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(getByText("Filter By Category")).toBeInTheDocument();
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes).toHaveLength(0);
    });
  });

  it("should handle empty products response", async () => {
    // Arrange
    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: [] }
      })
      .mockResolvedValueOnce({
        data: { total: 0 }
      })
      .mockResolvedValueOnce({
        data: { products: [] }
      });

    // Act
    const { getByText, container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(getByText("All Products")).toBeInTheDocument();
      const productCards = container.querySelectorAll('.card');
      expect(productCards).toHaveLength(0);
    });
  });

  it("should handle load more with filters applied", async () => {
    // Arrange
    const mockCategories = [
      { _id: "1", name: "Electronics" }
    ];

    const initialProducts = [
      { _id: "1", name: "Product 1", slug: "product-1", price: 100, description: "First product" }
    ];

    const additionalProducts = [
      { _id: "2", name: "Product 2", slug: "product-2", price: 200, description: "Second product" }
    ];

    axios.get
      .mockResolvedValueOnce({
        data: { success: true, category: mockCategories }
      })
      .mockResolvedValueOnce({
        data: { total: 5 } // Set higher total so load more button shows
      })
      .mockResolvedValueOnce({
        data: { products: initialProducts }
      });

    axios.post
      .mockResolvedValueOnce({
        data: { products: initialProducts }
      })
      .mockResolvedValueOnce({
        data: { products: additionalProducts }
      });

    // Act
    const { getByTestId, getByText } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByTestId("checkbox-Electronics")).toBeInTheDocument();
    });

    // Apply filter first
    const electronicsCheckbox = getByTestId("checkbox-Electronics");
    fireEvent.click(electronicsCheckbox);

    await waitFor(() => {
      expect(getByText("Product 1")).toBeInTheDocument();
    });

    // Wait for load more button to appear
    await waitFor(() => {
      expect(getByText("Loadmore")).toBeInTheDocument();
    });

    // Then load more
    const loadMoreButton = getByText("Loadmore");
    fireEvent.click(loadMoreButton);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenLastCalledWith("/api/v1/product/product-filters", {
        checked: ["1"],
        radio: [],
        page: 2,
      });
    });
  });
});
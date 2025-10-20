import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import toast from "react-hot-toast";
import { AuthProvider } from "../../context/auth";
import { CartProvider, useCart } from "../../context/cart";

// Mock external dependencies
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// TestConsumer component - minimal wrapper to consume CartProvider
const TestConsumer = () => {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart } = useCart();

  return (
    <div data-testid="test-consumer">
      {/* Display cart state as JSON */}
      <div data-testid="cart-json">{JSON.stringify(cart)}</div>

      {/* Display cart item count */}
      <div data-testid="cart-count">{Object.keys(cart).length}</div>

      {/* Cart items list */}
      {Object.entries(cart).map(([slug, item]) => (
        <div key={slug} data-testid={`cart-item-${slug}`}>
          <span data-testid={`quantity-${slug}`}>{item.quantity}</span>
          <span data-testid={`price-${slug}`}>{item.price}</span>
          <span data-testid={`productId-${slug}`}>{item.productId}</span>
        </div>
      ))}

      {/* Operation buttons */}
      <button
        data-testid="add-to-cart-btn"
        onClick={(e) => addToCart(e.currentTarget.dataset.slug)}
      >
        Add to Cart
      </button>

      <button
        data-testid="update-quantity-btn"
        onClick={(e) =>
          updateQuantity(
            e.currentTarget.dataset.slug,
            Number(e.currentTarget.dataset.quantity)
          )
        }
      >
        Update Quantity
      </button>

      <button
        data-testid="remove-from-cart-btn"
        onClick={(e) => removeFromCart(e.currentTarget.dataset.slug)}
      >
        Remove
      </button>

      <button data-testid="clear-cart-btn" onClick={clearCart}>
        Clear Cart
      </button>
    </div>
  );
};

describe("CartProvider Integration Tests", () => {
  let mockAxios;

  // Complete mock data structures (Anti-Pattern #4 compliance)
  const mockProducts = {
    "iphone-14": {
      _id: "prod-iphone-123",
      slug: "iphone-14",
      name: "iPhone 14",
      description: "Latest iPhone with advanced features",
      price: 999,
      quantity: 10,
      category: {
        _id: "cat-electronics-001",
        name: "Electronics",
        slug: "electronics",
      },
      shipping: true,
      photo: {
        data: Buffer.from([]),
        contentType: "image/jpeg",
      },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-15T00:00:00.000Z",
    },
    "macbook-pro": {
      _id: "prod-macbook-456",
      slug: "macbook-pro",
      name: "MacBook Pro",
      description: "Powerful laptop for professionals",
      price: 2499,
      quantity: 5,
      category: {
        _id: "cat-computers-002",
        name: "Computers",
        slug: "computers",
      },
      shipping: true,
      photo: {
        data: Buffer.from([]),
        contentType: "image/jpeg",
      },
      createdAt: "2024-01-10T00:00:00.000Z",
      updatedAt: "2024-01-20T00:00:00.000Z",
    },
    "out-of-stock-item": {
      _id: "prod-oos-789",
      slug: "out-of-stock-item",
      name: "Out of Stock Item",
      description: "Currently unavailable",
      price: 199,
      quantity: 0,
      category: {
        _id: "cat-accessories-003",
        name: "Accessories",
        slug: "accessories",
      },
      shipping: true,
      photo: {
        data: Buffer.from([]),
        contentType: "image/jpeg",
      },
      createdAt: "2024-01-05T00:00:00.000Z",
      updatedAt: "2024-01-25T00:00:00.000Z",
    },
    "no-price-item": {
      _id: "prod-noprice-999",
      slug: "no-price-item",
      name: "No Price Item",
      description: "Price not set",
      price: null,
      quantity: 10,
      category: {
        _id: "cat-misc-004",
        name: "Miscellaneous",
        slug: "miscellaneous",
      },
      shipping: false,
      photo: {
        data: Buffer.from([]),
        contentType: "image/jpeg",
      },
      createdAt: "2024-01-12T00:00:00.000Z",
      updatedAt: "2024-01-22T00:00:00.000Z",
    },
    airpods: {
      _id: "prod-airpods-789",
      slug: "airpods",
      name: "AirPods",
      description: "Wireless earbuds",
      price: 199,
      quantity: 15,
      category: {
        _id: "cat-accessories-003",
        name: "Accessories",
        slug: "accessories",
      },
      shipping: true,
      photo: {
        data: Buffer.from([]),
        contentType: "image/jpeg",
      },
      createdAt: "2024-01-08T00:00:00.000Z",
      updatedAt: "2024-01-18T00:00:00.000Z",
    },
  };

  const mockAuthUserA = {
    _id: "user123",
    name: "John Doe",
    email: "john@test.com",
    phone: "91234567",
    address: "123 Main Street, Singapore 123456",
    role: 0,
    answer: "security-answer",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-15T00:00:00.000Z",
  };

  const mockAuthA = {
    user: mockAuthUserA,
    token: "jwt-test-token-abc123",
  };

  const mockAuthUserB = {
    _id: "user456",
    name: "Jane Smith",
    email: "jane@test.com",
    phone: "98765432",
    address: "456 Oak Avenue, Singapore 654321",
    role: 0,
    answer: "another-answer",
    createdAt: "2024-02-01T00:00:00.000Z",
    updatedAt: "2024-02-15T00:00:00.000Z",
  };

  const mockAuthB = {
    user: mockAuthUserB,
    token: "jwt-test-token-def456",
  };

  // Providers wrapper
  const Providers = ({ children }) => (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );

  // Render helper
  const renderWithProviders = () => {
    return render(
      <Providers>
        <TestConsumer />
      </Providers>
    );
  };

  beforeAll(() => {
    mockAxios = new MockAdapter(axios);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockAxios.reset();

    // Setup API mock - dynamic response based on slug
    mockAxios.onGet(/\/api\/v1\/product\/get-product\//).reply((config) => {
      const slug = config.url.split("/").pop();
      const product = mockProducts[slug];
      return product ? [200, { product }] : [404, { error: "Product not found" }];
    });
  });

  afterAll(() => {
    mockAxios.restore();
  });

  describe("Add/Update Operations", () => {
    it("adds item to cart with data flowing from API to localStorage", async () => {
      renderWithProviders();

      const addBtn = screen.getByTestId("add-to-cart-btn");
      addBtn.dataset.slug = "iphone-14";

      await userEvent.click(addBtn);

      await waitFor(() => {
        expect(screen.getByTestId("cart-item-iphone-14")).toBeInTheDocument();
      });

      const quantity = screen.getByTestId("quantity-iphone-14");
      const price = screen.getByTestId("price-iphone-14");
      const productId = screen.getByTestId("productId-iphone-14");

      expect(quantity.textContent).toBe("1");
      expect(price.textContent).toBe("999");
      expect(productId.textContent).toBe("prod-iphone-123");

      const storedCart = JSON.parse(localStorage.getItem("cart-guest"));
      expect(storedCart["iphone-14"]).toEqual({
        quantity: 1,
        price: 999,
        productId: "prod-iphone-123",
      });

      expect(toast.success).toHaveBeenCalledWith("Add to Cart Successfully");
      expect(mockAxios.history.get.length).toBe(1);
      expect(mockAxios.history.get[0].url).toBe("/api/v1/product/get-product/iphone-14");
    });

    it("prevents adding out-of-stock item and does not update localStorage", async () => {
      renderWithProviders();

      expect(screen.getByTestId("cart-count").textContent).toBe("0");

      const addBtn = screen.getByTestId("add-to-cart-btn");
      addBtn.dataset.slug = "out-of-stock-item";
      await userEvent.click(addBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Error added to cart: Not enough inventory"
        );
      });

      expect(screen.getByTestId("cart-count").textContent).toBe("0");
      expect(screen.queryByTestId("cart-item-out-of-stock-item")).not.toBeInTheDocument();

      const storedCart = JSON.parse(localStorage.getItem("cart-guest"));
      expect(storedCart).toEqual({});

      expect(mockAxios.history.get.length).toBe(1);
      expect(mockAxios.history.get[0].url).toBe(
        "/api/v1/product/get-product/out-of-stock-item"
      );
    });

    it("increments existing item quantity after API validates total inventory", async () => {
      const existingCart = {
        "iphone-14": {
          quantity: 2,
          price: 999,
          productId: "prod-iphone-123",
        },
      };
      localStorage.setItem("cart-guest", JSON.stringify(existingCart));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("quantity-iphone-14").textContent).toBe("2");
      });

      const addBtn = screen.getByTestId("add-to-cart-btn");
      addBtn.dataset.slug = "iphone-14";
      await userEvent.click(addBtn);

      await waitFor(() => {
        expect(screen.getByTestId("quantity-iphone-14").textContent).toBe("3");
      });

      const updatedCart = JSON.parse(localStorage.getItem("cart-guest"));
      expect(updatedCart["iphone-14"].quantity).toBe(3);

      expect(mockAxios.history.get.length).toBe(1);
      expect(mockAxios.history.get[0].url).toBe("/api/v1/product/get-product/iphone-14");
      expect(toast.success).toHaveBeenCalledWith("Add to Cart Successfully");
    });

    it("prevents adding item without price and shows specific error", async () => {
      renderWithProviders();

      const addBtn = screen.getByTestId("add-to-cart-btn");
      addBtn.dataset.slug = "no-price-item";
      await userEvent.click(addBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Error added to cart: Price of product not available"
        );
      });

      expect(screen.getByTestId("cart-count").textContent).toBe("0");
      expect(screen.queryByTestId("cart-item-no-price-item")).not.toBeInTheDocument();

      const storedCart = JSON.parse(localStorage.getItem("cart-guest"));
      expect(storedCart).toEqual({});

      expect(mockAxios.history.get.length).toBe(1);
    });

    it("updates quantity after API validates new inventory requirement", async () => {
      const existingCart = {
        "macbook-pro": {
          quantity: 2,
          price: 2499,
          productId: "prod-macbook-456",
        },
      };
      localStorage.setItem("cart-guest", JSON.stringify(existingCart));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("quantity-macbook-pro").textContent).toBe("2");
      });

      const updateBtn = screen.getByTestId("update-quantity-btn");
      updateBtn.dataset.slug = "macbook-pro";
      updateBtn.dataset.quantity = "4";
      await userEvent.click(updateBtn);

      await waitFor(() => {
        expect(screen.getByTestId("quantity-macbook-pro").textContent).toBe("4");
      });

      const updatedCart = JSON.parse(localStorage.getItem("cart-guest"));
      expect(updatedCart["macbook-pro"].quantity).toBe(4);

      expect(mockAxios.history.get.length).toBe(1);
      expect(mockAxios.history.get[0].url).toBe("/api/v1/product/get-product/macbook-pro");
      expect(toast.success).toHaveBeenCalledWith("Update Cart Quantity Successfully");
    });

    it("removes item when quantity updated to zero", async () => {
      const existingCart = {
        "iphone-14": {
          quantity: 2,
          price: 999,
          productId: "prod-iphone-123",
        },
      };
      localStorage.setItem("cart-guest", JSON.stringify(existingCart));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-item-iphone-14")).toBeInTheDocument();
      });

      const updateBtn = screen.getByTestId("update-quantity-btn");
      updateBtn.dataset.slug = "iphone-14";
      updateBtn.dataset.quantity = "0";
      await userEvent.click(updateBtn);

      await waitFor(() => {
        expect(screen.queryByTestId("cart-item-iphone-14")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("cart-count").textContent).toBe("0");

      const updatedCart = JSON.parse(localStorage.getItem("cart-guest"));
      expect(updatedCart).toEqual({});

      expect(mockAxios.history.get.length).toBe(1);
    });
  });

  describe("Remove/Clear Operations", () => {
    const mockCart = {
      "iphone-14": {
        quantity: 2,
        price: 999,
        productId: "prod-iphone-123",
      },
      "macbook-pro": {
        quantity: 1,
        price: 2499,
        productId: "prod-macbook-456",
      },
      airpods: {
        quantity: 3,
        price: 199,
        productId: "prod-airpods-789",
      },
    };

    const singleItemCart = {
      "iphone-14": {
        quantity: 1,
        price: 999,
        productId: "prod-iphone-123",
      },
    };

    it("removes item and syncs removal to localStorage", async () => {
      localStorage.setItem("cart-guest", JSON.stringify(mockCart));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-count").textContent).toBe("3");
      });

      expect(screen.getByTestId("cart-item-iphone-14")).toBeInTheDocument();
      expect(screen.getByTestId("cart-item-macbook-pro")).toBeInTheDocument();
      expect(screen.getByTestId("cart-item-airpods")).toBeInTheDocument();

      const removeBtn = screen.getByTestId("remove-from-cart-btn");
      removeBtn.dataset.slug = "iphone-14";
      await userEvent.click(removeBtn);

      await waitFor(() => {
        expect(screen.queryByTestId("cart-item-iphone-14")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("cart-count").textContent).toBe("2");
      expect(screen.getByTestId("cart-item-macbook-pro")).toBeInTheDocument();
      expect(screen.getByTestId("cart-item-airpods")).toBeInTheDocument();

      const updatedCart = JSON.parse(localStorage.getItem("cart-guest"));
      expect(updatedCart["iphone-14"]).toBeUndefined();
      expect(updatedCart["macbook-pro"]).toBeDefined();
      expect(updatedCart["airpods"]).toBeDefined();

      expect(toast.success).toHaveBeenCalledWith("Remove from Cart Successfully");
    });

    it("clears all items and persists empty cart to localStorage", async () => {
      localStorage.setItem("cart-guest", JSON.stringify(mockCart));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-count").textContent).toBe("3");
      });

      const clearBtn = screen.getByTestId("clear-cart-btn");
      await userEvent.click(clearBtn);

      await waitFor(() => {
        expect(screen.getByTestId("cart-count").textContent).toBe("0");
      });

      expect(screen.queryByTestId("cart-item-iphone-14")).not.toBeInTheDocument();
      expect(screen.queryByTestId("cart-item-macbook-pro")).not.toBeInTheDocument();
      expect(screen.queryByTestId("cart-item-airpods")).not.toBeInTheDocument();

      const clearedCart = JSON.parse(localStorage.getItem("cart-guest"));
      expect(clearedCart).toEqual({});

      expect(toast.success).toHaveBeenCalledWith("Cart Cleared Successfully");
    });

    it("transitions to empty state when last item removed", async () => {
      localStorage.setItem("cart-guest", JSON.stringify(singleItemCart));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-count").textContent).toBe("1");
        expect(screen.getByTestId("cart-item-iphone-14")).toBeInTheDocument();
      });

      const removeBtn = screen.getByTestId("remove-from-cart-btn");
      removeBtn.dataset.slug = "iphone-14";
      await userEvent.click(removeBtn);

      await waitFor(() => {
        expect(screen.getByTestId("cart-count").textContent).toBe("0");
      });

      expect(screen.queryByTestId("cart-item-iphone-14")).not.toBeInTheDocument();

      const emptyCart = JSON.parse(localStorage.getItem("cart-guest"));
      expect(emptyCart).toEqual({});

      expect(toast.success).toHaveBeenCalledWith("Remove from Cart Successfully");
    });
  });

  describe("Auth/Storage Integration", () => {
    const johnCart = {
      "macbook-pro": {
        quantity: 1,
        price: 2499,
        productId: "prod-macbook-456",
      },
    };

    const janeCart = {
      "iphone-14": {
        quantity: 2,
        price: 999,
        productId: "prod-iphone-123",
      },
    };

    const guestCart = {
      "iphone-14": {
        quantity: 1,
        price: 999,
        productId: "prod-iphone-123",
      },
    };

    it("switches from guest cart to user cart on login", async () => {
      localStorage.setItem("cart-guest", JSON.stringify(guestCart));
      localStorage.setItem("cart-John Doe", JSON.stringify(johnCart));

      const { unmount } = renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-count").textContent).toBe("1");
        expect(screen.getByTestId("cart-item-iphone-14")).toBeInTheDocument();
      });

      unmount();
      localStorage.setItem("auth", JSON.stringify(mockAuthA));
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-item-macbook-pro")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("cart-item-iphone-14")).not.toBeInTheDocument();
      expect(screen.getByTestId("cart-count").textContent).toBe("1");
      expect(screen.getByTestId("quantity-macbook-pro").textContent).toBe("1");
    });

    it("switches from user cart to guest cart on logout", async () => {
      localStorage.setItem("auth", JSON.stringify(mockAuthA));
      localStorage.setItem("cart-John Doe", JSON.stringify(johnCart));

      const { unmount } = renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-item-macbook-pro")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cart-count").textContent).toBe("1");

      unmount();
      localStorage.removeItem("auth");
      localStorage.setItem("cart-guest", JSON.stringify(guestCart));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-item-iphone-14")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("cart-item-macbook-pro")).not.toBeInTheDocument();
      expect(screen.getByTestId("cart-count").textContent).toBe("1");
      expect(screen.getByTestId("quantity-iphone-14").textContent).toBe("1");
    });

    it("persists cart operations to user-specific localStorage key", async () => {
      localStorage.setItem("auth", JSON.stringify(mockAuthA));
      localStorage.setItem("cart-John Doe", JSON.stringify({}));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-count").textContent).toBe("0");
      });

      const addBtn = screen.getByTestId("add-to-cart-btn");
      addBtn.dataset.slug = "iphone-14";
      await userEvent.click(addBtn);

      await waitFor(() => {
        expect(screen.getByTestId("cart-item-iphone-14")).toBeInTheDocument();
      });

      const johnCartUpdated = JSON.parse(localStorage.getItem("cart-John Doe"));
      expect(johnCartUpdated["iphone-14"]).toEqual({
        quantity: 1,
        price: 999,
        productId: "prod-iphone-123",
      });

      expect(localStorage.getItem("cart-guest")).toBe("{}");

      const removeBtn = screen.getByTestId("remove-from-cart-btn");
      removeBtn.dataset.slug = "iphone-14";
      await userEvent.click(removeBtn);

      await waitFor(() => {
        expect(screen.getByTestId("cart-count").textContent).toBe("0");
      });

      const johnCartEmpty = JSON.parse(localStorage.getItem("cart-John Doe"));
      expect(johnCartEmpty).toEqual({});
    });

    it("isolates carts between different users", async () => {
      localStorage.setItem("cart-John Doe", JSON.stringify(johnCart));
      localStorage.setItem("cart-Jane Smith", JSON.stringify(janeCart));

      localStorage.setItem("auth", JSON.stringify(mockAuthA));
      let result = renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-item-macbook-pro")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cart-count").textContent).toBe("1");
      expect(screen.queryByTestId("cart-item-iphone-14")).not.toBeInTheDocument();

      result.unmount();
      localStorage.removeItem("auth");
      localStorage.setItem("auth", JSON.stringify(mockAuthB));
      result = renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-item-iphone-14")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cart-count").textContent).toBe("1");
      expect(screen.getByTestId("quantity-iphone-14").textContent).toBe("2");
      expect(screen.queryByTestId("cart-item-macbook-pro")).not.toBeInTheDocument();

      result.unmount();
      localStorage.removeItem("auth");
      localStorage.setItem("auth", JSON.stringify(mockAuthA));
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-item-macbook-pro")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cart-count").textContent).toBe("1");
      expect(screen.queryByTestId("cart-item-iphone-14")).not.toBeInTheDocument();
    });

    it("loads correct cart on initial mount based on existing auth", async () => {
      localStorage.setItem("auth", JSON.stringify(mockAuthA));
      localStorage.setItem("cart-John Doe", JSON.stringify(johnCart));
      localStorage.setItem("cart-guest", JSON.stringify(guestCart));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId("cart-item-macbook-pro")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cart-count").textContent).toBe("1");
      expect(screen.queryByTestId("cart-item-iphone-14")).not.toBeInTheDocument();

      const cartJson = JSON.parse(screen.getByTestId("cart-json").textContent);
      expect(cartJson).toEqual(johnCart);
    });
  });
});

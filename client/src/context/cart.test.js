import { renderHook, act, waitFor } from "@testing-library/react";
import { CartProvider, useCart } from "./cart";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "./auth";

// Mock dependencies
jest.mock("axios");
jest.mock("react-hot-toast");
jest.mock("./auth");

describe("Cart Context", () => {
  let mockAuth;
  let mockSetAuth;

  // Helper function to render cart hook
  const renderCartHook = () => renderHook(() => useCart(), { wrapper: CartProvider });

  // Helper function to create mock product response
  const mockProductResponse = (overrides = {}) => ({
    product: {
      _id: "123",
      slug: "test-product",
      price: 100,
      quantity: 10,
      ...overrides,
    },
  });

  beforeAll(() => {
    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default auth mock - guest user
    mockAuth = { user: null, token: "" };
    mockSetAuth = jest.fn();
    useAuth.mockReturnValue([mockAuth, mockSetAuth]);
  });

  describe("CartProvider Initialization", () => {
    it("should initialize with empty cart for guest user", () => {
      localStorage.getItem.mockReturnValue(null);
      const { result } = renderCartHook();

      expect(result.current.cart).toEqual({});
      expect(localStorage.getItem).toHaveBeenCalledWith("cart-guest");
    });

    it("should load cart from localStorage for logged-in user", async () => {
      const mockCart = { "user-product": { quantity: 1, price: 200, productId: "456" } };
      useAuth.mockReturnValue([{ user: { name: "TestUser" }, token: "test-token" }, mockSetAuth]);
      localStorage.getItem.mockReturnValue(JSON.stringify(mockCart));

      const { result } = renderCartHook();

      await waitFor(() => expect(result.current.cart).toEqual(mockCart));
      expect(localStorage.getItem).toHaveBeenCalledWith("cart-TestUser");
    });
  });

  describe("addToCart() Function", () => {
    it("should successfully add new item to empty cart", async () => {
      localStorage.getItem.mockReturnValue(null);
      const { result } = renderCartHook();

      axios.get.mockResolvedValue({ data: mockProductResponse() });

      await act(async () => await result.current.addToCart("test-product"));

      await waitFor(() => expect(result.current.cart["test-product"]).toEqual({
        quantity: 1,
        price: 100,
        productId: "123",
      }));
      expect(axios.get).toHaveBeenCalledWith("/api/v1/product/get-product/test-product");
      expect(toast.success).toHaveBeenCalledWith("Add to Cart Successfully");
    });

    it("should increment quantity when adding existing item", async () => {
      const existingCart = { "test-product": { quantity: 2, price: 100, productId: "123" } };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCart));
      const { result } = renderCartHook();

      await waitFor(() => expect(result.current.cart).toEqual(existingCart));

      axios.get.mockResolvedValue({ data: mockProductResponse() });
      await act(async () => await result.current.addToCart("test-product"));

      await waitFor(() => expect(result.current.cart["test-product"].quantity).toBe(3));
      expect(toast.success).toHaveBeenCalledWith("Add to Cart Successfully");
    });

    it("should reject if exceeding inventory", async () => {
      const existingCart = { "test-product": { quantity: 9, price: 100, productId: "123" } };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCart));
      const { result } = renderCartHook();

      await waitFor(() => expect(result.current.cart).toEqual(existingCart));

      axios.get.mockResolvedValue({ data: mockProductResponse({ quantity: 9 }) });
      await act(async () => await result.current.addToCart("test-product"));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error added to cart: Not enough inventory"));
      expect(result.current.cart["test-product"].quantity).toBe(9);
    });

    it("should reject if price is missing", async () => {
      localStorage.getItem.mockReturnValue(null);
      const { result } = renderCartHook();

      axios.get.mockResolvedValue({ data: mockProductResponse({ price: null }) });
      await act(async () => await result.current.addToCart("test-product"));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error added to cart: Price of product not available"));
      expect(result.current.cart).toEqual({});
    });

    it("should reject if product does not exist", async () => {
      localStorage.getItem.mockReturnValue(null);
      const { result } = renderCartHook();

      axios.get.mockResolvedValue({ data: { product: null } });
      await act(async () => await result.current.addToCart("non-existent"));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Item does not exist"));
      expect(result.current.cart).toEqual({});
    });

    it("should handle generic API error with custom error message", async () => {
      localStorage.getItem.mockReturnValue(null);
      const { result } = renderCartHook();

      axios.get.mockRejectedValue(new Error("Network timeout"));
      await act(async () => await result.current.addToCart("test-product"));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Network timeout"));
      expect(result.current.cart).toEqual({});
    });
  });

  describe("removeFromCart() Function", () => {
    it("should remove item from cart", async () => {
      const existingCart = {
        "product-1": { quantity: 2, price: 100, productId: "123" },
        "product-2": { quantity: 1, price: 200, productId: "456" },
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCart));
      const { result } = renderCartHook();

      await waitFor(() => expect(result.current.cart).toEqual(existingCart));

      act(() => result.current.removeFromCart("product-1"));

      await waitFor(() => expect(result.current.cart).toEqual({
        "product-2": { quantity: 1, price: 200, productId: "456" },
      }));
      expect(toast.success).toHaveBeenCalledWith("Remove from Cart Successfully");
    });
  });

  describe("updateQuantity() Function", () => {
    it("should update quantity successfully", async () => {
      const existingCart = { "test-product": { quantity: 2, price: 100, productId: "123" } };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCart));
      const { result } = renderCartHook();

      await waitFor(() => expect(result.current.cart).toEqual(existingCart));

      axios.get.mockResolvedValue({ data: mockProductResponse() });
      await act(async () => await result.current.updateQuantity("test-product", 5));

      await waitFor(() => expect(result.current.cart["test-product"].quantity).toBe(5));
      expect(toast.success).toHaveBeenCalledWith("Update Cart Quantity Successfully");
    });

    it("should remove item when quantity is 0", async () => {
      const existingCart = { "test-product": { quantity: 2, price: 100, productId: "123" } };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCart));
      const { result } = renderCartHook();

      await waitFor(() => expect(result.current.cart).toEqual(existingCart));

      axios.get.mockResolvedValue({ data: mockProductResponse() });
      await act(async () => await result.current.updateQuantity("test-product", 0));

      await waitFor(() => expect(result.current.cart).toEqual({}));
    });

    it("should reject if exceeding inventory", async () => {
      const existingCart = { "test-product": { quantity: 5, price: 100, productId: "123" } };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCart));
      const { result } = renderCartHook();

      await waitFor(() => expect(result.current.cart).toEqual(existingCart));

      axios.get.mockResolvedValue({ data: mockProductResponse({ quantity: 8 }) });
      await act(async () => await result.current.updateQuantity("test-product", 10));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error updating quantity: Not enough inventory"));
      expect(result.current.cart["test-product"].quantity).toBe(5);
    });

    it("should reject if price is missing", async () => {
      const existingCart = { "test-product": { quantity: 2, price: 100, productId: "123" } };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCart));
      const { result } = renderCartHook();

      await waitFor(() => expect(result.current.cart).toEqual(existingCart));

      axios.get.mockResolvedValue({ data: mockProductResponse({ price: null }) });
      await act(async () => await result.current.updateQuantity("test-product", 5));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error added to cart: Price of product not available"));
      expect(result.current.cart["test-product"].quantity).toBe(2);
    });

    it("should reject if product does not exist", async () => {
      const existingCart = { "test-product": { quantity: 2, price: 100, productId: "123" } };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCart));
      const { result } = renderCartHook();

      await waitFor(() => expect(result.current.cart).toEqual(existingCart));

      axios.get.mockResolvedValue({ data: { product: null } });
      await act(async () => await result.current.updateQuantity("test-product", 5));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Item does not exist"));
      expect(result.current.cart["test-product"].quantity).toBe(2);
    });
  });

  describe("clearCart() Function", () => {
    it("should clear all items from cart", async () => {
      const existingCart = {
        "product-1": { quantity: 2, price: 100, productId: "123" },
        "product-2": { quantity: 1, price: 200, productId: "456" },
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCart));
      const { result } = renderCartHook();

      await waitFor(() => expect(result.current.cart).toEqual(existingCart));

      act(() => result.current.clearCart());

      await waitFor(() => expect(result.current.cart).toEqual({}));
      expect(toast.success).toHaveBeenCalledWith("Cart Cleared Successfully");
    });
  });
});

import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import axios from "axios";
import React from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import { useCart } from "../context/cart";
import CartPage from "./CartPage";

// Mock modules
jest.mock("../context/auth", () => ({ useAuth: jest.fn() }));

jest.mock("../context/cart", () => ({ useCart: jest.fn() }));

jest.mock("react-router-dom", () => ({ useNavigate: jest.fn() }));

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("react-hot-toast", () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
// Mock window.localStorage
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Create a mock for the requestPaymentMethod function
const mockRequestPaymentMethod = jest
  .fn()
  .mockResolvedValue({ nonce: "test-payment-nonce" });

// Mock DropIn component
jest.mock("braintree-web-drop-in-react", () => {
  return {
    __esModule: true,
    default: function MockDropIn(props) {
      const { act } = require("@testing-library/react");
      setTimeout(() => {
        act(() => {
          if (props.onInstance) {
            props.onInstance({
              requestPaymentMethod: mockRequestPaymentMethod,
            });
          }
        });
      }, 0);
      return <div data-testid="mock-dropin">Mock DropIn</div>;
    },
  };
});

// Mock Layout component
jest.mock("../components/Layout", () => {
  return {
    __esModule: true,
    default: function MockLayout({ children }) {
      return <div data-testid="mock-layout">{children}</div>;
    },
  };
});

const mockProducts = [
  {
    _id: "1",
    name: "Test Product 1",
    slug: "test-product-1",
    description: "Test description for product 1",
    price: 99.99,
    category: "67bd7972f616a1f52783a628",
    quantity: 10,
    shipping: true,
  },
  {
    _id: "2",
    name: "Test Product 2",
    slug: "test-product-2",
    description: "Test description for product 2",
    price: 49.99,
    category: "67bd7972f616a1f52783a628",
    quantity: 5,
    shipping: true,
  },
];

const emptyCart = {};

const generateCart = (n) => {
  let cart = {};
  for (let i = 0; i < n; i++) {
    cart[mockProducts[i].slug] = {
      quantity: 2,
      price: mockProducts[i].price,
      productId: mockProducts[i]._id,
    };
  }
  return cart;
};

const defaultAuthUser = {
  user: { name: "Test User", address: "123 Test St" },
  token: "test-token",
};

// Helper functions
const mockCartContext = (cart) => ({
  cart,
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  updateQuantity: jest.fn(),
  clearCart: jest.fn(),
});

const renderCartPage = async () => {
  await act(async () => {
    render(<CartPage />);
  });
};

describe("CartPage component", () => {
  const mockNavigate = jest.fn();
  const mockCart = generateCart(1);
  const cartWithTwoItems = generateCart(2);

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue([defaultAuthUser, jest.fn()]);
    useNavigate.mockReturnValue(mockNavigate);

    axios.get.mockImplementation((url) => {
      if (url.includes("/braintree/token")) {
        return Promise.resolve({ data: { clientToken: "test-client-token" } });
      }
      if (url.includes("/get-product/")) {
        const slug = url.split("/").pop();
        const product = mockProducts.find((p) => p.slug === slug) || mockProducts[0];
        return Promise.resolve({ data: { message: "Single Product Fetched", product, success: true } });
      }
      return Promise.reject(new Error("Not Found"));
    });

    axios.post.mockResolvedValue({ data: { success: true } });
    mockRequestPaymentMethod.mockClear();
    mockRequestPaymentMethod.mockResolvedValue({ nonce: "test-payment-nonce" });
  });

  // Test 1: Empty cart renders correctly
  it("displays empty cart message when cart is empty", async () => {
    useCart.mockReturnValue(mockCartContext(emptyCart));
    await renderCartPage();
    expect(screen.getByText("Your Cart Is Empty")).toBeInTheDocument();
  });

  // Test 2: Cart items render correctly
  it("renders cart items correctly", async () => {
    useCart.mockReturnValue(mockCartContext(mockCart));
    await renderCartPage();

    expect(screen.getByText(mockProducts[0].slug)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`\\$${mockProducts[0].price}`, "i"))).toBeInTheDocument();
    expect(screen.getByText(/Quantity:\s*2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  // Test 3: Does not fetch product details (current implementation renders from cart object directly)
  it("does not fetch individual product details", async () => {
    useCart.mockReturnValue(mockCartContext(mockCart));
    await renderCartPage();
    expect(axios.get).not.toHaveBeenCalledWith(expect.stringContaining("/api/v1/product/get-product/"));
  });

  // Test 4: Token retrieval on mount
  it("makes API call to get Braintree token on mount when user is authenticated", async () => {
    useCart.mockReturnValue(mockCartContext(mockCart));
    await renderCartPage();
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith("/api/v1/product/braintree/token"));
  });

  // Test 5: Token call happens regardless of auth (current implementation)
  it("fetches Braintree token even when user is not authenticated", async () => {
    useAuth.mockReturnValue([{ user: null, token: null }, jest.fn()]);
    useCart.mockReturnValue(mockCartContext(emptyCart));
    await renderCartPage();
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith("/api/v1/product/braintree/token"));
  });

  // Test 6: Token fetch error handling
  it("handles Braintree token fetch error and shows error toast", async () => {
    const consoleSpy = jest.spyOn(console, "log");
    const tokenError = new Error("Failed to fetch token");

    axios.get.mockImplementation((url) => {
      if (url.includes("/braintree/token")) {
        return Promise.reject(tokenError);
      }
      return Promise.reject(new Error("Not Found"));
    });

    useCart.mockReturnValue(mockCartContext(mockCart));
    await renderCartPage();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(tokenError);
      expect(toast.error).toHaveBeenCalledWith("Failed to initialize payment gateway");
    });

    consoleSpy.mockRestore();
  });

  // Test 6: Display cart count with "items"
  it("displays correct cart item count with 'items'", async () => {
    useCart.mockReturnValue(mockCartContext(cartWithTwoItems));
    await renderCartPage();
    expect(screen.getByText(/You Have 2 items/i)).toBeInTheDocument();
  });

  // Test 7: Cart count for 1 item
  it("displays cart count when cart has 1 item", async () => {
    useCart.mockReturnValue(mockCartContext(mockCart));
    await renderCartPage();
    expect(screen.getByText(/You Have 1 items/i)).toBeInTheDocument();
  });

  describe("removeCartItem function", () => {
    // Test 8: Remove item calls correct function
    it("successfully removes the correct item from the cart when Remove button clicked", async () => {
      const mockContext = mockCartContext(cartWithTwoItems);
      useCart.mockReturnValue(mockContext);
      await renderCartPage();

      const removeButtons = screen.getAllByRole("button", { name: "Remove" });
      await act(async () => fireEvent.click(removeButtons[0]));

      expect(mockContext.removeFromCart).toHaveBeenCalledWith(mockProducts[0].slug);
    });
  });

  // Note: Current CartPage implementation does not have quantity dropdown
  // It only displays quantity as text. updateQuantity would need to be called from cart context.

  describe("Total price calculation", () => {
    it.each([
      ["single item", mockCart, mockProducts[0].price * 2],
      ["multiple items", cartWithTwoItems, mockProducts[0].price * 2 + mockProducts[1].price * 2],
    ])("calculates and displays correct total for %s", async (_, cart, expectedTotal) => {
      useCart.mockReturnValue(mockCartContext(cart));
      await renderCartPage();
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`\\$${expectedTotal.toFixed(2)}`, "i"))).toBeInTheDocument();
      });
    });
  });

  describe("Authentication and address UI", () => {
    // Test 13: Guest user sees "Hello Guest"
    it("displays 'Hello Guest' when user is not authenticated", async () => {
      useAuth.mockReturnValue([{ user: null, token: null }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(emptyCart));
      await renderCartPage();
      expect(screen.getByText("Hello Guest")).toBeInTheDocument();
    });

    // Test 14: Authenticated user sees name
    it("displays user name when authenticated", async () => {
      useCart.mockReturnValue(mockCartContext(emptyCart));
      await renderCartPage();
      expect(screen.getByText(/Hello\s+Test User/i)).toBeInTheDocument();
    });

    // Test 15: Shows current address if user has address
    it("displays current address when user has address", async () => {
      useCart.mockReturnValue(mockCartContext(emptyCart));
      await renderCartPage();
      expect(screen.getByText("Current Address")).toBeInTheDocument();
      expect(screen.getByText("123 Test St")).toBeInTheDocument();
    });

    // Test 16: Update address navigation
    it("navigates to profile when Update Address is clicked", async () => {
      useCart.mockReturnValue(mockCartContext(emptyCart));
      await renderCartPage();
      fireEvent.click(screen.getByRole("button", { name: "Update Address" }));
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/profile");
    });

    // Test 17: Login button for guest users
    it("shows login button for guest users and navigates to login on click", async () => {
      useAuth.mockReturnValue([{ user: null, token: null }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(mockCart));
      await renderCartPage();

      const loginButton = screen.getByRole("button", { name: /Please Login to checkout/i });
      expect(loginButton).toBeInTheDocument();
      fireEvent.click(loginButton);
      expect(mockNavigate).toHaveBeenCalledWith("/login", { state: "/cart" });
    });

    // Test 18: Update Address button shown when logged in but no address
    it("shows Update Address button when user is logged in without address", async () => {
      useAuth.mockReturnValue([{ user: { name: "Test User", address: null }, token: "test-token" }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(emptyCart));
      await renderCartPage();
      expect(screen.getByRole("button", { name: "Update Address" })).toBeInTheDocument();
    });
  });

  describe("Payment functionality", () => {
    const waitForDropIn = async () => {
      await waitFor(() => expect(screen.getByTestId("mock-dropin")).toBeInTheDocument());
      await new Promise((resolve) => setTimeout(resolve, 100));
    };

    // Test 19: Successful payment
    it("successfully processes payment", async () => {
      const mockContext = mockCartContext(mockCart);
      useCart.mockReturnValue(mockContext);
      render(<CartPage />);

      await waitForDropIn();
      fireEvent.click(screen.getByText("Make Payment"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/v1/product/braintree/payment", {
          nonce: "test-payment-nonce",
          cart: mockCart,
        });
      });

      expect(mockContext.clearCart).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/orders");
      expect(toast.success).toHaveBeenCalledWith("Payment Completed Successfully ");
    });

    // Test 20: Payment error handling
    it("handles payment error by showing error toast", async () => {
      axios.post.mockRejectedValueOnce(new Error("Payment failed"));
      useCart.mockReturnValue(mockCartContext(mockCart));

      render(<CartPage />);
      const consoleSpy = jest.spyOn(console, "log");
      await waitForDropIn();
      fireEvent.click(screen.getByText("Make Payment"));

      await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
      expect(toast.error).toHaveBeenCalledWith("Payment failed. Please try again.");
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByText("Make Payment")).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    // Test 21: Loading state during payment
    it("shows loading state during payment processing", async () => {
      let resolvePaymentMethod;
      const paymentPromise = new Promise((resolve) => { resolvePaymentMethod = resolve; });
      mockRequestPaymentMethod.mockReturnValueOnce(paymentPromise);
      useCart.mockReturnValue(mockCartContext(mockCart));

      await act(async () => render(<CartPage />));
      await waitForDropIn();
      fireEvent.click(screen.getByText("Make Payment"));
      await waitFor(() => expect(screen.getByText("Processing ....")).toBeInTheDocument());

      resolvePaymentMethod({ nonce: "test-payment-nonce" });
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/orders"));
    });

  });

  describe("Pairwise Testing: Payment UI Combinations", () => {
    /*
     * PAIRWISE TEST MATRIX
     * Testing combinations of 5 parameters that affect payment UI:
     * - Auth Token: {null, valid}
     * - Cart State: {empty, has-items}
     * - Client Token: {null, valid}
     * - User Address: {null, valid}
     * - DropIn Instance: {null, loaded}
     *
     * Key behaviors tested:
     * 1. DropIn Visibility: canShowPayment = clientToken && auth?.token && hasItems
     * 2. Button Disabled: disabled = loading || !instance || !auth?.user?.address
     *
     * 12 test cases cover all pairwise combinations
     */

    const waitForDropIn = async () => {
      await waitFor(() => expect(screen.getByTestId("mock-dropin")).toBeInTheDocument());
      await new Promise((resolve) => setTimeout(resolve, 100));
    };

    // Test 1: Guest user, empty cart, no tokens
    // Pairs: (auth:null, cart:empty), (cart:empty, clientToken:null), (address:null, instance:null)
    it("Test 1: Guest with empty cart - no DropIn shown", async () => {
      useAuth.mockReturnValue([{ user: null, token: null }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(emptyCart));
      axios.get.mockResolvedValue({ data: { clientToken: null } });

      await renderCartPage();

      expect(screen.queryByTestId("mock-dropin")).not.toBeInTheDocument();
    });

    // Test 2: Logged in user, empty cart, has all tokens/address
    // Pairs: (auth:valid, cart:empty), (cart:empty, clientToken:valid), (address:valid, instance:null)
    it("Test 2: Logged in with empty cart - no DropIn (empty cart blocks)", async () => {
      useAuth.mockReturnValue([{ user: { name: "Test User", address: "123 Test St" }, token: "test-token" }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(emptyCart));
      axios.get.mockResolvedValue({ data: { clientToken: "test-client-token" } });

      await renderCartPage();

      expect(screen.queryByTestId("mock-dropin")).not.toBeInTheDocument();
    });

    // Test 3: Happy path - all conditions met, payment ready
    // Pairs: (auth:valid, cart:has-items), (clientToken:valid, address:valid), (instance:loaded, cart:has-items)
    it("Test 3: All conditions met - DropIn shown, button enabled", async () => {
      useAuth.mockReturnValue([{ user: { name: "Test User", address: "123 Test St" }, token: "test-token" }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(mockCart));
      axios.get.mockResolvedValue({ data: { clientToken: "test-client-token" } });

      render(<CartPage />);
      await waitForDropIn();

      expect(screen.getByTestId("mock-dropin")).toBeInTheDocument();
      expect(screen.getByText("Make Payment")).not.toBeDisabled();
    });

    // Test 4: Logged in, has items, no address (blocks payment)
    // Pairs: (auth:valid, address:null), (address:null, cart:has-items), (instance:loaded, address:null)
    it("Test 4: No address - DropIn shown, button disabled", async () => {
      useAuth.mockReturnValue([{ user: { name: "Test User", address: null }, token: "test-token" }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(mockCart));
      axios.get.mockResolvedValue({ data: { clientToken: "test-client-token" } });

      render(<CartPage />);
      await waitForDropIn();

      expect(screen.getByTestId("mock-dropin")).toBeInTheDocument();
      expect(screen.getByText("Make Payment")).toBeDisabled();
    });

    // Test 5: Has items, has address, but instance not loaded yet
    // Pairs: (instance:null, clientToken:valid), (instance:null, auth:valid), (address:valid, instance:null)
    it("Test 5: Instance not loaded - DropIn shown, button disabled", async () => {
      // Mock DropIn to NOT call onInstance
      jest.spyOn(require("braintree-web-drop-in-react"), "default").mockImplementation((props) => {
        return <div data-testid="mock-dropin">Mock DropIn (no instance)</div>;
      });

      useAuth.mockReturnValue([{ user: { name: "Test User", address: "123 Test St" }, token: "test-token" }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(mockCart));
      axios.get.mockResolvedValue({ data: { clientToken: "test-client-token" } });

      await act(async () => render(<CartPage />));
      await waitFor(() => expect(screen.getByTestId("mock-dropin")).toBeInTheDocument());

      expect(screen.getByText("Make Payment")).toBeDisabled();
    });

    // Test 6: Client token fetch failed, has items and address
    // Pairs: (clientToken:null, cart:has-items), (clientToken:null, address:valid), (clientToken:null, auth:valid)
    it("Test 6: Client token null - no DropIn shown", async () => {
      useAuth.mockReturnValue([{ user: { name: "Test User", address: "123 Test St" }, token: "test-token" }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(mockCart));
      axios.get.mockResolvedValue({ data: { clientToken: null } });

      await renderCartPage();

      expect(screen.queryByTestId("mock-dropin")).not.toBeInTheDocument();
    });

    // Test 7: Guest user with items in cart
    // Pairs: (auth:null, cart:has-items), (auth:null, clientToken:null), (auth:null, instance:null)
    it("Test 7: Guest with items - no DropIn (no auth blocks)", async () => {
      useAuth.mockReturnValue([{ user: null, token: null }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(mockCart));
      axios.get.mockResolvedValue({ data: { clientToken: null } });

      await renderCartPage();

      expect(screen.queryByTestId("mock-dropin")).not.toBeInTheDocument();
    });

    // Test 8: Logged in with items, but no token and no address
    // Pairs: (clientToken:null, address:null), (auth:valid, clientToken:null), (instance:null, cart:has-items)
    it("Test 8: No client token, no address - no DropIn shown", async () => {
      useAuth.mockReturnValue([{ user: { name: "Test User", address: null }, token: "test-token" }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(mockCart));
      axios.get.mockResolvedValue({ data: { clientToken: null } });

      await renderCartPage();

      expect(screen.queryByTestId("mock-dropin")).not.toBeInTheDocument();
    });

    // Test 9: Guest, empty cart, but has client token (edge case)
    // Pairs: (auth:null, clientToken:valid), (cart:empty, address:null), (auth:null, address:null)
    it("Test 9: Guest, empty cart with token - no DropIn (multiple blocks)", async () => {
      useAuth.mockReturnValue([{ user: null, token: null }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(emptyCart));
      axios.get.mockResolvedValue({ data: { clientToken: "test-client-token" } });

      await renderCartPage();

      expect(screen.queryByTestId("mock-dropin")).not.toBeInTheDocument();
    });

    // Test 10: Logged in, empty cart, no client token, no address
    // Pairs: (cart:empty, address:null), (auth:valid, instance:null), (clientToken:null, instance:null)
    it("Test 10: Empty cart, no token - no DropIn shown", async () => {
      useAuth.mockReturnValue([{ user: { name: "Test User", address: null }, token: "test-token" }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(emptyCart));
      axios.get.mockResolvedValue({ data: { clientToken: null } });

      await renderCartPage();

      expect(screen.queryByTestId("mock-dropin")).not.toBeInTheDocument();
    });

    // Test 11: Guest with items, has client token and instance (but no auth)
    // Pairs: (auth:null, instance:loaded), (clientToken:valid, cart:has-items), (instance:loaded, clientToken:valid)
    it("Test 11: Guest with token & instance - no DropIn (auth blocks)", async () => {
      useAuth.mockReturnValue([{ user: null, token: null }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(mockCart));
      axios.get.mockResolvedValue({ data: { clientToken: "test-client-token" } });

      await renderCartPage();

      expect(screen.queryByTestId("mock-dropin")).not.toBeInTheDocument();
    });

    // Test 12: Logged in with items, has token, but no address and no instance
    // Pairs: (address:null, instance:null), (clientToken:valid, address:null), (instance:null, address:null)
    it("Test 12: No address, no instance - DropIn shown, button disabled", async () => {
      // Mock DropIn to NOT call onInstance
      jest.spyOn(require("braintree-web-drop-in-react"), "default").mockImplementation((props) => {
        return <div data-testid="mock-dropin">Mock DropIn (no instance)</div>;
      });

      useAuth.mockReturnValue([{ user: { name: "Test User", address: null }, token: "test-token" }, jest.fn()]);
      useCart.mockReturnValue(mockCartContext(mockCart));
      axios.get.mockResolvedValue({ data: { clientToken: "test-client-token" } });

      await act(async () => render(<CartPage />));
      await waitFor(() => expect(screen.getByTestId("mock-dropin")).toBeInTheDocument());

      expect(screen.getByText("Make Payment")).toBeDisabled();
    });
  });
});

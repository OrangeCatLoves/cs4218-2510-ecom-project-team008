/*
cart context should provide:
  - addToCart() with inventory validation
  - removeFromCart()
  - updateQuantity() with stock checking
  - clearCart()
  - User-specific storage (cart-${user})
*/

import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "./auth";

const CartContext = createContext();

// Helper function to get cart storage key
const getCartKey = (auth) => `cart-${auth?.user?.name ?? "guest"}`;

// Shared validation function for product operations
const validateProduct = async (slug, currentQuantity, desiredQuantity) => {
  const { data } = await axios.get(`/api/v1/product/get-product/${slug}`);

  if (!data.product) {
    throw new Error("Item does not exist");
  }

  if (!data.product.price) {
    throw new Error("Price of product not available");
  }

  if (desiredQuantity > data.product.quantity) {
    throw new Error("Not enough inventory");
  }

  return data.product;
};

const cartReducer = (state, action) => {
  switch (action.type) {
    case "ADD_TO_CART": {
      const { slug, price, productId } = action.payload;
      toast.success("Add to Cart Successfully");
      return {
        ...state,
        [slug]: state[slug]
          ? { quantity: state[slug].quantity + 1, price, productId }
          : { quantity: 1, price, productId },
      };
    }
    case "REMOVE_FROM_CART": {
      const { slug } = action.payload;
      const { [slug]: removed, ...rest } = state;
      toast.success("Remove from Cart Successfully");
      return rest;
    }
    case "UPDATE_QUANTITY": {
      const { slug, quantity, price, productId } = action.payload;
      if (quantity <= 0) {
        const { [slug]: removed, ...rest } = state;
        return rest;
      }
      toast.success("Update Cart Quantity Successfully");
      return {
        ...state,
        [slug]: { quantity, price, productId },
      };
    }
    case "CLEAR_CART":
      toast.success("Cart Cleared Successfully");
      return {};
    case "SET_CART":
      return action.payload;
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {
  const [auth] = useAuth();
  const [cart, dispatch] = useReducer(cartReducer, {});

  // Memoize cart key to avoid recalculation
  const cartKey = useMemo(() => getCartKey(auth), [auth]);

  // Load cart from localStorage on mount or auth change
  useEffect(() => {
    const localData = localStorage.getItem(cartKey);
    dispatch({
      type: "SET_CART",
      payload: localData ? JSON.parse(localData) : {},
    });
  }, [cartKey]);

  // Persist cart to localStorage on cart change
  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);

  const addToCart = async (slug) => {
    try {
      const currentQuantity = cart[slug]?.quantity ?? 0;
      const product = await validateProduct(slug, currentQuantity, currentQuantity + 1);

      dispatch({
        type: "ADD_TO_CART",
        payload: { slug, price: product.price, productId: product._id },
      });
    } catch (error) {
      const errorMessage = error.message === "Not enough inventory"
        ? "Error added to cart: Not enough inventory"
        : error.message === "Price of product not available"
        ? "Error added to cart: Price of product not available"
        : error.message;
      toast.error(errorMessage);
    }
  };

  const removeFromCart = (slug) => {
    dispatch({ type: "REMOVE_FROM_CART", payload: { slug } });
  };

  const updateQuantity = async (slug, quantity) => {
    try {
      const currentQuantity = cart[slug]?.quantity ?? 0;
      const product = await validateProduct(slug, currentQuantity, quantity);

      dispatch({
        type: "UPDATE_QUANTITY",
        payload: { slug, quantity, price: product.price, productId: product._id },
      });
    } catch (error) {
      const errorMessage = error.message === "Not enough inventory"
        ? "Error updating quantity: Not enough inventory"
        : error.message === "Price of product not available"
        ? "Error added to cart: Price of product not available"
        : error.message;
      toast.error(errorMessage);
    }
  };

  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" });
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
import React, { useState, useEffect } from "react";
import Layout from "./../components/Layout";
import { useCart } from "../context/cart";
import { useAuth } from "../context/auth";
import { useNavigate } from "react-router-dom";
import DropIn from "braintree-web-drop-in-react";
import { AiFillWarning } from "react-icons/ai";
import axios from "axios";
import toast from "react-hot-toast";
import "../styles/CartStyles.css";

const CartPage = () => {
  const [auth, setAuth] = useAuth();
  const { cart, removeFromCart, clearCart, updateQuantity } = useCart();
  const [clientToken, setClientToken] = useState("");
  const [instance, setInstance] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Computed values
  const cartItemCount = Object.keys(cart || {}).length;
  const hasItems = cartItemCount > 0;
  const canShowPayment = clientToken && auth?.token && hasItems;

  //total price
  const totalPrice = () => {
    let total = 0;
    Object.values(cart || {}).forEach((item) => {
      total = total + item.price * item.quantity;
    });
    return total.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  };
  //delete item
  const removeCartItem = (slug) => {
    removeFromCart(slug);
  };

  //get payment gateway token
  const getToken = async () => {
    try {
      const { data } = await axios.get("/api/v1/product/braintree/token");
      setClientToken(data?.clientToken);
    } catch (error) {
      console.log(error);
      toast.error("Failed to initialize payment gateway");
    }
  };
  useEffect(() => {
    getToken();
  }, [auth?.token]);

  //handle payments
  const handlePayment = async () => {
    try {
      setLoading(true);
      const { nonce } = await instance.requestPaymentMethod();
      const { data } = await axios.post("/api/v1/product/braintree/payment", {
        nonce,
        cart,
      });
      setLoading(false);
      clearCart();
      navigate("/dashboard/user/orders");
      toast.success("Payment Completed Successfully ");
    } catch (error) {
      console.log(error);
      toast.error("Payment failed. Please try again.");
      setLoading(false);
    }
  };

  // Navigation handler
  const navigateToProfile = () => navigate("/dashboard/user/profile");
  return (
    <Layout>
      <div className=" cart-page">
        <div className="row">
          <div className="col-md-12">
            <h1 className="text-center bg-light p-2 mb-1">
              {auth?.user ? `Hello  ${auth.user.name}` : "Hello Guest"}
              <p className="text-center">
                {hasItems
                  ? `You Have ${cartItemCount} items in your cart ${
                      auth?.token ? "" : "please login to checkout !"
                    }`
                  : " Your Cart Is Empty"}
              </p>
            </h1>
          </div>
        </div>
        <div className="container ">
          <div className="row ">
            <div className="col-md-7  p-0 m-0">
              {Object.entries(cart || {}).map(([slug, item]) => (
                <div className="row card flex-row" key={slug}>
                  <div className="col-md-4">
                    <img
                      src={`/api/v1/product/product-photo/${item.productId}`}
                      className="card-img-top"
                      alt={slug}
                      width="100%"
                      height={"130px"}
                    />
                  </div>
                  <div className="col-md-4">
                    <p>{slug}</p>
                    <p>Quantity: {item.quantity}</p>
                    <div className="quantity-controls mb-2">
                      <button
                        className="btn btn-sm btn-secondary me-2"
                        onClick={() => updateQuantity(slug, item.quantity - 1)}
                      >
                        -
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => updateQuantity(slug, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <p>Price : ${item.price}</p>
                  </div>
                  <div className="col-md-4 cart-remove-btn">
                    <button
                      className="btn btn-danger"
                      onClick={() => removeCartItem(slug)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="col-md-5 cart-summary ">
              <h2>Cart Summary</h2>
              <p>Total | Checkout | Payment</p>
              <hr />
              <h4>Total : {totalPrice()} </h4>
              {auth?.user?.address ? (
                <div className="mb-3">
                  <h4>Current Address</h4>
                  <h5>{auth.user.address}</h5>
                  <button
                    className="btn btn-outline-warning"
                    onClick={navigateToProfile}
                  >
                    Update Address
                  </button>
                </div>
              ) : (
                <div className="mb-3">
                  {auth?.token ? (
                    <button
                      className="btn btn-outline-warning"
                      onClick={navigateToProfile}
                    >
                      Update Address
                    </button>
                  ) : (
                    <button
                      className="btn btn-outline-warning"
                      onClick={() =>
                        navigate("/login", {
                          state: "/cart",
                        })
                      }
                    >
                      Please Login to checkout
                    </button>
                  )}
                </div>
              )}
              <div className="mt-2">
                {canShowPayment && (
                  <>
                    <DropIn
                      options={{
                        authorization: clientToken,
                        paypal: {
                          flow: "vault",
                        },
                      }}
                      onInstance={(instance) => setInstance(instance)}
                    />

                    <button
                      className="btn btn-primary"
                      onClick={handlePayment}
                      disabled={loading || !instance || !auth?.user?.address}
                    >
                      {loading ? "Processing ...." : "Make Payment"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CartPage;
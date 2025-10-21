import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter } from "react-router-dom";

import AdminOrders from "../../../pages/admin/AdminOrders.js";
import { AuthProvider } from "../../../context/auth.js";

// shallow layout/menu for speed
jest.mock("../../../components/Layout.js", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));
jest.mock("../../../components/AdminMenu.js", () => () => (
  <div data-testid="admin-menu">Admin Menu</div>
));

// Mock Ant Design Select to work in jsdom
jest.mock("antd", () => {
  const actual = jest.requireActual("antd");
  const React = require("react");

  const MockOption = ({ value, children }) => (
    <span data-mock-option value={value}>
      {children}
    </span>
  );

  function MockSelect({
    children,
    onChange,
    value,
    placeholder,
    options: optionsProp,
    showSearch,
    variant,
    size,
    className,
    ...props
  }) {
    const childOpts = React.Children.toArray(children)
      .filter(Boolean)
      .map((opt, idx) => {
        const v = opt.props?.value;
        const label = opt.props?.children;
        return {
          key: `child-${idx}-${String(v)}`,
          value: v,
          label,
        };
      });

    const propOpts = Array.isArray(optionsProp)
      ? optionsProp.map((o, idx) => ({
          key: `prop-${idx}-${String(o?.value)}`,
          value: o?.value,
          label: o?.label ?? String(o?.value ?? ""),
        }))
      : [];

    const allOpts = [...childOpts, ...propOpts];

    return (
      <select
        data-testid="ant-select"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className={className}
        {...props}
      >
        <option value="">{placeholder}</option>
        {allOpts.map((opt) => (
          <option key={opt.key} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  MockSelect.Option = MockOption;

  return {
    ...actual,
    Select: MockSelect,
  };
});

jest.mock("axios");
jest.mock("react-hot-toast");

// helpers (to avoid act warnings)
const tick = () => new Promise((r) => setTimeout(r, 0));
const actAsync = async (fn) => {
  await act(async () => {
    await fn();
    await tick();
  });
};

describe("AdminOrders — Integration", () => {
  const mockAdmin = { name: "Admin", role: 1 };
  const orders = [
    {
      _id: "order1",
      status: "Processing",
      buyer: { name: "John Doe" },
      createdAt: "2024-01-15T10:30:00.000Z",
      payment: { success: true },
      products: [
        {
          _id: "p1",
          name: "Gaming Laptop",
          description: "High performance laptop with RTX",
          price: 1500,
        },
        {
          _id: "p2",
          name: "Wireless Mouse",
          description: "Ergonomic mouse long battery",
          price: 50,
        },
      ],
    },
    {
      _id: "order2",
      status: "Shipped",
      buyer: { name: "Jane Smith" },
      createdAt: "2024-01-14T14:20:00.000Z",
      payment: { success: false },
      products: [
        {
          _id: "p3",
          name: "Mechanical Keyboard",
          description: "RGB mechanical switches",
          price: 120,
        },
      ],
    },
  ];

  const Providers = ({ children }) => (
    <AuthProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </AuthProvider>
  );

  beforeAll(() => {
    // make AntD media queries happy
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: mockAdmin, token: "mock-token" })
    );

    // default: load orders successfully
    axios.get.mockResolvedValue({ data: orders });
    axios.put.mockResolvedValue({ data: { success: true } });

    toast.success = jest.fn();
    toast.error = jest.fn();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderPage = () =>
    render(
      <Providers>
        <AdminOrders />
      </Providers>
    );

  // load and render
  test("fetches orders (auth present) and renders buyer + products", async () => {
    renderPage();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/all-orders");
    });

    // buyers
    expect(await screen.findByText("John Doe")).toBeInTheDocument();
    expect(await screen.findByText("Jane Smith")).toBeInTheDocument();

    // product names (nested list) - products appear multiple times in the UI
    expect(screen.getAllByText("Gaming Laptop").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wireless Mouse").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mechanical Keyboard").length).toBeGreaterThan(0);

    // payment labels (Success/Failed)
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
  });

  test("does not fetch orders if auth token is missing", async () => {
    localStorage.removeItem("auth");
    renderPage();

    // give effects a chance to run
    await tick();
    expect(axios.get).not.toHaveBeenCalled();
  });

  // product images
  test("renders product images using photo API endpoints", async () => {
    renderPage();

    const imgs = await screen.findAllByRole("img");
    const photoSrcs = imgs.map((img) => img.getAttribute("src") || "");

    // at least 3 products -> expect photo URLs present
    expect(
      photoSrcs.filter((s) => s.includes("/api/v1/product/product-photo/"))
        .length
    ).toBeGreaterThanOrEqual(3);
  });

  // status updates
  test("changes order status via Select → PUT API → success toast → refresh list", async () => {
    // second GET after update returns updated list
    axios.get
      .mockResolvedValueOnce({ data: orders }) // initial
      .mockResolvedValueOnce({
        data: [{ ...orders[0], status: "Shipped" }, orders[1]],
      });

    renderPage();

    // Wait for orders to load
    await waitFor(() => {
      expect(screen.getAllByTestId("order-status-option").length).toBeGreaterThan(0);
    });

    // Use the mocked select to change status
    await actAsync(async () => {
      const selects = screen.getAllByTestId("order-status-option");
      await userEvent.selectOptions(selects[0], "Shipped");
    });

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/auth/order-status/order1",
        { status: "Shipped" }
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Order status updated successfully"
      );
    });

    // verify refresh: GET called twice (initial + after update)
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  test("shows error toast when status update fails, list not refreshed", async () => {
    axios.put.mockRejectedValueOnce(new Error("Update failed"));
    renderPage();

    // Wait for orders to load
    await waitFor(() => {
      expect(screen.getAllByTestId("order-status-option").length).toBeGreaterThan(0);
    });

    await actAsync(async () => {
      const selects = screen.getAllByTestId("order-status-option");
      await userEvent.selectOptions(selects[0], "Delivered");
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Error updating order status");
    });

    // still only the initial GET (no refresh)
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  // empty and error paths
  test("renders empty state safely (no orders)", async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    renderPage();

    expect(await screen.findByText("All Orders")).toBeInTheDocument();
    // no buyers
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  test("load failure: shows toast error and keeps page structure", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    axios.get.mockRejectedValueOnce(new Error("Network error"));

    renderPage();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Error loading orders");
      expect(screen.getByText("All Orders")).toBeInTheDocument();
    });

    spy.mockRestore();
  });

  // null safety (data)
  test("handles null payment object (shows Failed, no crash)", async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ ...orders[0], payment: null }],
    });

    renderPage();

    expect(await screen.findByText("Failed")).toBeInTheDocument();
  });

  test("handles null product description (renders fallback text, no crash)", async () => {
    axios.get.mockResolvedValueOnce({
      data: [
        {
          ...orders[0],
          products: [
            { _id: "z", name: "NoDesc Product", description: null, price: 1 },
          ],
        },
      ],
    });

    renderPage();

    // Product name appears twice in the UI
    expect((await screen.findAllByText("NoDesc Product")).length).toBeGreaterThan(0);
    // no description safe fallback - also appears twice
    expect((await screen.findAllByText(/No description/i)).length).toBeGreaterThan(0);
  });

  // presence/structure smoke (not style)
  test("renders inside Layout + AdminMenu (integration smoke)", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByText("Admin Menu")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /All Orders/i })
      ).toBeInTheDocument();
    });
  });
});

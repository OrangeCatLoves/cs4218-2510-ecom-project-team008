import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import toast from "react-hot-toast";
import AdminOrders from "./AdminOrders";

// mocks
jest.mock("axios", () => ({
  get: jest.fn(),
  put: jest.fn(),
}));

jest.mock("react-hot-toast", () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

// moment(o.createdAt).fromNow() → “2 days ago”
jest.mock("moment", () => {
  const actualMoment = jest.requireActual("moment");
  return (date) => {
    const m = actualMoment(date);
    return { ...m, fromNow: () => "2 days ago" };
  };
});

jest.mock("antd", () => {
  const MockSelect = ({
    children,
    defaultValue,
    onChange,
    variant,
    ...rest
  }) => (
    <select
      data-testid="status-select"
      data-variant={variant}
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
      {...rest}
    >
      {children}
    </select>
  );
  const MockOption = ({ children, value }) => (
    <option value={value}>{children}</option>
  );
  return { Select: Object.assign(MockSelect, { Option: MockOption }) };
});

// Minimal shells for layout/menu
jest.mock("../../components/Layout", () => ({ children, title }) => (
  <div data-testid="layout" data-title={title}>
    {children}
  </div>
));
jest.mock("../../components/AdminMenu", () => () => (
  <nav data-testid="admin-menu" />
));

// useAuth: token present by default (override per test as needed)
const mockUseAuth = jest.fn(() => [{ token: "test-token", user: { role: 1 } }]);
jest.mock("../../context/auth", () => ({ useAuth: () => mockUseAuth() }));

// helpers
const ordersOne = [
  {
    _id: "order1",
    status: "Processing",
    buyer: { name: "Alice Smith" },
    createdAt: "2024-01-01T00:00:00Z",
    payment: { success: true },
    products: [
      { _id: "p1", name: "Laptop", description: "Gaming laptop", price: 1500 },
    ],
  },
];

const ordersTwo = [
  {
    _id: "orderA",
    status: "Shipped",
    buyer: { name: "Alice" },
    createdAt: "2024-01-01T00:00:00Z",
    payment: { success: true },
    products: [{ _id: "p1", name: "Item1", description: "Desc", price: 50 }],
  },
  {
    _id: "orderB",
    status: "Delivered",
    buyer: { name: "Bob" },
    createdAt: "2024-01-02T00:00:00Z",
    payment: { success: false },
    products: [{ _id: "p2", name: "Item2", description: "Desc", price: 75 }],
  },
];

describe("AdminOrders Component - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue([{ token: "test-token", user: { role: 1 } }]);
  });

  // component rendering tests
  describe("Component Rendering", () => {
    test("renders layout with correct title", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: [] });

      // Act
      render(<AdminOrders />);

      // Assert
      const layout = await screen.findByTestId("layout");
      expect(layout).toHaveAttribute("data-title", "All Orders Data");
      expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /all orders/i })).toHaveClass(
        "text-center"
      );
    });

    test("renders empty state when no orders", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: [] });

      // Act
      render(<AdminOrders />);

      // Assert
      await screen.findByRole("heading", { name: /all orders/i });
      await waitFor(() => {
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
      });
    });
  });

  // data fetching tests
  describe("Data Fetching on Mount", () => {
    test("fetches orders when auth token exists", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: ordersOne });

      // Act
      render(<AdminOrders />);

      // Assert
      await screen.findByText("Alice Smith");
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/all-orders");
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test("does not fetch when auth token is missing", async () => {
      // Arrange
      mockUseAuth.mockReturnValueOnce([{ token: null }]);

      // Act
      render(<AdminOrders />);

      // Assert
      await screen.findByRole("heading", { name: /all orders/i });
      expect(axios.get).not.toHaveBeenCalled();
    });

    test("toasts on fetch error", async () => {
      // Arrange
      axios.get.mockRejectedValueOnce(new Error("Network error"));

      // Act
      render(<AdminOrders />);

      // Assert
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Error loading orders");
      });
    });
  });

  // table display tests
  describe("Order Table Display", () => {
    test("renders headers & row content", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: ordersOne });
      render(<AdminOrders />);

      // Act
      await screen.findByText("Alice Smith");

      // Assert
      ["#", "Status", "Buyer", "Date", "Payment", "Quantity"].forEach((h) =>
        expect(screen.getByText(h)).toBeInTheDocument()
      );
      expect(screen.getByText("2 days ago")).toBeInTheDocument(); // from mocked moment
      expect(screen.getByText("Success")).toBeInTheDocument();
      const allOnes = screen.getAllByText("1");
      expect(allOnes.length).toBe(2); // order index and products length
    });

    test("displays order index starting at 1", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: ordersOne });
      render(<AdminOrders />);
      await screen.findByText("Alice Smith");

      // Act / Assert
      const rows = screen.getAllByRole("row");
      const dataRow = rows[1];
      const cells = within(dataRow).getAllByRole("cell");
      expect(cells[0]).toHaveTextContent("1"); // first cell is the index
    });

    test("renders multiple orders", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: ordersTwo });
      render(<AdminOrders />);
      await screen.findByText("Alice");

      // Act / Assert
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Item1")).toBeInTheDocument();
      expect(screen.getByText("Item2")).toBeInTheDocument();
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
  });

  // select dropdown tests
  describe("Status Select Dropdown", () => {
    test("uses borderless variant & default value equals order status", async () => {
      // Arrange
      const shippedOrder = [{ ...ordersOne[0], status: "Shipped" }];
      axios.get.mockResolvedValueOnce({ data: shippedOrder });
      render(<AdminOrders />);
      await screen.findByText("Alice Smith");

      // Act
      const select = screen.getByTestId("status-select");

      // Assert
      expect(select).toHaveAttribute("data-variant", "borderless");
      // defaultValue is reflected by current selected option
      expect(select).toHaveDisplayValue("Shipped");
    });

    test("renders all status options", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: ordersOne });
      render(<AdminOrders />);
      await screen.findByText("Alice Smith");

      // Act
      const select = screen.getByTestId("status-select");
      const options = within(select)
        .getAllByRole("option")
        .map((o) => o.textContent);

      // Assert
      expect(options).toEqual([
        "Not Process",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ]);
    });
  });

  // status update tests
  describe("Status Update", () => {
    test("PUTs new status, toasts success, refetches", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: ordersOne }); // initial
      axios.put.mockResolvedValueOnce({ data: { success: true } });
      axios.get.mockResolvedValueOnce({ data: ordersOne }); // refetch after update
      render(<AdminOrders />);
      await screen.findByText("Alice Smith");
      const select = screen.getByTestId("status-select");

      // Act
      await userEvent.selectOptions(select, "Shipped");

      // Assert
      await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
          "/api/v1/auth/order-status/order1",
          { status: "Shipped" }
        );
      });
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Order status updated successfully"
        );
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2)); // initial + refetch
    });

    test("toasts error and does not refetch on PUT failure", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: ordersOne });
      axios.put.mockRejectedValueOnce(new Error("Server error"));
      render(<AdminOrders />);
      await screen.findByText("Alice Smith");
      const select = screen.getByTestId("status-select");

      // Act
      await userEvent.selectOptions(select, "Cancelled");

      // Assert
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Error updating order status");
      });
      // Only initial GET
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  // product display tests
  describe("Product Display", () => {
    test("shows product name, truncated description & price", async () => {
      // Arrange
      const bookOrder = [
        {
          ...ordersOne[0],
          products: [
            {
              _id: "pp",
              name: "Book",
              description:
                "This is a very long description that should be truncated",
              price: 25,
            },
          ],
        },
      ];
      axios.get.mockResolvedValueOnce({ data: bookOrder });
      render(<AdminOrders />);
      await screen.findByText("Book");

      // Act / Assert
      expect(
        screen.getByText("This is a very long descriptio")
      ).toBeInTheDocument(); // 30 chars
      expect(screen.getByText("Price : 25")).toBeInTheDocument();
    });

    test("shows product image with proper src & dimensions", async () => {
      // Arrange
      const cameraOrder = [
        {
          ...ordersOne[0],
          products: [
            { _id: "prod123", name: "Camera", description: "DSLR", price: 800 },
          ],
        },
      ];
      axios.get.mockResolvedValueOnce({ data: cameraOrder });
      render(<AdminOrders />);

      // Act
      const img = await screen.findByAltText("Camera");

      // Assert
      expect(img).toHaveAttribute(
        "src",
        "/api/v1/product/product-photo/prod123"
      );
      expect(img).toHaveAttribute("width", "100px");
      expect(img).toHaveAttribute("height", "100px");
    });
  });

  // edge cases
  describe("Edge Cases & Boundaries", () => {
    test("handles missing buyer/product/payment safely", async () => {
      // Arrange
      const edgeCaseOrder = [
        {
          _id: "o3",
          status: "Cancelled",
          buyer: null,
          createdAt: null,
          payment: {},
          products: [],
        },
      ];
      axios.get.mockResolvedValueOnce({ data: edgeCaseOrder });
      render(<AdminOrders />);
      await waitFor(() =>
        expect(screen.getByTestId("status-select")).toBeInTheDocument()
      );

      // Act / Assert
      expect(screen.getByText("0")).toBeInTheDocument(); // quantity
      expect(screen.getByText("Failed")).toBeInTheDocument(); // falsy payment.success
      const select = screen.getByTestId("status-select");
      expect(select).toHaveDisplayValue("Cancelled");
    });

    test("handles exact 30-char description & zero price", async () => {
      // Arrange
      const mugOrder = [
        {
          ...ordersOne[0],
          products: [
            {
              _id: "pA",
              name: "Mug",
              description: "123456789012345678901234567890",
              price: 0,
            },
          ],
        },
      ];
      axios.get.mockResolvedValueOnce({ data: mugOrder });
      render(<AdminOrders />);
      await screen.findByText("Mug");

      // Act / Assert
      expect(
        screen.getByText("123456789012345678901234567890")
      ).toBeInTheDocument();
      expect(screen.getByText("Price : 0")).toBeInTheDocument();
    });
  });

  describe("React Hygiene", () => {
    test("renders multiple order blocks cleanly", async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: ordersTwo });

      // Act
      const { container } = render(<AdminOrders />);

      // Assert
      await screen.findByText("Alice");
      const orderDivs = container.querySelectorAll(".border.shadow");
      expect(orderDivs.length).toBe(2);
    });
  });
});

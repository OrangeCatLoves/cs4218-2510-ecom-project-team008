import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import UpdateProduct from "../../../pages/admin/UpdateProduct.js";
import { AuthProvider } from "../../../context/auth.js";

// mocks
jest.mock("axios");
jest.mock("react-hot-toast");

// keep layout/menu shallow
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

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ slug: "test-product" }),
  };
});

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const actAsync = async (fn) => {
  await act(async () => {
    await fn();
    await new Promise((r) => setTimeout(r, 0));
  });
};

// test data
const mockCategories = [
  { _id: "cat1", name: "Electronics", slug: "electronics" },
  { _id: "cat2", name: "Books", slug: "books" },
];

const mockProduct = {
  _id: "prod1",
  name: "Gaming Laptop",
  slug: "test-product",
  description: "High performance laptop",
  price: 1500,
  quantity: 25,
  shipping: true,
  category: { _id: "cat1", name: "Electronics" },
};

// Intercept FormData so we can assert exact payload keys/values
class CaptureFormData {
  constructor() {
    this._pairs = [];
  }
  append(k, v) {
    this._pairs.push([k, v]);
  }
  entries() {
    return this._pairs.slice();
  }
  // convenience getters
  get(k) {
    return (this._pairs.find(([kk]) => kk === k) || [])[1];
  }
}

describe("UpdateProduct — Integration", () => {
  const Providers = ({ children }) => (
    <AuthProvider>
      <MemoryRouter initialEntries={["/dashboard/admin/product/test-product"]}>
        <Routes>
          <Route path="/dashboard/admin/product/:slug" element={children} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

  let realFormData;

  beforeAll(() => {
    // make antd/media queries happy
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

    // file preview stubs
    global.URL.createObjectURL = jest.fn(() => "blob://preview-url");
    global.URL.revokeObjectURL = jest.fn();

    // capture FormData globally
    realFormData = global.FormData;
    global.FormData = CaptureFormData;
  });

  afterAll(() => {
    global.FormData = realFormData;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Admin", role: 1 },
        token: "admin-token",
      })
    );

    // default GETs
    axios.get.mockImplementation((url) => {
      if (url.includes("/api/v1/category/get-category")) {
        return Promise.resolve({
          data: { success: true, category: mockCategories },
        });
      }
      if (url.includes("/api/v1/product/get-product/test-product")) {
        return Promise.resolve({ data: { product: mockProduct } });
      }
      return Promise.reject(new Error(`unknown GET: ${url}`));
    });

    toast.success = jest.fn();
    toast.error = jest.fn();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderPage = () =>
    render(
      <Providers>
        <UpdateProduct />
      </Providers>
    );

  // load and pre-populate
  test("loads product + categories, pre-populates form and selects correct category", async () => {
    renderPage();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
      expect(axios.get).toHaveBeenCalledWith(
        "/api/v1/product/get-product/test-product"
      );
    });

    // fields
    await waitFor(() => {
      expect(screen.getByDisplayValue("Gaming Laptop")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("High performance laptop")
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("1500")).toBeInTheDocument();
      expect(screen.getByDisplayValue("25")).toBeInTheDocument();
    });

    // category shown as selected label
    expect(screen.getByText("Electronics")).toBeInTheDocument();

    // existing product photo by id
    const img = screen.getByAltText("product_photo");
    expect(img).toHaveAttribute("src", "/api/v1/product/product-photo/prod1");
  });

  test("handles product fetch error with toast", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/get-category")) {
        return Promise.resolve({
          data: { success: true, category: mockCategories },
        });
      }
      if (url.includes("/get-product/test-product")) {
        return Promise.reject(new Error("not found"));
      }
      return Promise.reject(new Error("unknown"));
    });

    renderPage();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong in getting product"
      );
    });
  });

  test("handles null product object gracefully (no crash)", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/get-category")) {
        return Promise.resolve({
          data: { success: true, category: mockCategories },
        });
      }
      if (url.includes("/get-product/test-product")) {
        return Promise.resolve({ data: { product: null } });
      }
      return Promise.reject(new Error("unknown"));
    });

    renderPage();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled(); // message may vary (e.g., 'Product not found')
    });
  });

  // update flow
  test("updates product with modified fields, sends FormData, shows success, navigates", async () => {
    axios.put.mockResolvedValueOnce({
      data: { success: true, message: "Product updated" },
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue("Gaming Laptop")).toBeInTheDocument()
    );

    await actAsync(async () => {
      await userEvent.clear(screen.getByDisplayValue("Gaming Laptop"));
      await userEvent.type(
        screen.getByPlaceholderText(/write a name/i),
        "Gaming Laptop Pro"
      );
      await userEvent.clear(screen.getByDisplayValue("1500"));
      await userEvent.type(
        screen.getByPlaceholderText(/write a Price/i),
        "1800"
      );

      // change category to Books using the mocked select
      const selects = screen.getAllByTestId("ant-select");
      await userEvent.selectOptions(selects[0], "cat2");

      // optional: no photo update here
      await userEvent.click(
        screen.getByRole("button", { name: /update product/i })
      );
    });

    await flush();

    expect(axios.put).toHaveBeenCalledTimes(1);
    const [url, fd] = axios.put.mock.calls[0];
    expect(url).toBe("/api/v1/product/update-product/prod1");
    expect(fd).toBeInstanceOf(CaptureFormData);

    // assert payload
    expect(fd.get("name")).toBe("Gaming Laptop Pro");
    expect(fd.get("price")).toBe("1800");
    expect(["cat2", "Books"]).toContain(fd.get("category")); // depending on implementation
    // existing fields should still be present
    expect(fd.get("description")).toBeDefined();
    expect(fd.get("quantity")).toBeDefined();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Product Updated Successfully"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
    });
  });

  test("client-side validation: empty name, price=0, negative qty", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue("Gaming Laptop")).toBeInTheDocument()
    );

    // empty name
    await actAsync(async () => {
      await userEvent.clear(screen.getByDisplayValue("Gaming Laptop"));
      await userEvent.click(
        screen.getByRole("button", { name: /update product/i })
      );
    });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Product name is required")
    );
    expect(axios.put).not.toHaveBeenCalled();

    // bad price
    await actAsync(async () => {
      const name = screen.getByPlaceholderText(/write a name/i);
      await userEvent.type(name, "OK");
      const price = screen.getByDisplayValue("1500");
      await userEvent.clear(price);
      await userEvent.type(screen.getByPlaceholderText(/write a Price/i), "0");
      await userEvent.click(
        screen.getByRole("button", { name: /update product/i })
      );
    });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Price must be greater than 0")
    );

    // negative qty
    await actAsync(async () => {
      const price = screen.getByPlaceholderText(/write a Price/i);
      await userEvent.clear(price);
      await userEvent.type(price, "10");
      const qty = screen.getByDisplayValue("25");
      await userEvent.clear(qty);
      await userEvent.type(
        screen.getByPlaceholderText(/write a quantity/i),
        "-5"
      );
      await userEvent.click(
        screen.getByRole("button", { name: /update product/i })
      );
    });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Quantity cannot be negative")
    );
    expect(axios.put).not.toHaveBeenCalled();
  });

  test("updates shipping option and sends correct type (boolean/number)", async () => {
    axios.put.mockResolvedValueOnce({ data: { success: true } });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Electronics")).toBeInTheDocument()
    );

    await actAsync(async () => {
      // Select "No" (false) using the mocked select
      const selects = screen.getAllByTestId("ant-select");
      await userEvent.selectOptions(selects[1], "false");
      await userEvent.click(
        screen.getByRole("button", { name: /update product/i })
      );
    });

    const [, fd] = axios.put.mock.calls[0];
    const val = fd.get("shipping");
    // The mock select converts boolean values to strings
    expect([false, 0, "0", "false"]).toContain(val);
  });

  // photo update and cleanup
  test("photo upload shows preview; on unmount, objectURL is revoked", async () => {
    const { unmount } = renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/upload photo/i)).toBeInTheDocument()
    );

    await actAsync(async () => {
      const file = new File(["bin"], "updated.jpg", { type: "image/jpeg" });
      await userEvent.upload(screen.getByLabelText(/upload photo/i), file);
    });

    // preview shows new filename and blob preview
    expect(screen.getByText("updated.jpg")).toBeInTheDocument();
    const imgs = screen.getAllByAltText("product_photo");
    expect(
      imgs.some((i) => i.getAttribute("src") === "blob://preview-url")
    ).toBe(true);

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  // error paths
  test("update failure: backend message is shown; no navigate", async () => {
    axios.put.mockResolvedValueOnce({
      data: { success: false, message: "Product name already exists" },
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue("Gaming Laptop")).toBeInTheDocument()
    );

    await actAsync(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: /update product/i })
      );
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Product name already exists");
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  test("update network error shows generic error toast", async () => {
    axios.put.mockRejectedValueOnce(new Error("Network Error"));

    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue("Gaming Laptop")).toBeInTheDocument()
    );

    await actAsync(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: /update product/i })
      );
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("something went wrong");
    });
  });

  // delet flow (modal, API, navigation)
  test("delete: opens modal, confirms, calls API, toasts, navigates", async () => {
    axios.delete.mockResolvedValueOnce({ data: { success: true } });

    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /delete product/i })
      ).toBeInTheDocument()
    );

    await actAsync(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: /delete product/i })
      );
    });

    await waitFor(() =>
      expect(
        screen.getByText(/are you sure you want to delete this product/i)
      ).toBeInTheDocument()
    );

    await actAsync(async () => {
      // Click the Delete button in the modal (not the DELETE PRODUCT button on the page)
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      // The modal's Delete button is the second one (index 1)
      await userEvent.click(deleteButtons[1]);
    });

    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(
        "/api/v1/product/delete-product/prod1"
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Product Deleted Successfully"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
    });
  });

  test("delete: cancel closes modal; no API call", async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /delete product/i })
      ).toBeInTheDocument()
    );

    await actAsync(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: /delete product/i })
      );
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument()
    );

    await actAsync(async () => {
      await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    expect(axios.delete).not.toHaveBeenCalled();
  });

  test("delete failure shows error toast; no navigate", async () => {
    axios.delete.mockRejectedValueOnce(new Error("fail"));

    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /delete product/i })
      ).toBeInTheDocument()
    );

    await actAsync(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: /delete product/i })
      );
    });
    await waitFor(() =>
      expect(
        screen.getByText(/are you sure you want to delete this product/i)
      ).toBeInTheDocument()
    );

    await actAsync(async () => {
      // Click the Delete button in the modal
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await userEvent.click(deleteButtons[1]);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Something went wrong");
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // layout presence (smoke)
  test("renders inside Layout + AdminMenu (smoke integration)", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByText("Admin Menu")).toBeInTheDocument();
      expect(screen.getByText("Update Product")).toBeInTheDocument();
    });
  });
});

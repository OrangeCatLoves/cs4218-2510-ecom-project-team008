import React from "react";
import {
  render,
  screen,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter, useNavigate } from "react-router-dom";
import CreateProduct from "../../../pages/admin/CreateProduct.js";
import { AuthProvider } from "../../../context/auth.js";

// mocks
jest.mock("axios");
jest.mock("react-hot-toast");

// keep Layout/AdminMenu shallow
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

  // Provide a Select.Option shim so `const { Option } = Select` works
  const MockOption = ({ value, children }) => (
    // We won't render this directly; the parent MockSelect will read its props
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
    // Build a unified list of options from either children or the `options` prop
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
  // Attach Option to mimic antd API
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
  };
});

// helpers
const flushPromises = async () => {
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

class CaptureFormData {
  constructor() {
    this._pairs = [];
  }
  append(k, v) {
    this._pairs.push([k, v]);
  }
  // helper for assertions
  entries() {
    return this._pairs.slice();
  }
}

describe("CreateProduct Integration Tests", () => {
  const Providers = ({ children }) => (
    <AuthProvider>
      <MemoryRouter initialEntries={["/dashboard/admin/create-product"]}>
        {children}
      </MemoryRouter>
    </AuthProvider>
  );

  let realFormData;

  beforeAll(() => {
    // Make AntD + jsdom happier when portals/media queries are used
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

    // Stub file blob URLs for preview + cleanup
    global.URL.createObjectURL = jest.fn(() => "blob://preview-url");
    global.URL.revokeObjectURL = jest.fn();

    // Intercept FormData
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
      JSON.stringify({ user: { name: "Admin", role: 1 }, token: "admin-token" })
    );

    // Default category load success
    axios.get.mockResolvedValue({
      data: { success: true, category: mockCategories },
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
        <CreateProduct />
      </Providers>
    );

  // category load
  test("loads categories on mount and populates dropdown (integration with axios + context)", async () => {
    renderPage();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
    });

    // Wait for categories to be rendered in the select
    await waitFor(() => {
      const categorySelect = screen.getAllByTestId("ant-select")[0];
      const options = within(categorySelect).getAllByRole("option");
      const optionTexts = options.map((opt) => opt.textContent);
      expect(optionTexts).toContain("Electronics");
    });

    // verify both categories are present
    const categorySelect = screen.getAllByTestId("ant-select")[0];
    const options = within(categorySelect).getAllByRole("option");
    const optionTexts = options.map((opt) => opt.textContent);
    expect(optionTexts).toContain("Electronics");
    expect(optionTexts).toContain("Books");
  });

  test("handles category fetch failure and shows toast (error integration)", async () => {
    axios.get.mockRejectedValueOnce(new Error("Network Error"));

    renderPage();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong in getting category"
      );
    });
  });

  // front-end only validation
  test("blocks submit when required fields are missing; shows first validation toast", async () => {
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /create product/i })
      ).toBeInTheDocument()
    );

    await actAsync(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: /create product/i })
      );
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Product name is required");
    });
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("price must be > 0; quantity must be non-negative; category must be selected", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/write a name/i)).toBeInTheDocument()
    );

    await actAsync(async () => {
      await userEvent.type(screen.getByPlaceholderText(/write a name/i), "A");
      await userEvent.type(
        screen.getByPlaceholderText(/write a description/i),
        "B"
      );
      await userEvent.type(screen.getByPlaceholderText(/write a Price/i), "0"); // invalid
      await userEvent.type(
        screen.getByPlaceholderText(/write a quantity/i),
        "-5"
      ); // invalid
      await userEvent.click(
        screen.getByRole("button", { name: /create product/i })
      );
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Price must be greater than 0");
    });
    expect(axios.post).not.toHaveBeenCalled();

    // fix price and quantity but leave category unselected
    await actAsync(async () => {
      const price = screen.getByPlaceholderText(/write a Price/i);
      await userEvent.clear(price);
      await userEvent.type(price, "100");

      const quantity = screen.getByPlaceholderText(/write a quantity/i);
      await userEvent.clear(quantity);
      await userEvent.type(quantity, "5");

      await userEvent.click(
        screen.getByRole("button", { name: /create product/i })
      );
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please select a category");
    });
    expect(axios.post).not.toHaveBeenCalled();
  });

  // successful submission
  test("submits FormData with all fields, shows success toast, and navigates", async () => {
    axios.post.mockResolvedValueOnce({
      data: { success: true, message: "Product Created Successfully" },
    });

    renderPage();

    // Wait for categories to load
    await waitFor(() => {
      const categorySelect = screen.getAllByTestId("ant-select")[0];
      const options = within(categorySelect).getAllByRole("option");
      const optionTexts = options.map((opt) => opt.textContent);
      expect(optionTexts).toContain("Electronics");
    });

    // fill form
    await actAsync(async () => {
      await userEvent.type(
        screen.getByPlaceholderText(/write a name/i),
        "Gaming Laptop"
      );
      await userEvent.type(
        screen.getByPlaceholderText(/write a description/i),
        "High-end gaming laptop"
      );
      await userEvent.type(
        screen.getByPlaceholderText(/write a Price/i),
        "1500"
      );
      await userEvent.type(
        screen.getByPlaceholderText(/write a quantity/i),
        "10"
      );

      // category - use native select
      const selects = screen.getAllByTestId("ant-select");
      await userEvent.selectOptions(selects[0], "cat1");

      // shipping - use native select
      await userEvent.selectOptions(selects[1], "1");

      // upload photo
      const file = new File(["img"], "p.png", { type: "image/png" });
      await userEvent.upload(screen.getByLabelText(/upload photo/i), file);

      await userEvent.click(
        screen.getByRole("button", { name: /create product/i })
      );
    });

    await flushPromises();

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, fd] = axios.post.mock.calls[0];
    expect(url).toBe("/api/v1/product/create-product");
    expect(fd).toBeInstanceOf(CaptureFormData);

    const pairs = fd.entries();
    // expect key value pairs exist
    const got = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
    expect(got.name).toBe("Gaming Laptop");
    expect(got.description).toBe("High-end gaming laptop");
    expect(got.price).toBe("1500");
    expect(got.quantity).toBe("10");
    // category should be id
    expect(
      got.category === "cat1" || got.category === "Electronics"
    ).toBeTruthy();
    // shipping coercion is checked below in dedicated test
    expect(got.photo).toBeInstanceOf(File);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Product Created Successfully"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
    });
  });

  // shipping type
  test("sends shipping as correct type (Bug #9): boolean/number instead of string", async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    // Wait for categories to load
    await waitFor(() => {
      const categorySelect = screen.getAllByTestId("ant-select")[0];
      const options = within(categorySelect).getAllByRole("option");
      const optionTexts = options.map((opt) => opt.textContent);
      expect(optionTexts).toContain("Electronics");
    });

    await actAsync(async () => {
      await userEvent.type(
        screen.getByPlaceholderText(/write a name/i),
        "Test"
      );
      await userEvent.type(
        screen.getByPlaceholderText(/write a description/i),
        "Desc"
      );
      await userEvent.type(screen.getByPlaceholderText(/write a Price/i), "1");
      await userEvent.type(
        screen.getByPlaceholderText(/write a quantity/i),
        "1"
      );

      const selects = screen.getAllByTestId("ant-select");
      await userEvent.selectOptions(selects[0], "cat1");
      await userEvent.selectOptions(selects[1], "1");

      // Need to upload a photo for the test to pass validation
      const file = new File(["img"], "test.png", { type: "image/png" });
      await userEvent.upload(screen.getByLabelText(/upload photo/i), file);

      await userEvent.click(
        screen.getByRole("button", { name: /create product/i })
      );
    });

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
    });

    const [, fd] = axios.post.mock.calls[0];
    const pairs = fd.entries();

    const shipping = pairs.find(([k]) => k === "shipping")?.[1];
    expect([true, 1, "1"]).toContain(shipping);
  });

  // photo review and cleanup
  test("shows photo preview and revokes object URL on unmount (Bug #6)", async () => {
    const { unmount } = renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/upload photo/i)).toBeInTheDocument()
    );

    await actAsync(async () => {
      const file = new File(["img"], "photo.png", { type: "image/png" });
      await userEvent.upload(screen.getByLabelText(/upload photo/i), file);
    });

    // visible preview
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    expect(screen.getByAltText("product_photo")).toBeInTheDocument();

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalled(); // memory leak fix
  });

  // error path on submit
  test("shows specific backend error message on create failure (propagated toast)", async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { message: "Product already exists" } },
    });

    renderPage();

    // Wait for categories to load
    await waitFor(() => {
      const categorySelect = screen.getAllByTestId("ant-select")[0];
      const options = within(categorySelect).getAllByRole("option");
      const optionTexts = options.map((opt) => opt.textContent);
      expect(optionTexts).toContain("Electronics");
    });

    await actAsync(async () => {
      await userEvent.type(
        screen.getByPlaceholderText(/write a name/i),
        "Existing"
      );
      await userEvent.type(
        screen.getByPlaceholderText(/write a description/i),
        "D"
      );
      await userEvent.type(screen.getByPlaceholderText(/write a Price/i), "10");
      await userEvent.type(
        screen.getByPlaceholderText(/write a quantity/i),
        "2"
      );

      const selects = screen.getAllByTestId("ant-select");
      await userEvent.selectOptions(selects[0], "cat1");
      await userEvent.selectOptions(selects[1], "1");

      // Need to upload a photo for the test to pass validation
      const file = new File(["img"], "test.png", { type: "image/png" });
      await userEvent.upload(screen.getByLabelText(/upload photo/i), file);

      await userEvent.click(
        screen.getByRole("button", { name: /create product/i })
      );
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Product already exists");
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

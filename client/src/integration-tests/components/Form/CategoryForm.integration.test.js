/**
 * Combined Integration Tests For CategoryForm.js
 *  - CategoryForm ↔ parent (controlled input + submit)
 *  - CreateCategory page ↔ CategoryForm ↔ axios + toast (page-level flows)
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import CategoryForm from "../../../components/Form/CategoryForm.js";
import CreateCategory from "../../../pages/admin/CreateCategory.js";
import { AuthProvider } from "../../../context/auth.js";
import { CartProvider } from "../../../context/cart.js";
import { SearchProvider } from "../../../context/search.js";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

jest.mock("axios");
jest.mock("react-hot-toast");

// helpers
const Providers = ({ children }) => (
  <AuthProvider>
    <CartProvider>
      <SearchProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </SearchProvider>
    </CartProvider>
  </AuthProvider>
);

// CategoryForm ↔ Parent integration (component-level)
describe("CategoryForm Integration (child ↔ parent)", () => {
  describe("Form Input and State Integration", () => {
    test("integrates with parent state via setValue; input shows latest parent value", async () => {
      let formValue = "";

      const mockHandleSubmit = jest.fn((e) => e.preventDefault());

      const TestWrapper = () => {
        const [value, setValue] = React.useState(formValue);
        formValue = value; // keep formValue in sync for assertions

        return (
          <CategoryForm
            handleSubmit={mockHandleSubmit}
            value={value}
            setValue={setValue}
          />
        );
      };

      render(<TestWrapper />);

      const input = screen.getByPlaceholderText("Enter new category");
      await userEvent.type(input, "Electronics");

      // The input should now reflect the typed value
      expect(input).toHaveValue("Electronics");
      expect(formValue).toBe("Electronics");
    });

    test("maintains two-way data binding with parent state changes", async () => {
      let parentState = "Initial Value";
      const mockSetValue = jest.fn((v) => {
        parentState = v;
      });
      const mockHandleSubmit = jest.fn((e) => e.preventDefault());

      const { rerender } = render(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={parentState}
          setValue={mockSetValue}
        />
      );

      const input = screen.getByPlaceholderText("Enter new category");
      expect(input).toHaveValue("Initial Value");

      // parent clears value
      parentState = "";
      rerender(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={parentState}
          setValue={mockSetValue}
        />
      );
      expect(input).toHaveValue("");
    });

    test("handles rapid parent state changes without desync", async () => {
      let parentState = "";
      const mockSetValue = jest.fn((v) => {
        parentState = v;
      });
      const mockHandleSubmit = jest.fn((e) => e.preventDefault());

      const { rerender } = render(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={parentState}
          setValue={mockSetValue}
        />
      );

      const values = ["A", "AB", "ABC", "ABCD", ""];
      for (const v of values) {
        parentState = v;
        rerender(
          <CategoryForm
            handleSubmit={mockHandleSubmit}
            value={parentState}
            setValue={mockSetValue}
          />
        );
      }

      const input = screen.getByPlaceholderText("Enter new category");
      expect(input).toHaveValue("");
    });
  });

  describe("Form Submission Integration", () => {
    test("submits to parent handleSubmit and passes current value behaviorally", async () => {
      let submittedValue = "";
      let formValue = "Books";
      const mockHandleSubmit = jest.fn((e) => {
        e.preventDefault();
        submittedValue = formValue;
      });
      const mockSetValue = jest.fn();

      render(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={formValue}
          setValue={mockSetValue}
        />
      );

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
      const evt = mockHandleSubmit.mock.calls[0][0];
      expect(evt.defaultPrevented).toBe(true);
      expect(submittedValue).toBe("Books");
    });

    test("pressing Enter in the input submits the form (parent handler called)", async () => {
      const mockHandleSubmit = jest.fn((e) => e.preventDefault());
      const mockSetValue = jest.fn();

      render(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value="Clothing"
          setValue={mockSetValue}
        />
      );

      const input = screen.getByPlaceholderText("Enter new category");
      await userEvent.type(input, "{enter}");

      expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
    });

    test("empty submission flows to parent validation (parent decides errors)", async () => {
      let validationError = "";
      const formValue = "";
      const mockHandleSubmit = jest.fn((e) => {
        e.preventDefault();
        if (!formValue.trim()) validationError = "Category name is required";
      });
      const mockSetValue = jest.fn();

      render(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={formValue}
          setValue={mockSetValue}
        />
      );

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));
      expect(mockHandleSubmit).toHaveBeenCalled();
      expect(validationError).toBe("Category name is required");
    });
  });

  describe("Complex User Interaction Flows", () => {
    test("full workflow: type → correct typo → submit (parent gets final state)", async () => {
      let parentState = "";
      let submitted = null;

      const mockSetValue = jest.fn((v) => {
        parentState = v;
      });
      const mockHandleSubmit = jest.fn((e) => {
        e.preventDefault();
        submitted = { name: parentState };
      });

      const { rerender } = render(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={parentState}
          setValue={mockSetValue}
        />
      );
      const input = screen.getByPlaceholderText("Enter new category");

      await userEvent.type(input, "Electronicss");
      parentState = "Electronicss";
      rerender(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={parentState}
          setValue={mockSetValue}
        />
      );

      await userEvent.clear(input);
      await userEvent.type(input, "Electronics");
      parentState = "Electronics";
      rerender(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={parentState}
          setValue={mockSetValue}
        />
      );

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      expect(submitted).toEqual({ name: "Electronics" });
      expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
    });

    test("handles parent reset after submit and works for new input", async () => {
      const mockHandleSubmit = jest.fn((e) => e.preventDefault());

      const TestWrapper = () => {
        const [value, setValue] = React.useState("Old Category");

        const handleSubmit = (e) => {
          mockHandleSubmit(e);
          setValue(""); // parent resets value after submit
        };

        return (
          <CategoryForm
            handleSubmit={handleSubmit}
            value={value}
            setValue={setValue}
          />
        );
      };

      render(<TestWrapper />);

      const input = screen.getByPlaceholderText("Enter new category");
      expect(input).toHaveValue("Old Category");

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      // After submit, parent resets the value
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Enter new category")).toHaveValue("");
      });

      await userEvent.type(screen.getByPlaceholderText("Enter new category"), "New Category");

      // Verify the new input is reflected
      expect(screen.getByPlaceholderText("Enter new category")).toHaveValue("New Category");
    });
  });

  describe("Edge Cases and Integration Robustness", () => {
    test("special characters flow through setValue and bind correctly", async () => {
      let parentState = "";
      const mockSetValue = jest.fn((v) => {
        parentState = v;
      });
      const mockHandleSubmit = jest.fn((e) => e.preventDefault());

      const { rerender } = render(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={parentState}
          setValue={mockSetValue}
        />
      );

      const input = screen.getByPlaceholderText("Enter new category");
      const special = "Category's & Co. <test>";
      await userEvent.type(input, special);

      parentState = special;
      rerender(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={parentState}
          setValue={mockSetValue}
        />
      );

      expect(input).toHaveValue(special);
      // userEvent.type calls setValue for each character, so just verify the final value is correct
      expect(mockSetValue).toHaveBeenCalled();
    });

    test("whitespace value passes through to parent (parent trims/validates)", async () => {
      const parentState = "   Spaces   ";
      const mockSetValue = jest.fn();
      const mockHandleSubmit = jest.fn((e) => e.preventDefault());

      render(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value={parentState}
          setValue={mockSetValue}
        />
      );

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));
      expect(mockHandleSubmit).toHaveBeenCalled();
      expect(screen.getByPlaceholderText("Enter new category")).toHaveValue(
        "   Spaces   "
      );
    });

    test("multiple submissions still route through parent handler", async () => {
      let submits = 0;
      const mockHandleSubmit = jest.fn((e) => {
        e.preventDefault();
        submits++;
      });
      const mockSetValue = jest.fn();

      render(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value="Test Category"
          setValue={mockSetValue}
        />
      );

      const submit = screen.getByRole("button", { name: /submit/i });
      await userEvent.click(submit);
      await userEvent.click(submit);
      await userEvent.click(submit);

      expect(mockHandleSubmit).toHaveBeenCalledTimes(3);
      expect(submits).toBe(3);
    });
  });

  describe("Supported Parent State Patterns", () => {
    test("handles empty-string initial state (controlled)", () => {
      const mockSetValue = jest.fn();
      const mockHandleSubmit = jest.fn();
      render(
        <CategoryForm
          handleSubmit={mockHandleSubmit}
          value=""
          setValue={mockSetValue}
        />
      );
      const input = screen.getByPlaceholderText("Enter new category");
      expect(input).toHaveValue("");
      expect(input).not.toBeDisabled();
    });
    // intentionally omit undefined/null to avoid controlled/uncontrolled warnings.
  });
});

// CreateCategory page integration (page ↔ axios ↔ toast)
describe("Integration: CategoryForm ↔ CreateCategory Page", () => {
  const mockAdmin = { name: "Admin User", email: "admin@test.com", role: 1 };
  const mockCategories = [
    { _id: "1", name: "Electronics", slug: "electronics" },
    { _id: "2", name: "Books", slug: "books" },
  ];

  beforeEach(() => {
    // Page-level setup only (safe to reassign between tests)
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: mockAdmin, token: "mock-token" })
    );
    axios.get.mockResolvedValue({
      data: { success: true, category: mockCategories },
    });
    toast.success = jest.fn();
    toast.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    localStorage.clear();
  });

  describe("Create Category Flow", () => {
    it("creates category successfully", async () => {
      axios.post.mockResolvedValueOnce({
        data: { success: true, category: { _id: "3", name: "Clothing" } },
      });

      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );
      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      await userEvent.type(
        screen.getByPlaceholderText("Enter new category"),
        "Clothing"
      );
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          "/api/v1/category/create-category",
          { name: "Clothing" }
        );
        expect(toast.success).toHaveBeenCalledWith("Clothing is created");
        expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
      });
    });

    it("validates empty input at page level before API call", async () => {
      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );
      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Category name is required");
        expect(axios.post).not.toHaveBeenCalled();
      });
    });

    it("validates whitespace-only input", async () => {
      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );
      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      await userEvent.type(
        screen.getByPlaceholderText("Enter new category"),
        "   "
      );
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Category name is required");
        expect(axios.post).not.toHaveBeenCalled();
      });
    });

    it("handles API failure (duplicate)", async () => {
      axios.post.mockResolvedValueOnce({
        data: { success: false, message: "Category already exists" },
      });

      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );
      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      await userEvent.type(
        screen.getByPlaceholderText("Enter new category"),
        "Electronics"
      );
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Category already exists")
      );
    });

    it("handles network error gracefully", async () => {
      axios.post.mockRejectedValueOnce(new Error("Network Error"));

      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );
      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      await userEvent.type(
        screen.getByPlaceholderText("Enter new category"),
        "Sports"
      );
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "Something went wrong in input form"
        )
      );
    });
  });

  describe("Update Category Flow", () => {
    it("updates category via modal with embedded CategoryForm", async () => {
      axios.put.mockResolvedValueOnce({
        data: {
          success: true,
          category: { _id: "1", name: "Consumer Electronics" },
        },
      });

      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );

      await waitFor(() => {
        const electronics = screen.getAllByText("Electronics");
        expect(electronics.length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByRole("button", { name: /edit/i });
      await userEvent.click(editButtons[0]);

      await waitFor(() =>
        expect(screen.getByDisplayValue("Electronics")).toBeInTheDocument()
      );

      const modalInput = screen.getByDisplayValue("Electronics");
      await userEvent.clear(modalInput);
      await userEvent.type(modalInput, "Consumer Electronics");

      const modalSubmit = within(
        document.querySelector(".ant-modal-content")
      ).getByRole("button", { name: /submit/i });
      await userEvent.click(modalSubmit);

      await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
          "/api/v1/category/update-category/1",
          { name: "Consumer Electronics" }
        );
        expect(toast.success).toHaveBeenCalledWith(
          "Consumer Electronics is updated"
        );
        expect(axios.get).toHaveBeenCalled();
      });
    });

    it("validates empty update input", async () => {
      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );
      await waitFor(() => {
        const electronics = screen.getAllByText("Electronics");
        expect(electronics.length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByRole("button", { name: /edit/i });
      await userEvent.click(editButtons[0]);

      await waitFor(() =>
        expect(screen.getByDisplayValue("Electronics")).toBeInTheDocument()
      );
      const modalInput = screen.getByDisplayValue("Electronics");
      await userEvent.clear(modalInput);

      const modalSubmit = within(
        document.querySelector(".ant-modal-content")
      ).getByRole("button", { name: /submit/i });
      await userEvent.click(modalSubmit);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Category name is required");
        expect(axios.put).not.toHaveBeenCalled();
      });
    });

    it("closes modal and resets state after successful update", async () => {
      axios.put.mockResolvedValueOnce({
        data: { success: true, category: { _id: "2", name: "Literature" } },
      });

      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );
      await waitFor(() => {
        const books = screen.getAllByText("Books");
        expect(books.length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByRole("button", { name: /edit/i });
      await userEvent.click(editButtons[1]);

      await waitFor(() =>
        expect(screen.getByDisplayValue("Books")).toBeInTheDocument()
      );

      const modalInput = screen.getByDisplayValue("Books");
      await userEvent.clear(modalInput);
      await userEvent.type(modalInput, "Literature");

      const modalSubmit = within(
        document.querySelector(".ant-modal-content")
      ).getByRole("button", { name: /submit/i });
      await userEvent.click(modalSubmit);

      await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
          "/api/v1/category/update-category/2",
          { name: "Literature" }
        );
        expect(toast.success).toHaveBeenCalledWith("Literature is updated");
        expect(axios.get).toHaveBeenCalled();
      });
    });
  });

  describe("Delete Category Flow", () => {
    it("deletes a category and refreshes the list", async () => {
      axios.delete.mockResolvedValueOnce({
        data: { success: true, message: "Category deleted" },
      });

      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );
      await waitFor(() => {
        const electronics = screen.getAllByText("Electronics");
        expect(electronics.length).toBeGreaterThan(0);
      });

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(axios.delete).toHaveBeenCalledWith(
          "/api/v1/category/delete-category/1"
        );
        expect(toast.success).toHaveBeenCalledWith("Category is deleted");
        expect(axios.get).toHaveBeenCalled();
      });
    });

    it("shows error toast on delete failure", async () => {
      axios.delete.mockResolvedValueOnce({
        data: {
          success: false,
          message: "Cannot delete category with products",
        },
      });

      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );
      await waitFor(() => {
        const electronics = screen.getAllByText("Electronics");
        expect(electronics.length).toBeGreaterThan(0);
      });

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "Cannot delete category with products"
        )
      );
    });
  });

  describe("Category List Display", () => {
    it("fetches and renders categories", async () => {
      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
        const electronics = screen.getAllByText("Electronics");
        const books = screen.getAllByText("Books");
        expect(electronics.length).toBeGreaterThan(0);
        expect(books.length).toBeGreaterThan(0);
        expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(
          2
        );
        expect(screen.getAllByRole("button", { name: /delete/i })).toHaveLength(
          2
        );
      });
    });

    it("handles empty category list", async () => {
      axios.get.mockResolvedValueOnce({
        data: { success: true, category: [] },
      });

      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );

      await waitFor(() => {
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(screen.queryByText("Electronics")).not.toBeInTheDocument();
      });
    });

    it("handles fetch error", async () => {
      // First call is from Header's useCategory hook - should succeed
      // Second call is from CreateCategory's useEffect - should fail
      axios.get
        .mockResolvedValueOnce({
          data: { success: true, category: [] },
        })
        .mockRejectedValueOnce(new Error("Network Error"));

      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "Something went wrong in getting category"
        )
      );
    });
  });

  describe("State Synchronization", () => {
    it("keeps create input state independent from update modal state", async () => {
      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );

      await waitFor(() => {
        const electronics = screen.getAllByText("Electronics");
        expect(electronics.length).toBeGreaterThan(0);
      });

      const createInput = screen.getByPlaceholderText("Enter new category");
      await userEvent.type(createInput, "Test Category");

      const editButtons = screen.getAllByRole("button", { name: /edit/i });
      await userEvent.click(editButtons[0]);

      await waitFor(() =>
        expect(screen.getByDisplayValue("Electronics")).toBeInTheDocument()
      );

      expect(createInput).toHaveValue("Test Category");
    });

    it("refreshes list after successful creation", async () => {
      const mockCategories = [
        { _id: "1", name: "Electronics", slug: "electronics" },
        { _id: "2", name: "Books", slug: "books" },
      ];
      const newCategory = { _id: "3", name: "Toys", slug: "toys" };
      axios.post.mockResolvedValueOnce({
        data: { success: true, category: newCategory },
      });

      axios.get
        .mockResolvedValueOnce({
          data: { success: true, category: mockCategories },
        })
        .mockResolvedValueOnce({
          data: { success: true, category: [...mockCategories, newCategory] },
        });

      render(
        <Providers>
          <CreateCategory />
        </Providers>
      );

      await waitFor(() => {
        const electronics = screen.getAllByText("Electronics");
        expect(electronics.length).toBeGreaterThan(0);
      });

      const input = screen.getByPlaceholderText("Enter new category");
      await userEvent.type(input, "Toys");

      const initialCallCount = axios.get.mock.calls.length;
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Wait for refetch after create (should call axios.get one more time)
      await waitFor(() => expect(axios.get.mock.calls.length).toBe(initialCallCount + 1));
    });
  });
});

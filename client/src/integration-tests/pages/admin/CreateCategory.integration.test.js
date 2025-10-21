import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import CreateCategory from "../../../pages/admin/CreateCategory.js";
import { AuthProvider } from "../../../context/auth.js";

// mocks
jest.mock("axios");
jest.mock("react-hot-toast");
jest.mock("../../../components/Layout.js", () => ({ children, title }) => (
  <div data-testid="layout" data-title={title}>
    {children}
  </div>
));
jest.mock("../../../components/AdminMenu.js", () => () => (
  <div data-testid="admin-menu">Admin Menu</div>
));

describe("CreateCategory Page Integration Tests", () => {
  const mockAuthContext = {
    user: { name: "Admin", role: 1 },
    token: "mock-admin-token",
  };

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AuthProvider>
          <CreateCategory />
        </AuthProvider>
      </MemoryRouter>
    );

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("auth", JSON.stringify(mockAuthContext));

    // default list fetch
    axios.get.mockResolvedValue({ data: { success: true, category: [] } });

    toast.success = jest.fn();
    toast.error = jest.fn();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // page load
  describe("Page Load and Initialization Integration", () => {
    test("loads categories on mount and renders them", async () => {
      const mockCategories = [
        { _id: "1", name: "Electronics", slug: "electronics" },
        { _id: "2", name: "Books", slug: "books" },
      ];
      axios.get.mockResolvedValueOnce({
        data: { success: true, category: mockCategories },
      });

      renderComponent();

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
        expect(screen.getByText("Electronics")).toBeInTheDocument();
        expect(screen.getByText("Books")).toBeInTheDocument();
      });
    });

    test("integrates with Layout and AdminMenu", async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
        expect(screen.getByText("Manage Category")).toBeInTheDocument();
      });
    });

    test("shows toast on category load error", async () => {
      axios.get.mockRejectedValueOnce(new Error("Network Error"));
      renderComponent();
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Something went wrong in getting category"
        );
      });
    });
  });

  // create
  describe("Category Creation Integration Flow", () => {
    test("submits, clears form, and refreshes list on success", async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: "Category created",
          category: { _id: "3", name: "Clothing", slug: "clothing" },
        },
      });
      // refetch returns new list after creating
      axios.get
        .mockResolvedValueOnce({ data: { success: true, category: [] } }) // initial
        .mockResolvedValueOnce({
          data: {
            success: true,
            category: [{ _id: "3", name: "Clothing", slug: "clothing" }],
          },
        });

      renderComponent();

      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      const input = screen.getByPlaceholderText("Enter new category");
      await userEvent.type(input, "Clothing");
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          "/api/v1/category/create-category",
          { name: "Clothing" }
        );
        expect(toast.success).toHaveBeenCalledWith("Clothing is created");
        expect(input).toHaveValue(""); // cleared
        expect(axios.get).toHaveBeenCalledTimes(2); // initial + after create
      });
    });

    test("sanitizes (trims) input before API call", async () => {
      axios.post.mockResolvedValueOnce({
        data: { success: true, message: "Category created" },
      });
      renderComponent();
      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      await userEvent.type(
        screen.getByPlaceholderText("Enter new category"),
        "   Electronics   "
      );
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        // expect trimmed value to be sent through API
        expect(axios.post).toHaveBeenCalledWith(
          "/api/v1/category/create-category",
          { name: "Electronics" }
        );
      });
    });

    test("shows specific backend error message when provided", async () => {
      axios.post.mockRejectedValueOnce({
        response: {
          data: { success: false, message: "Category already exists" },
        },
      });

      renderComponent();
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

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Category already exists");
      });
    });

    test("handles network error (no response) gracefully", async () => {
      axios.post.mockRejectedValueOnce(new Error("Network Error"));
      renderComponent();
      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      await userEvent.type(
        screen.getByPlaceholderText("Enter new category"),
        "Test"
      );
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Something went wrong in input form"
        );
      });
    });

    test("blocks empty submission and does NOT call API or refetch", async () => {
      renderComponent();
      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Category name is required")
      );
      expect(axios.post).not.toHaveBeenCalled();
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test("blocks whitespace-only submission and does NOT call API", async () => {
      renderComponent();
      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      await userEvent.type(
        screen.getByPlaceholderText("Enter new category"),
        "     "
      );
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Category name is required")
      );
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  // update (modal)
  describe("Category Update Integration Flow", () => {
    const seedAndRenderWithOne = async () => {
      axios.get.mockResolvedValue({
        data: {
          success: true,
          category: [{ _id: "1", name: "Electronics", slug: "electronics" }],
        },
      });
      renderComponent();
      await waitFor(() =>
        expect(screen.getByText("Electronics")).toBeInTheDocument()
      );
    };

    test("opens modal, updates category, closes and refreshes", async () => {
      await seedAndRenderWithOne();
      axios.put.mockResolvedValueOnce({
        data: { success: true, message: "Category updated" },
      });

      const editBtn = screen.getByRole("button", { name: /edit/i });
      await userEvent.click(editBtn);

      const modal = document.querySelector(".ant-modal-content");
      expect(modal).toBeTruthy();
      const modalUtils = within(modal);

      const modalInput = modalUtils.getByPlaceholderText("Enter new category");
      expect(modalInput).toHaveValue("Electronics");

      await userEvent.clear(modalInput);
      await userEvent.type(modalInput, "Consumer Electronics");

      const modalSubmit = modalUtils.getByRole("button", { name: /submit/i });
      await userEvent.click(modalSubmit);

      await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
          "/api/v1/category/update-category/1",
          { name: "Consumer Electronics" }
        );
        expect(toast.success).toHaveBeenCalledWith(
          "Consumer Electronics is updated"
        );
        // component refetches list after successful update
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      // modal should close after success - check that modal is no longer visible
      await waitFor(() => {
        const modalWrap = document.querySelector(".ant-modal-wrap");
        expect(modalWrap).toHaveStyle({ display: "none" });
      });
    });

    test("validates empty name in modal and does NOT call API", async () => {
      await seedAndRenderWithOne();

      const editBtn = screen.getByRole("button", { name: /edit/i });
      await userEvent.click(editBtn);

      const modal = document.querySelector(".ant-modal-content");
      const modalUtils = within(modal);

      const modalInput = modalUtils.getByPlaceholderText("Enter new category");
      await userEvent.clear(modalInput);

      const modalSubmit = modalUtils.getByRole("button", { name: /submit/i });
      await userEvent.click(modalSubmit);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Category name is required")
      );
      expect(axios.put).not.toHaveBeenCalled();
    });

    test("shows error toast when update request fails", async () => {
      await seedAndRenderWithOne();
      axios.put.mockRejectedValueOnce(new Error("Update failed"));

      const editBtn = screen.getByRole("button", { name: /edit/i });
      await userEvent.click(editBtn);

      const modal = document.querySelector(".ant-modal-content");
      const modalUtils = within(modal);
      const modalInput = modalUtils.getByPlaceholderText("Enter new category");

      await userEvent.clear(modalInput);
      await userEvent.type(modalInput, "Updated Name");

      await userEvent.click(
        modalUtils.getByRole("button", { name: /submit/i })
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "An error occurred while updating category"
        );
      });
    });

    test("allows user to cancel with close button (modal closes, no API calls)", async () => {
      await seedAndRenderWithOne();

      const editBtn = screen.getByRole("button", { name: /edit/i });
      await userEvent.click(editBtn);

      const modal = document.querySelector(".ant-modal-content");
      expect(modal).toBeTruthy();

      // click the close button in the modal
      const closeButton = screen.getByRole("button", { name: /close/i });
      await userEvent.click(closeButton);

      // give the modal a tick to close - check that modal is no longer visible
      await waitFor(() => {
        const modalWrap = document.querySelector(".ant-modal-wrap");
        expect(modalWrap).toHaveStyle({ display: "none" });
      });

      expect(axios.put).not.toHaveBeenCalled();
    });
  });

  // delete
  describe("Category Delete Integration Flow", () => {
    test("deletes category and refreshes list", async () => {
      const mockCategories = [
        { _id: "1", name: "Electronics", slug: "electronics" },
        { _id: "2", name: "Books", slug: "books" },
      ];

      axios.get
        .mockResolvedValueOnce({
          data: { success: true, category: mockCategories },
        }) // initial
        .mockResolvedValueOnce({
          data: {
            success: true,
            category: [{ _id: "2", name: "Books", slug: "books" }],
          },
        }); // after delete

      axios.delete.mockResolvedValueOnce({
        data: { success: true, message: "Category deleted successfully" },
      });

      renderComponent();
      await waitFor(() =>
        expect(screen.getByText("Electronics")).toBeInTheDocument()
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(axios.delete).toHaveBeenCalledWith(
          "/api/v1/category/delete-category/1"
        );
        expect(toast.success).toHaveBeenCalledWith("Category is deleted");
        expect(axios.get).toHaveBeenCalledTimes(2);
      });
    });

    test("shows backend message when deletion is prevented (e.g., products exist)", async () => {
      axios.get.mockResolvedValue({
        data: {
          success: true,
          category: [{ _id: "1", name: "Electronics", slug: "electronics" }],
        },
      });
      axios.delete.mockResolvedValueOnce({
        data: {
          success: false,
          message:
            "Cannot delete category. 5 product(s) are still using this category. Please reassign or delete those products first.",
        },
      });

      renderComponent();
      await waitFor(() =>
        expect(screen.getByText("Electronics")).toBeInTheDocument()
      );

      await userEvent.click(screen.getByRole("button", { name: /delete/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Cannot delete category. 5 product(s) are still using this category. Please reassign or delete those products first."
        );
      });
    });

    test("handles delete network error", async () => {
      axios.get.mockResolvedValue({
        data: {
          success: true,
          category: [{ _id: "1", name: "Electronics", slug: "electronics" }],
        },
      });
      axios.delete.mockRejectedValueOnce(new Error("Network Error"));

      renderComponent();
      await waitFor(() =>
        expect(screen.getByText("Electronics")).toBeInTheDocument()
      );

      await userEvent.click(screen.getByRole("button", { name: /delete/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "An error occurred while deleting category"
        );
      });
    });
  });

  // full workflow
  describe("Complete User Workflow Integration", () => {
    test("load → create → update → delete (happy path)", async () => {
      let categories = [];

      axios.get.mockImplementation(() =>
        Promise.resolve({ data: { success: true, category: categories } })
      );

      renderComponent();

      await waitFor(() =>
        expect(
          screen.getByPlaceholderText("Enter new category")
        ).toBeInTheDocument()
      );

      // create
      axios.post.mockResolvedValueOnce({
        data: { success: true, message: "Category created" },
      });
      categories = [{ _id: "1", name: "TestCategory", slug: "testcategory" }];

      const input = screen.getByPlaceholderText("Enter new category");
      await userEvent.type(input, "TestCategory");
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("TestCategory is created");
        expect(input).toHaveValue("");
        expect(screen.getByText("TestCategory")).toBeInTheDocument();
      });

      // update
      axios.put.mockResolvedValueOnce({
        data: { success: true, message: "Category updated" },
      });
      categories = [
        { _id: "1", name: "UpdatedCategory", slug: "updatedcategory" },
      ];

      await userEvent.click(screen.getByRole("button", { name: /edit/i }));
      const modal = document.querySelector(".ant-modal-content");
      const modalUtils = within(modal);
      const modalInput = modalUtils.getByPlaceholderText("Enter new category");
      await userEvent.clear(modalInput);
      await userEvent.type(modalInput, "UpdatedCategory");
      await userEvent.click(
        modalUtils.getByRole("button", { name: /submit/i })
      );

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "UpdatedCategory is updated"
        );
      });

      // delete
      axios.delete.mockResolvedValueOnce({
        data: { success: true, message: "Category deleted" },
      });
      categories = [];

      await userEvent.click(screen.getByRole("button", { name: /delete/i }));
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Category is deleted");
      });
    });
  });
});

import categoryModel from "../models/categoryModel.js";
import slugify from "slugify";
import {
  createCategoryController,
  updateCategoryController,
  categoryControlller,
  singleCategoryController,
  deleteCategoryController,
} from "./categoryController.js";

// mock dependencies
jest.mock("../models/categoryModel.js"); // returns a jest.fn() constructor by default
jest.mock("slugify", () =>
  jest.fn((str) => str.toLowerCase().replace(/\s+/g, "-"))
);

// helpers
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn();
  return res;
};

const mockNewCategorySave = (resolvedValue) => {
  const save = jest.fn().mockResolvedValue(resolvedValue);
  categoryModel.mockImplementation(() => ({ save }));
  return { save };
};

describe("Category Controller Tests", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // createCategoryController tests
  describe("createCategoryController", () => {
    let req, res;

    beforeEach(() => {
      req = { body: {} };
      res = mockRes();
      // reset static methods
      categoryModel.find = jest.fn();
      categoryModel.findByIdAndUpdate = jest.fn();
      categoryModel.findByIdAndDelete = jest.fn();
    });

    // input validation tests (EP/BVA)
    test("validates missing name field", async () => {
      // Arrange
      req.body = {};

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Name is required",
      });
    });

    test("validates null name", async () => {
      // Arrange
      req.body = { name: null };

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Name is required",
      });
    });

    test("validates empty string name", async () => {
      // Arrange
      req.body = { name: "" };

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Name is required",
      });
    });

    test("validates whitespace-only name", async () => {
      // Arrange
      req.body = { name: "   " };

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Name is required",
      });
    });

    // duplicate detection tests
    test("detects exact duplicate (case-sensitive match)", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      categoryModel.find.mockResolvedValue([
        { _id: "cat1", name: "Electronics", slug: "electronics" },
      ]);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(categoryModel.find).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category already exists",
      });
    });

    test("detects case-insensitive duplicate (lowercase)", async () => {
      // Arrange
      req.body = { name: "electronics" };
      categoryModel.find.mockResolvedValue([
        { _id: "cat1", name: "Electronics", slug: "electronics" },
      ]);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category already exists",
      });
    });

    test("detects case-insensitive duplicate (uppercase)", async () => {
      // Arrange
      req.body = { name: "ELECTRONICS" };
      categoryModel.find.mockResolvedValue([
        { _id: "cat1", name: "Electronics", slug: "electronics" },
      ]);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category already exists",
      });
    });

    test("detects case-insensitive duplicate (mixed case)", async () => {
      // Arrange
      req.body = { name: "ElEcTrOnIcS" };
      categoryModel.find.mockResolvedValue([
        { _id: "cat1", name: "Electronics", slug: "electronics" },
      ]);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category already exists",
      });
    });

    test("detects duplicate with leading/trailing whitespace", async () => {
      // Arrange
      req.body = { name: "  Electronics  " };
      categoryModel.find.mockResolvedValue([
        { _id: "cat1", name: "Electronics", slug: "electronics" },
      ]);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category already exists",
      });
    });

    // === SUCCESSFUL CREATION TESTS ===

    test("creates category successfully with valid name", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      const mockCategory = {
        _id: "cat123",
        name: "Electronics",
        slug: "electronics",
      };
      categoryModel.find.mockResolvedValue([]);
      mockNewCategorySave(mockCategory);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(categoryModel.find).toHaveBeenCalledWith({});
      expect(categoryModel).toHaveBeenCalledWith({
        name: "Electronics",
        slug: "electronics",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "New category created",
        category: mockCategory,
      });
    });

    test("trims whitespace from category name before saving", async () => {
      // Arrange
      req.body = { name: "  Books  " };
      const mockCategory = {
        _id: "cat123",
        name: "Books",
        slug: "books",
      };
      categoryModel.find.mockResolvedValue([]);
      mockNewCategorySave(mockCategory);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(slugify).toHaveBeenCalledWith("Books");
      expect(categoryModel).toHaveBeenCalledWith({
        name: "Books",
        slug: "books",
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("handles special characters in category name", async () => {
      // Arrange
      req.body = { name: "Electronics & Gadgets!" };
      const mockCategory = {
        _id: "cat123",
        name: "Electronics & Gadgets!",
        slug: "electronics-&-gadgets!",
      };
      categoryModel.find.mockResolvedValue([]);
      mockNewCategorySave(mockCategory);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, category: mockCategory })
      );
    });

    // error handling tests
    test("handles database error during duplicate check", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const dbError = new Error("Database connection failed");
      categoryModel.find.mockRejectedValue(dbError);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: dbError,
        message: "Error in category",
      });
      expect(consoleSpy).toHaveBeenCalledWith(dbError);
      consoleSpy.mockRestore();
    });

    test("handles database error during save", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const saveError = new Error("Save failed");
      categoryModel.find.mockResolvedValue([]);
      const save = jest.fn().mockRejectedValue(saveError);
      categoryModel.mockImplementation(() => ({ save }));

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: saveError,
        message: "Error in category",
      });
      consoleSpy.mockRestore();
    });

    test("does not attempt to save when duplicate detected", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      categoryModel.find.mockResolvedValue([{ _id: "x", name: "Electronics" }]);
      const save = jest.fn();
      categoryModel.mockImplementation(() => ({ save }));

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(save).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  // updateCategoryController tests
  describe("updateCategoryController", () => {
    let req, res;

    beforeEach(() => {
      req = { body: {}, params: {} };
      res = mockRes();
      categoryModel.find = jest.fn();
      categoryModel.findByIdAndUpdate = jest.fn();
    });

    // input validation tests (EP/BVA)
    test("validates missing name field", async () => {
      // Arrange
      req.body = {};
      req.params = { id: "cat123" };

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Name is required",
      });
    });

    test("validates empty string name", async () => {
      // Arrange
      req.body = { name: "" };
      req.params = { id: "cat123" };

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Name is required",
      });
    });

    test("validates whitespace-only name", async () => {
      // Arrange
      req.body = { name: "   " };
      req.params = { id: "cat123" };

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Name is required",
      });
    });

    // duplicate detection tests
    test("detects duplicate when updating to existing category name (different ID)", async () => {
      // Arrange
      req.body = { name: "Books" };
      req.params = { id: "cat123" };
      categoryModel.find.mockResolvedValue([
        { _id: "cat456", name: "Books", slug: "books" },
      ]);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category already exists",
      });
    });

    test("allows updating category to same name (same ID)", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      req.params = { id: "cat123" };
      const updatedCategory = {
        _id: "cat123",
        name: "Electronics",
        slug: "electronics",
      };
      categoryModel.find.mockResolvedValue([
        { _id: "cat123", name: "Electronics", slug: "electronics" },
      ]);
      categoryModel.findByIdAndUpdate.mockResolvedValue(updatedCategory);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Category updated successfully",
        category: updatedCategory,
      });
    });

    test("detects case-insensitive duplicate (different ID)", async () => {
      // Arrange
      req.body = { name: "electronics" };
      req.params = { id: "cat123" };
      categoryModel.find.mockResolvedValue([
        { _id: "cat456", name: "Electronics", slug: "electronics" },
      ]);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category already exists",
      });
    });

    // successful update tests
    test("updates category successfully with valid data", async () => {
      // Arrange
      req.body = { name: "Updated Electronics" };
      req.params = { id: "cat123" };
      const updatedCategory = {
        _id: "cat123",
        name: "Updated Electronics",
        slug: "updated-electronics",
      };
      categoryModel.find.mockResolvedValue([]);
      categoryModel.findByIdAndUpdate.mockResolvedValue(updatedCategory);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(categoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "cat123",
        { name: "Updated Electronics", slug: "updated-electronics" },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Category updated successfully",
        category: updatedCategory,
      });
    });

    test("trims whitespace from name before update and slugifies", async () => {
      // Arrange
      req.body = { name: "  Books  " };
      req.params = { id: "cat123" };
      const updatedCategory = {
        _id: "cat123",
        name: "Books",
        slug: "books",
      };
      categoryModel.find.mockResolvedValue([]);
      categoryModel.findByIdAndUpdate.mockResolvedValue(updatedCategory);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(slugify).toHaveBeenCalledWith("Books");
      expect(categoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "cat123",
        { name: "Books", slug: "books" },
        { new: true }
      );
    });

    // error handling tests
    test("returns 404 when category ID not found", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      req.params = { id: "nonexistent" };
      categoryModel.find.mockResolvedValue([]);
      categoryModel.findByIdAndUpdate.mockResolvedValue(null);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category not found",
      });
    });

    test("returns 404 for invalid MongoDB ObjectId", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      req.params = { id: "invalid-id-format" };
      categoryModel.find.mockResolvedValue([]);
      categoryModel.findByIdAndUpdate.mockResolvedValue(null);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category not found",
      });
    });

    test("handles database error during duplicate check", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      req.params = { id: "cat123" };
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const dbError = new Error("Database error");
      categoryModel.find.mockRejectedValue(dbError);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: dbError,
        message: "Error while updating category",
      });
      consoleSpy.mockRestore();
    });

    test("handles database error during update", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      req.params = { id: "cat123" };
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const updateError = new Error("Update failed");
      categoryModel.find.mockResolvedValue([]);
      categoryModel.findByIdAndUpdate.mockRejectedValue(updateError);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: updateError,
        message: "Error while updating category",
      });
      consoleSpy.mockRestore();
    });
  });

  // deleteCategoryController tests
  describe("deleteCategoryController", () => {
    let req, res;

    beforeEach(() => {
      req = { params: {} };
      res = mockRes();
      categoryModel.findByIdAndDelete = jest.fn();
    });

    // successful deletion tests
    test("deletes category successfully with valid ID", async () => {
      // Arrange
      req.params = { id: "cat123" };
      const deletedCategory = {
        _id: "cat123",
        name: "Electronics",
        slug: "electronics",
      };
      categoryModel.findByIdAndDelete.mockResolvedValue(deletedCategory);

      // Act
      await deleteCategoryController(req, res);

      // Assert
      expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith("cat123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Category deleted successfully",
      });
    });

    // not found tests
    test("returns 404 when category ID not found", async () => {
      // Arrange
      req.params = { id: "nonexistent" };
      categoryModel.findByIdAndDelete.mockResolvedValue(null);

      // Act
      await deleteCategoryController(req, res);

      // Assert
      expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith(
        "nonexistent"
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category not found",
      });
    });

    test("returns 404 for invalid MongoDB ObjectId format", async () => {
      // Arrange
      req.params = { id: "invalid-id" };
      categoryModel.findByIdAndDelete.mockResolvedValue(null);

      // Act
      await deleteCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category not found",
      });
    });

    test("returns 404 when ID is empty string", async () => {
      // Arrange
      req.params = { id: "" };
      categoryModel.findByIdAndDelete.mockResolvedValue(null);

      // Act
      await deleteCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category not found",
      });
    });

    // error handling tests
    test("handles database error during deletion", async () => {
      // Arrange
      req.params = { id: "cat123" };
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const deleteError = new Error("Database deletion failed");
      categoryModel.findByIdAndDelete.mockRejectedValue(deleteError);

      // Act
      await deleteCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error while deleting category",
        error: deleteError,
      });
      expect(consoleSpy).toHaveBeenCalledWith(deleteError);
      consoleSpy.mockRestore();
    });

    test("handles network timeout during deletion", async () => {
      // Arrange
      req.params = { id: "cat123" };
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const timeoutError = new Error("ETIMEDOUT");
      categoryModel.findByIdAndDelete.mockRejectedValue(timeoutError);

      // Act
      await deleteCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error while deleting category",
        error: timeoutError,
      });
      consoleSpy.mockRestore();
    });

    test("gracefully handles missing id param (treats as not found)", async () => {
      // Arrange
      req.params = {}; // id missing
      categoryModel.findByIdAndDelete.mockResolvedValue(null);

      // Act
      await deleteCategoryController(req, res);

      // Assert
      expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith(undefined);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // Test 3: categoryControlller (get all categories)
  describe("categoryControlller", () => {
    let req, res;

    beforeEach(() => {
      req = {};
      res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
    });

    it("should get all categories successfully", async () => {
      // Arrange
      const mockCategories = [
        { name: "Electronics", slug: "electronics" },
        { name: "Clothing", slug: "clothing" },
        { name: "Books", slug: "books" },
      ];
      categoryModel.find = jest.fn().mockResolvedValue(mockCategories);

      // Act
      await categoryControlller(req, res);

      // Assert
      expect(categoryModel.find).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "All Categories List",
        category: mockCategories,
      });
    });

    it("should return empty array when no categories exist", async () => {
      // Arrange
      categoryModel.find = jest.fn().mockResolvedValue([]);

      // Act
      await categoryControlller(req, res);

      // Assert
      expect(categoryModel.find).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "All Categories List",
        category: [],
      });
    });

    it("should handle database errors when fetching categories", async () => {
      // Arrange
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const error = new Error("Database connection failed");
      categoryModel.find = jest.fn().mockRejectedValue(error);

      // Act
      await categoryControlller(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error,
        message: "Error while getting all categories",
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // Test 4: singleCategoryController
  describe("singleCategoryController", () => {
    let req, res;

    beforeEach(() => {
      req = { params: {} };
      res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
    });

    it("should get single category by slug successfully", async () => {
      // Arrange
      const req = { params: { slug: "electronics" } };
      const mockCategory = { name: "Electronics", slug: "electronics" };
      categoryModel.findOne = jest.fn().mockResolvedValue(mockCategory);

      // Act
      await singleCategoryController(req, res);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({
        slug: "electronics",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Get single category successfully",
        category: mockCategory,
      });
    });

    it("should return 404 when category not found", async () => {
      // Arrange
      const req = { params: { slug: "nonexistent" } };
      categoryModel.findOne = jest.fn().mockResolvedValue(null);

      // Act
      await singleCategoryController(req, res);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({
        slug: "nonexistent",
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category not found",
      });
    });

    it("should handle database errors when fetching single category", async () => {
      // Arrange
      const req = { params: { slug: "electronics" } };
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const error = new Error("Database query failed");
      categoryModel.findOne = jest.fn().mockRejectedValue(error);

      // Act
      await singleCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error,
        message: "Error while getting single category",
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

import categoryModel from "../models/categoryModel.js";
import slugify from "slugify";
import {
  createCategoryController,
  updateCategoryController,
  categoryControlller,
  singleCategoryController,
  deleteCategoryCOntroller
} from "./categoryController.js";

// Mock dependencies
jest.mock("../models/categoryModel.js");
jest.mock("slugify", () =>
  jest.fn((str) => str.toLowerCase().replace(/\s+/g, "-"))
);

describe('Category Controller Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: createCategoryController
  describe('createCategoryController', () => {
    let req, res;

    beforeEach(() => {
      req = { body: {} };
      res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    // Test successful category creation
    it('should create category successfully when valid name provided', async () => {
      // Arrange
      const req = { body: { name: 'Electronics' } };
      const mockCategory = {
        _id: 'mock_id_123',
        name: 'Electronics',
        slug: 'electronics'
      };

      // Mock dependencies
      categoryModel.findOne = jest.fn().mockResolvedValue(null); // No existing category
      categoryModel.prototype.save = jest.fn().mockResolvedValue(mockCategory);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({ name: 'Electronics' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "new category created",
        category: mockCategory
      });
    });

    // Test validation error
    it('should return error when name is missing', async () => {
      // Arrange
      const req = { body: {} }; // Missing name

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Name is required"
      });
    });

    it('should return error when name is empty string', async () => {
      // Arrange
      const req = { body: { name: '' } };

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Name is required"
      });
    });

    // Test duplicate category handling
    it('should return error when category already exists', async () => {
      // Arrange
      const req = { body: { name: 'Electronics' } };
      const existingCategory = { name: 'Electronics', slug: 'electronics' };
      categoryModel.findOne = jest.fn().mockResolvedValue(existingCategory);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({ name: 'Electronics' });
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category Already Exists"
      });
    });

    // Test error handling 
    it('should handle database errors gracefully', async () => {
      // Arrange
      const req = { body: { name: 'Electronics' } };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      categoryModel.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: expect.any(Error), 
        message: "Error in Category"
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // Test 2: updateCategoryController
  describe('updateCategoryController', () => {
    let req, res;

    beforeEach(() => {
      req = { body: {}, params: {} };
      res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
    });

    it('should update category successfully', async () => {
      // Arrange
      const req = {
        body: { name: 'Updated Electronics' },
        params: { id: 'category_id_123' }
      };
      const updatedCategory = {
        _id: 'category_id_123',
        name: 'Updated Electronics',
        slug: 'updated-electronics'
      };

      categoryModel.findOne = jest.fn().mockResolvedValue(null); // No existing category
      categoryModel.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedCategory);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({ name: 'Updated Electronics' });
      expect(categoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'category_id_123',
        { name: 'Updated Electronics', slug: 'updated-electronics' },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Category Updated Successfully", // Fixed typo
        category: updatedCategory
      });
    });

    it('should return error when updating to existing category name', async () => {
      // Arrange
      const req = {
        body: { name: 'Electronics' },
        params: { id: 'category_id_123' }
      };
      const existingCategory = { name: 'Electronics', slug: 'electronics' };
      categoryModel.findOne = jest.fn().mockResolvedValue(existingCategory);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({ name: 'Electronics' });
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category Already Exists"
      });
    });

    it('should handle update errors gracefully', async () => {
      // Arrange
      const req = {
        body: { name: 'Electronics' },
        params: { id: 'invalid_id' }
      };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const error = new Error('Database update failed');

      // Mock findOne to pass duplicate check
      categoryModel.findOne = jest.fn().mockResolvedValue(null);
      categoryModel.findByIdAndUpdate = jest.fn().mockRejectedValue(error);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error,
        message: "Error while updating category"
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // Test 3: categoryControlller (get all categories)
  describe('categoryControlller', () => {
    let req, res;

    beforeEach(() => {
      req = {};
      res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
    });

    it('should get all categories successfully', async () => {
      // Arrange
      const mockCategories = [
        { name: 'Electronics', slug: 'electronics' },
        { name: 'Clothing', slug: 'clothing' },
        { name: 'Books', slug: 'books' }
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
        category: mockCategories
      });
    });

    it('should return empty array when no categories exist', async () => {
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
        category: []
      });
    });

    it('should handle database errors when fetching categories', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const error = new Error('Database connection failed');
      categoryModel.find = jest.fn().mockRejectedValue(error);

      // Act
      await categoryControlller(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error,
        message: "Error while getting all categories"
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // Test 4: singleCategoryController
  describe('singleCategoryController', () => {
    let req, res;

    beforeEach(() => {
      req = { params: {} };
      res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
    });

    it('should get single category by slug successfully', async () => {
      // Arrange
      const req = { params: { slug: 'electronics' } };
      const mockCategory = { name: 'Electronics', slug: 'electronics' };
      categoryModel.findOne = jest.fn().mockResolvedValue(mockCategory);

      // Act
      await singleCategoryController(req, res);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({ slug: 'electronics' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Get Single Category Successfully", // Fixed typos
        category: mockCategory
      });
    });

    it('should return 404 when category not found', async () => {
      // Arrange
      const req = { params: { slug: 'nonexistent' } };
      categoryModel.findOne = jest.fn().mockResolvedValue(null);

      // Act
      await singleCategoryController(req, res);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({ slug: 'nonexistent' });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Category not found"
      });
    });

    it('should handle database errors when fetching single category', async () => {
      // Arrange
      const req = { params: { slug: 'electronics' } };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const error = new Error('Database query failed');
      categoryModel.findOne = jest.fn().mockRejectedValue(error);

      // Act
      await singleCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error,
        message: "Error While getting Single Category"
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // Test 5: deleteCategoryCOntroller
  describe('deleteCategoryCOntroller', () => {
    let req, res;

    beforeEach(() => {
      req = { params: {} };
      res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
    });

    it('should delete category successfully', async () => {
      // Arrange
      const req = { params: { id: 'category_id_123' } };
      categoryModel.findByIdAndDelete = jest.fn().mockResolvedValue({
        _id: 'category_id_123',
        name: 'Electronics'
      });

      // Act
      await deleteCategoryCOntroller(req, res);

      // Assert
      expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith('category_id_123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Category Deleted Successfully" // Fixed typo
      });
    });

    it('should handle deletion of non-existent category', async () => {
      // Arrange
      const req = { params: { id: 'nonexistent_id' } };
      categoryModel.findByIdAndDelete = jest.fn().mockResolvedValue(null);

      // Act
      await deleteCategoryCOntroller(req, res);

      // Assert
      expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith('nonexistent_id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Category Deleted Successfully"
      });
    });

    it('should handle database errors when deleting category', async () => {
      // Arrange
      const req = { params: { id: 'category_id_123' } };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const error = new Error('Database deletion failed');
      categoryModel.findByIdAndDelete = jest.fn().mockRejectedValue(error);

      // Act
      await deleteCategoryCOntroller(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "error while deleting category",
        error
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // Edge cases and additional validation tests
  describe('Edge Cases', () => {
    let req, res;

    beforeEach(() => {
      req = { body: {}, params: {} };
      res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
    });

    it('should handle null name in createCategory', async () => {
      // Arrange
      const req = { body: { name: null } };

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Name is required"
      });
    });

    it('should handle undefined params in updateCategory', async () => {
      // Arrange
      const req = { body: { name: 'Test' }, params: {} };

      // Mock findOne to pass duplicate check
      categoryModel.findOne = jest.fn().mockResolvedValue(null);
      categoryModel.findByIdAndUpdate = jest.fn().mockResolvedValue(null);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(categoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        undefined,
        { name: 'Test', slug: 'test' },
        { new: true }
      );
    });

    it('should handle special characters in category names', async () => {
      // Arrange
      const req = { body: { name: 'Electronics & Gadgets!' } };
      categoryModel.findOne = jest.fn().mockResolvedValue(null);
      slugify.mockReturnValue('electronics-gadgets');
      categoryModel.prototype.save = jest.fn().mockResolvedValue({
        name: 'Electronics & Gadgets!',
        slug: 'electronics-gadgets'
      });

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});
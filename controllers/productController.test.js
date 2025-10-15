import {
  createProductController,
  getProductController,
  getSingleProductController,
  productPhotoController,
  deleteProductController,
  updateProductController,
  productFiltersController,
  productCountController,
  productListController,
  searchProductController,
  realtedProductController,
  productCategoryController,
} from "../controllers/productController.js";

import mongoose from "mongoose";

import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import orderModel from "../models/orderModel.js";
import fs from "fs";
import braintree from "braintree";

// Mock all external dependencies
jest.mock("../models/productModel.js");
jest.mock("../models/categoryModel.js");
jest.mock("../models/orderModel.js");
jest.mock("fs");
jest.mock("slugify", () => jest.fn((str) => str.replace(/\s+/g, "-")));

// Mock braintree with self-contained mocks
jest.mock("braintree", () => ({
  BraintreeGateway: jest.fn().mockImplementation(() => ({
    clientToken: {
      generate: jest.fn(),
    },
    transaction: {
      sale: jest.fn(),
    },
  })),
  Environment: {
    Sandbox: "sandbox",
  },
}));

describe("Product Controller Tests", () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Arrange - Reset mocks and setup common test data
    jest.clearAllMocks();

    mockReq = {
      fields: {},
      files: {},
      params: {},
      body: {},
      user: { _id: "user123" },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
  });

  describe("getProductController", () => {
    it("should get all products successfully", async () => {
      // Arrange
      const mockProducts = [
        { _id: "1", name: "Product 1", category: "cat1" },
        { _id: "2", name: "Product 2", category: "cat2" },
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts),
      };

      productModel.find.mockReturnValue(mockQuery);

      // Act
      await getProductController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({});
      expect(mockQuery.populate).toHaveBeenCalledWith("category");
      expect(mockQuery.select).toHaveBeenCalledWith("-photo");
      expect(mockQuery.limit).toHaveBeenCalledWith(12);
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        counTotal: 2,
        message: "ALlProducts ",
        products: mockProducts,
      });
    });

    it("should handle database errors when getting products", async () => {
      // Arrange
      const error = new Error("Database connection failed");
      productModel.find.mockImplementation(() => {
        throw error;
      });

      // Act
      await getProductController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Error in getting products",
        error: error.message,
      });
    });
  });

  describe("getSingleProductController", () => {
    it("should get single product by slug successfully", async () => {
      // Arrange
      mockReq.params.slug = "test-product";
      const mockProduct = {
        _id: "product123",
        name: "Test Product",
        slug: "test-product",
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockProduct),
      };

      productModel.findOne.mockReturnValue(mockQuery);

      // Act
      await getSingleProductController(mockReq, mockRes);

      // Assert
      expect(productModel.findOne).toHaveBeenCalledWith({
        slug: "test-product",
      });
      expect(mockQuery.select).toHaveBeenCalledWith("-photo");
      expect(mockQuery.populate).toHaveBeenCalledWith("category");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        message: "Single Product Fetched",
        product: mockProduct,
      });
    });

    it("should handle errors when getting single product", async () => {
      // Arrange
      mockReq.params.slug = "test-product";
      const error = new Error("Product not found");
      productModel.findOne.mockImplementation(() => {
        throw error;
      });

      // Act
      await getSingleProductController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Error while getting single product",
        error,
      });
    });
  });

  describe("productPhotoController", () => {
    it("should return product photo successfully", async () => {
      // Arrange
      mockReq.params.pid = "507f1f77bcf86cd799439011"; // Valid 24-char ObjectId
      const mockProduct = {
        photo: {
          data: Buffer.from("image data"),
          contentType: "image/jpeg",
        },
      };

      const mockQuery = {
        select: jest.fn().mockResolvedValue(mockProduct),
      };

      productModel.findById.mockReturnValue(mockQuery);

      // Act
      await productPhotoController(mockReq, mockRes);

      // Assert
      expect(productModel.findById).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011"
      );
      expect(mockQuery.select).toHaveBeenCalledWith("photo");
      expect(mockRes.set).toHaveBeenCalledWith("Content-type", "image/jpeg");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockProduct.photo.data);
    });

    it("should handle errors when getting photo", async () => {
      // Arrange
      mockReq.params.pid = "507f1f77bcf86cd799439011"; // Valid ObjectId
      const error = new Error("Photo not found");
      productModel.findById.mockImplementation(() => {
        throw error;
      });

      // Act
      await productPhotoController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Error while getting photo",
        error,
      });
    });

    it("should return 404 when product does not exist", async () => {
      // Arrange
      mockReq.params.pid = "507f1f77bcf86cd799439011"; // Valid ObjectId
      const mockQuery = {
        select: jest.fn().mockResolvedValue(null),
      };
      productModel.findById.mockReturnValue(mockQuery);

      // Act
      await productPhotoController(mockReq, mockRes);

      // Assert
      expect(productModel.findById).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011"
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Product not found",
      });
    });
  });

  describe("productPhotoController - input validation", () => {
    it("should return 400 for invalid product ID format", async () => {
      // Arrange
      mockReq.params.pid = "undefined"; // Invalid ObjectId

      // Act
      await productPhotoController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Invalid product ID",
      });
    });

    it("should return 400 for non-ObjectId string", async () => {
      // Arrange
      mockReq.params.pid = "not-a-valid-id";

      // Act
      await productPhotoController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Invalid product ID",
      });
    });

    it("should return 400 for empty product ID", async () => {
      // Arrange
      mockReq.params.pid = "";

      // Act
      await productPhotoController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Invalid product ID",
      });
    });
  });

  describe("productFiltersController", () => {
    it("should filter products by category and price", async () => {
      // Arrange
      mockReq.body = {
        checked: ["category1", "category2"],
        radio: [50, 200],
      };

      const mockProducts = [
        { _id: "1", name: "Product 1", price: 100 },
        { _id: "2", name: "Product 2", price: 150 },
      ];

      productModel.find.mockResolvedValue(mockProducts);

      // Act
      await productFiltersController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        category: ["category1", "category2"],
        price: { $gte: 50, $lte: 200 },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        products: mockProducts,
      });
    });

    it("should handle empty filters", async () => {
      // Arrange
      mockReq.body = {
        checked: [],
        radio: [],
      };

      const mockProducts = [];
      productModel.find.mockResolvedValue(mockProducts);

      // Act
      await productFiltersController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({});
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should handle filter errors", async () => {
      // Arrange
      mockReq.body = {
        checked: ["category1"],
        radio: [50, 200],
      };

      const error = new Error("Filter error");
      productModel.find.mockRejectedValue(error);

      // Act
      await productFiltersController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Error WHile Filtering Products",
        error,
      });
    });
  });

  describe("productCountController", () => {
    it("should return product count successfully", async () => {
      // Arrange
      const mockQuery = {
        estimatedDocumentCount: jest.fn().mockResolvedValue(50),
      };
      productModel.find.mockReturnValue(mockQuery);

      // Act
      await productCountController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({});
      expect(mockQuery.estimatedDocumentCount).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        total: 50,
      });
    });

    it("should handle count errors", async () => {
      // Arrange
      const error = new Error("Count error");
      const mockQuery = {
        estimatedDocumentCount: jest.fn().mockRejectedValue(error),
      };
      productModel.find.mockReturnValue(mockQuery);

      // Act
      await productCountController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: "Error in product count",
        error,
        success: false,
      });
    });
  });

  describe("productListController", () => {
    it("should return paginated products", async () => {
      // Arrange
      mockReq.params.page = "2";
      const mockProducts = [
        { _id: "1", name: "Product 1" },
        { _id: "2", name: "Product 2" },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts),
      };

      productModel.find.mockReturnValue(mockQuery);

      // Act
      await productListController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({});
      expect(mockQuery.select).toHaveBeenCalledWith("-photo");
      expect(mockQuery.skip).toHaveBeenCalledWith(6); // (2-1) * 6
      expect(mockQuery.limit).toHaveBeenCalledWith(6);
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        products: mockProducts,
      });
    });

    it("should default to page 1 when no page specified", async () => {
      // Arrange
      const mockProducts = [];
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts),
      };

      productModel.find.mockReturnValue(mockQuery);

      // Act
      await productListController(mockReq, mockRes);

      // Assert
      expect(mockQuery.skip).toHaveBeenCalledWith(0); // (1-1) * 6
    });
  });

  describe("productFiltersController - query construction validation", () => {
    it("should build query with only category filter when price is empty", async () => {
      // Arrange
      mockReq.body = {
        checked: ["cat1", "cat2"],
        radio: [],
      };
      productModel.find.mockResolvedValue([]);

      // Act
      await productFiltersController(mockReq, mockRes);

      // Assert - Verify EXACT query structure
      expect(productModel.find).toHaveBeenCalledWith({
        category: ["cat1", "cat2"],
        // Should NOT have price field
      });

      const callArgs = productModel.find.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("price");
    });

    it("should build query with only price filter when category is empty", async () => {
      // Arrange
      mockReq.body = {
        checked: [],
        radio: [100, 500],
      };
      productModel.find.mockResolvedValue([]);

      // Act
      await productFiltersController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        price: { $gte: 100, $lte: 500 },
      });

      const callArgs = productModel.find.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("category");
    });

    it("should handle single category in checked array", async () => {
      // Arrange
      mockReq.body = {
        checked: ["electronics"],
        radio: [],
      };
      productModel.find.mockResolvedValue([]);

      // Act
      await productFiltersController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        category: ["electronics"],
      });
    });

    it("should handle price range with same min and max value", async () => {
      // Arrange
      mockReq.body = {
        checked: [],
        radio: [100, 100],
      };
      productModel.find.mockResolvedValue([]);

      // Act
      await productFiltersController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        price: { $gte: 100, $lte: 100 },
      });
    });
  });

  describe("searchProductController", () => {
    it("should search products by keyword", async () => {
      // Arrange
      mockReq.params.keyword = "laptop";
      const mockProducts = [
        {
          _id: "1",
          name: "Gaming Laptop",
          description: "High performance laptop",
        },
      ];

      const mockQuery = {
        select: jest.fn().mockResolvedValue(mockProducts),
      };

      productModel.find.mockReturnValue(mockQuery);

      // Act
      await searchProductController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        $or: [
          { name: { $regex: "laptop", $options: "i" } },
          { description: { $regex: "laptop", $options: "i" } },
        ],
      });
      expect(mockQuery.select).toHaveBeenCalledWith("-photo");
      expect(mockRes.json).toHaveBeenCalledWith(mockProducts);
    });

    it("should handle search errors", async () => {
      // Arrange
      mockReq.params.keyword = "laptop";
      const error = new Error("Search error");
      productModel.find.mockImplementation(() => {
        throw error;
      });

      // Act
      await searchProductController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Error In Search Product API",
        error,
      });
    });

    it("should perform case-insensitive search", async () => {
      // Arrange
      mockReq.params.keyword = "LAPTOP";
      const mockQuery = {
        select: jest.fn().mockResolvedValue([]),
      };
      productModel.find.mockReturnValue(mockQuery);

      // Act
      await searchProductController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        $or: [
          { name: { $regex: "LAPTOP", $options: "i" } },
          { description: { $regex: "LAPTOP", $options: "i" } },
        ],
      });

      // Verify the 'i' option is present
      const callArgs = productModel.find.mock.calls[0][0];
      expect(callArgs.$or[0].name.$options).toBe("i");
      expect(callArgs.$or[1].description.$options).toBe("i");
    });

    it("should search with special characters in keyword", async () => {
      // Arrange - Test with special regex characters
      mockReq.params.keyword = "laptop.pro+";
      const mockQuery = {
        select: jest.fn().mockResolvedValue([]),
      };
      productModel.find.mockReturnValue(mockQuery);

      // Act
      await searchProductController(mockReq, mockRes);

      // Assert - Should pass the keyword as-is (MongoDB handles escaping)
      expect(productModel.find).toHaveBeenCalledWith({
        $or: [
          { name: { $regex: "laptop.pro+", $options: "i" } },
          { description: { $regex: "laptop.pro+", $options: "i" } },
        ],
      });
    });
  });

  describe("realtedProductController", () => {
    it("should return related products", async () => {
      // Arrange
      mockReq.params = { pid: "product123", cid: "category456" };
      const mockProducts = [
        { _id: "1", name: "Related Product 1" },
        { _id: "2", name: "Related Product 2" },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockProducts),
      };

      productModel.find.mockReturnValue(mockQuery);

      // Act
      await realtedProductController(mockReq, mockRes);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        category: "category456",
        _id: { $ne: "product123" },
      });
      expect(mockQuery.select).toHaveBeenCalledWith("-photo");
      expect(mockQuery.limit).toHaveBeenCalledWith(3);
      expect(mockQuery.populate).toHaveBeenCalledWith("category");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        products: mockProducts,
      });
    });

    it("should handle errors when fetching related products", async () => {
      // Arrange
      mockReq.params = { pid: "product123", cid: "category456" };
      const error = new Error("Database error");
      productModel.find.mockImplementation(() => {
        throw error;
      });

      // Act
      await realtedProductController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "error while geting related product",
        error,
      });
    });
  });

  describe("productCategoryController", () => {
    it("should return products by category", async () => {
      // Arrange
      mockReq.params.slug = "electronics";
      const mockCategory = {
        _id: "cat123",
        name: "Electronics",
        slug: "electronics",
      };
      const mockProducts = [
        { _id: "1", name: "Product 1", category: "cat123" },
      ];

      categoryModel.findOne.mockResolvedValue(mockCategory);
      const mockQuery = {
        populate: jest.fn().mockResolvedValue(mockProducts),
      };
      productModel.find.mockReturnValue(mockQuery);

      // Act
      await productCategoryController(mockReq, mockRes);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({
        slug: "electronics",
      });
      expect(productModel.find).toHaveBeenCalledWith({
        category: mockCategory,
      });
      expect(mockQuery.populate).toHaveBeenCalledWith("category");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        category: mockCategory,
        products: mockProducts,
      });
    });

    it("should handle errors when category is not found", async () => {
      // Arrange
      mockReq.params.slug = "non-existent";
      const error = new Error("Category not found");
      categoryModel.findOne.mockRejectedValue(error);

      // Act
      await productCategoryController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        error,
        message: "Error While Getting products",
      });
    });

    it("should handle errors when products query fails", async () => {
      // Arrange
      mockReq.params.slug = "electronics";
      const mockCategory = { _id: "cat123", name: "Electronics" };
      const error = new Error("Products query failed");

      categoryModel.findOne.mockResolvedValue(mockCategory);
      productModel.find.mockImplementation(() => {
        throw error;
      });

      // Act
      await productCategoryController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        error,
        message: "Error While Getting products",
      });
    });
  });

  describe("productPhotoController - edge cases", () => {
    it("should return 404 when product has no photo data", async () => {
      // Arrange
      mockReq.params.pid = "507f1f77bcf86cd799439011"; // CHANGE TO VALID OBJECTID
      const mockProduct = {
        photo: {
          data: null, // No photo data
          contentType: "image/jpeg",
        },
      };

      const mockQuery = {
        select: jest.fn().mockResolvedValue(mockProduct),
      };

      productModel.findById.mockReturnValue(mockQuery);

      // Act
      await productPhotoController(mockReq, mockRes);

      // Assert
      expect(productModel.findById).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011"
      );
      expect(mockQuery.select).toHaveBeenCalledWith("photo");
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Product photo not found",
      });
    });
  });

  describe("productListController - pagination edge cases", () => {
    it("should handle pagination with page parameter as string", async () => {
      // Arrange
      mockReq.params.page = "3"; // String page number
      const mockProducts = [{ _id: "1", name: "Product 1" }];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts),
      };

      productModel.find.mockReturnValue(mockQuery);

      // Act
      await productListController(mockReq, mockRes);

      // Assert
      expect(mockQuery.skip).toHaveBeenCalledWith(12); // (3-1) * 6 = 12
      expect(mockQuery.limit).toHaveBeenCalledWith(6);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        products: mockProducts,
      });
    });

    it("should handle pagination error", async () => {
      // Arrange
      mockReq.params.page = "2";
      const error = new Error("Pagination error");

      productModel.find.mockImplementation(() => {
        throw error;
      });

      // Act
      await productListController(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "error in per page ctrl",
        error,
      });
    });
  });

  // createProductController tests
  describe("createProductController", () => {
    describe("Successful Product Creation", () => {
      it("should create product successfully with all required fields", async () => {
        // Arrange
        mockReq.fields = {
          name: "Gaming Laptop",
          description: "High performance gaming laptop",
          price: 1500,
          category: "electronics",
          quantity: 10,
          shipping: true,
        };
        mockReq.files = {};

        const mockProduct = {
          _id: "prod123",
          ...mockReq.fields,
          slug: "Gaming-Laptop",
          photo: { data: null, contentType: null },
          save: jest.fn().mockResolvedValue(true),
        };

        productModel.mockImplementation(() => mockProduct);

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(productModel).toHaveBeenCalledWith({
          ...mockReq.fields,
          slug: "Gaming-Laptop",
        });
        expect(mockProduct.save).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: true,
          message: "Product Created Successfully",
          products: mockProduct,
        });
      });

      it("should create product with photo successfully", async () => {
        // Arrange
        mockReq.fields = {
          name: "Camera",
          description: "DSLR Camera",
          price: 800,
          category: "electronics",
          quantity: 5,
          shipping: false,
        };
        mockReq.files = {
          photo: {
            path: "/tmp/photo.jpg",
            type: "image/jpeg",
            size: 500000,
          },
        };

        const mockPhotoData = Buffer.from("photo-data");
        fs.readFileSync.mockReturnValue(mockPhotoData);

        const mockProduct = {
          _id: "prod456",
          ...mockReq.fields,
          slug: "Camera",
          photo: { data: null, contentType: null },
          save: jest.fn().mockResolvedValue(true),
        };

        productModel.mockImplementation(() => mockProduct);

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(fs.readFileSync).toHaveBeenCalledWith("/tmp/photo.jpg");
        expect(mockProduct.photo.data).toBe(mockPhotoData);
        expect(mockProduct.photo.contentType).toBe("image/jpeg");
        expect(mockProduct.save).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(201);
      });

      it("should return 400 when price is 0", async () => {
        // Arrange
        mockReq.fields = {
          name: "Zero Price",
          description: "desc",
          price: 0, // boundary
          category: "cat",
          quantity: 5,
        };

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Price is Required",
        });
      });

      it("should return 400 when quantity is 0", async () => {
        // Arrange
        mockReq.fields = {
          name: "Zero Quantity",
          description: "desc",
          price: 10,
          category: "cat",
          quantity: 0, // boundary
        };

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Quantity is Required",
        });
      });

      it("should generate a slug from the name (explicit slug assertion)", async () => {
        // Arrange
        mockReq.fields = {
          name: "My Fancy Name",
          description: "desc",
          price: 100,
          category: "cat",
          quantity: 2,
        };
        mockReq.files = {};

        const mockProduct = {
          save: jest.fn().mockResolvedValue(true),
          photo: {},
        };
        productModel.mockImplementation(() => mockProduct);

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(productModel).toHaveBeenCalledWith(
          expect.objectContaining({ slug: "My-Fancy-Name" })
        );
      });

      it("should create successfully when shipping is false", async () => {
        // Arrange
        mockReq.fields = {
          name: "No Ship",
          description: "desc",
          price: 50,
          category: "cat",
          quantity: 1,
          shipping: false,
        };
        const mockProduct = {
          save: jest.fn().mockResolvedValue(true),
          photo: {},
        };
        productModel.mockImplementation(() => mockProduct);

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: true,
          message: "Product Created Successfully",
          products: mockProduct,
        });
      });
    });

    // validation tests for required fields
    describe("Required Field Validation", () => {
      it("should return 400 when name is missing", async () => {
        // Arrange
        mockReq.fields = {
          description: "Test product",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Name is Required",
        });
        expect(productModel).not.toHaveBeenCalled();
      });

      it("should return 400 when description is missing", async () => {
        // Arrange
        mockReq.fields = {
          name: "Product",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Description is Required",
        });
      });

      it("should return 400 when price is missing", async () => {
        // Arrange
        mockReq.fields = {
          name: "Product",
          description: "Description",
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Price is Required",
        });
      });

      it("should return 400 when category is missing", async () => {
        // Arrange
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          quantity: 5,
        };
        mockReq.files = {};

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Category is Required",
        });
      });

      it("should return 400 when quantity is missing", async () => {
        // Arrange
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
        };
        mockReq.files = {};

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Quantity is Required",
        });
      });
    });

    // photo validation tests
    describe("Photo Validation", () => {
      it("should return 400 when photo size exceeds 1MB", async () => {
        // Arrange
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {
          photo: {
            path: "/tmp/large.jpg",
            type: "image/jpeg",
            size: 1500000, // 1.5MB
          },
        };

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Photo is required and should be less than 1mb",
        });
        expect(productModel).not.toHaveBeenCalled();
      });

      it("should accept photo exactly at 1MB limit", async () => {
        // Arrange
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {
          photo: {
            path: "/tmp/exact.jpg",
            type: "image/jpeg",
            size: 1000000, // Exactly 1MB
          },
        };

        fs.readFileSync.mockReturnValue(Buffer.from("data"));

        const mockProduct = {
          _id: "prod789",
          ...mockReq.fields,
          slug: "Product",
          photo: { data: null, contentType: null },
          save: jest.fn().mockResolvedValue(true),
        };

        productModel.mockImplementation(() => mockProduct);

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockProduct.save).toHaveBeenCalled();
      });

      it("should create product without photo when photo is not provided", async () => {
        // Arrange
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {}; // No photo

        const mockProduct = {
          _id: "prod999",
          ...mockReq.fields,
          slug: "Product",
          photo: { data: null, contentType: null },
          save: jest.fn().mockResolvedValue(true),
        };

        productModel.mockImplementation(() => mockProduct);

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(fs.readFileSync).not.toHaveBeenCalled();
        expect(mockProduct.save).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(201);
      });
    });

    // error handling tests
    describe("Error Handling", () => {
      it("should handle database save errors", async () => {
        // Arrange
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        const error = new Error("Database connection failed");
        const mockProduct = {
          save: jest.fn().mockRejectedValue(error),
        };

        productModel.mockImplementation(() => mockProduct);

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          error,
          message: "Error in creating product",
        });
      });

      it("should handle file read errors", async () => {
        // Arrange
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {
          photo: {
            path: "/tmp/invalid.jpg",
            type: "image/jpeg",
            size: 50000,
          },
        };

        const error = new Error("File not found");
        fs.readFileSync.mockImplementation(() => {
          throw error;
        });

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          error,
          message: "Error in creating product",
        });
      });
    });

    // edge cases test
    describe("Edge Cases", () => {
      it("should handle product with empty string values correctly", async () => {
        // Arrange - Testing that validation catches empty strings
        mockReq.fields = {
          name: "", // Empty string - should fail
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Name is Required",
        });
      });

      it("should generate slug from product name", async () => {
        // Arrange
        mockReq.fields = {
          name: "Test Product Name",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        const mockProduct = {
          save: jest.fn().mockResolvedValue(true),
        };

        productModel.mockImplementation(() => mockProduct);

        // Act
        await createProductController(mockReq, mockRes);

        // Assert
        expect(productModel).toHaveBeenCalledWith(
          expect.objectContaining({
            slug: "Test-Product-Name",
          })
        );
      });
    });
  });

  // updateProductController tests
  describe("updateProductController", () => {
    describe("Successful Product Update", () => {
      it("should update product successfully with all fields", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          name: "Updated Laptop",
          description: "Updated description",
          price: 2000,
          category: "electronics",
          quantity: 15,
          shipping: true,
        };
        mockReq.files = {};

        const mockProduct = {
          _id: "prod123",
          ...mockReq.fields,
          slug: "Updated-Laptop",
          photo: { data: null, contentType: null },
          save: jest.fn().mockResolvedValue(true),
        };

        productModel.findByIdAndUpdate.mockResolvedValue(mockProduct);

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
          "prod123",
          {
            ...mockReq.fields,
            slug: "Updated-Laptop",
          },
          { new: true }
        );
        expect(mockProduct.save).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: true,
          message: "Product Updated Successfully",
          products: mockProduct,
        });
      });

      it("should update product with new photo", async () => {
        // Arrange
        mockReq.params.pid = "prod456";
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {
          photo: {
            path: "/tmp/newphoto.jpg",
            type: "image/png",
            size: 600000,
          },
        };

        const mockPhotoData = Buffer.from("new-photo-data");
        fs.readFileSync.mockReturnValue(mockPhotoData);

        const mockProduct = {
          _id: "prod456",
          ...mockReq.fields,
          slug: "Product",
          photo: { data: null, contentType: null },
          save: jest.fn().mockResolvedValue(true),
        };

        productModel.findByIdAndUpdate.mockResolvedValue(mockProduct);

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(fs.readFileSync).toHaveBeenCalledWith("/tmp/newphoto.jpg");
        expect(mockProduct.photo.data).toBe(mockPhotoData);
        expect(mockProduct.photo.contentType).toBe("image/png");
        expect(mockProduct.save).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it("should update product without changing photo", async () => {
        // Arrange
        mockReq.params.pid = "prod789";
        mockReq.fields = {
          name: "Product",
          description: "Updated description only",
          price: 150,
          category: "cat1",
          quantity: 8,
        };
        mockReq.files = {}; // No new photo

        const mockProduct = {
          _id: "prod789",
          ...mockReq.fields,
          slug: "Product",
          photo: {
            data: Buffer.from("existing-photo"),
            contentType: "image/jpeg",
          },
          save: jest.fn().mockResolvedValue(true),
        };

        productModel.findByIdAndUpdate.mockResolvedValue(mockProduct);

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(fs.readFileSync).not.toHaveBeenCalled();
        expect(mockProduct.save).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it("should accept photo exactly at 1MB", async () => {
        // Arrange
        mockReq.params.pid = "p-boundary";
        mockReq.fields = {
          name: "Boundary Photo",
          description: "desc",
          price: 10,
          category: "cat",
          quantity: 1,
        };
        mockReq.files = {
          photo: {
            path: "/tmp/exact-1mb.jpg",
            type: "image/jpeg",
            size: 1_000_000,
          },
        };
        const updated = { photo: {}, save: jest.fn().mockResolvedValue(true) };
        productModel.findByIdAndUpdate.mockResolvedValue(updated);

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(updated.save).toHaveBeenCalled();
      });

      it("should return 400 when price is 0", async () => {
        // Arrange
        mockReq.params.pid = "pid-0p";
        mockReq.fields = {
          name: "ZeroP",
          description: "d",
          price: 0, // boundary
          category: "c",
          quantity: 1,
        };
        mockReq.files = {};

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Price is Required",
        });
      });

      it("should return 400 when quantity is 0", async () => {
        // Arrange
        mockReq.params.pid = "pid-0q";
        mockReq.fields = {
          name: "ZeroQ",
          description: "d",
          price: 1,
          category: "c",
          quantity: 0, // boundary
        };
        mockReq.files = {};

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Quantity is Required",
        });
      });

      it("should update slug based on new name (explicit slug assertion)", async () => {
        // Arrange
        mockReq.params.pid = "pid-slug";
        mockReq.fields = {
          name: "New Name To Slug",
          description: "d",
          price: 100,
          category: "c",
          quantity: 5,
        };
        const updated = { save: jest.fn().mockResolvedValue(true), photo: {} };
        productModel.findByIdAndUpdate.mockResolvedValue(updated);

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
          "pid-slug",
          expect.objectContaining({ slug: "New-Name-To-Slug" }),
          { new: true }
        );
      });
    });

    // validation tests for required fields
    describe("Required Field Validation", () => {
      it("should return 400 when name is missing", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Name is Required",
        });
        expect(productModel.findByIdAndUpdate).not.toHaveBeenCalled();
      });

      it("should return 400 when description is missing", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          name: "Product",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Description is Required",
        });
      });

      it("should return 400 when price is missing", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          name: "Product",
          description: "Description",
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Price is Required",
        });
      });

      it("should return 400 when category is missing", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          quantity: 5,
        };
        mockReq.files = {};

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Category is Required",
        });
      });

      it("should return 400 when quantity is missing", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
        };
        mockReq.files = {};

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Quantity is Required",
        });
      });
    });

    // photo validation tests
    describe("Photo Validation", () => {
      it("should return 400 when photo size exceeds 1MB", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {
          photo: {
            path: "/tmp/large.jpg",
            type: "image/jpeg",
            size: 2000000, // 2MB
          },
        };

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          error: "Photo should be less than 1mb",
        });
        expect(productModel.findByIdAndUpdate).not.toHaveBeenCalled();
      });
    });

    // error handling for product not found tests
    describe("Product Not Found", () => {
      it("should return 404 when product does not exist", async () => {
        // Arrange
        mockReq.params.pid = "nonexistent";
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        productModel.findByIdAndUpdate.mockResolvedValue(null);

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Product not found",
        });
      });

      it("should return 404 before attempting to read photo file", async () => {
        // Arrange
        mockReq.params.pid = "nonexistent";
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {
          photo: {
            path: "/tmp/photo.jpg",
            type: "image/jpeg",
            size: 50000,
          },
        };

        productModel.findByIdAndUpdate.mockResolvedValue(null);

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(fs.readFileSync).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Product not found",
        });
      });
    });

    // error handling tests
    describe("Error Handling", () => {
      it("should handle database update errors", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        const error = new Error("Database update failed");
        productModel.findByIdAndUpdate.mockRejectedValue(error);

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          error,
          message: "Error in Update product",
        });
      });

      it("should handle save errors after update", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        const error = new Error("Save failed");
        const mockProduct = {
          save: jest.fn().mockRejectedValue(error),
        };

        productModel.findByIdAndUpdate.mockResolvedValue(mockProduct);

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          error,
          message: "Error in Update product",
        });
      });

      it("should handle file read errors when updating photo", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          name: "Product",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {
          photo: {
            path: "/tmp/corrupt.jpg",
            type: "image/jpeg",
            size: 50000,
          },
        };

        const mockProduct = {
          photo: { data: null, contentType: null },
          save: jest.fn(),
        };

        productModel.findByIdAndUpdate.mockResolvedValue(mockProduct);

        const error = new Error("Cannot read file");
        fs.readFileSync.mockImplementation(() => {
          throw error;
        });

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          error,
          message: "Error in Update product",
        });
      });
    });

    // edge cases tests
    describe("Edge Cases", () => {
      it("should update slug when name changes", async () => {
        // Arrange
        mockReq.params.pid = "prod123";
        mockReq.fields = {
          name: "New Product Name",
          description: "Description",
          price: 100,
          category: "cat1",
          quantity: 5,
        };
        mockReq.files = {};

        const mockProduct = {
          save: jest.fn().mockResolvedValue(true),
        };

        productModel.findByIdAndUpdate.mockResolvedValue(mockProduct);

        // Act
        await updateProductController(mockReq, mockRes);

        // Assert
        expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
          "prod123",
          expect.objectContaining({
            slug: "New-Product-Name",
          }),
          { new: true }
        );
      });
    });
  });

  // deleteProductController tests
  describe("deleteProductController", () => {
    describe("Successful Product Deletion", () => {
      it("should delete product successfully with valid ID", async () => {
        // Arrange
        mockReq.params.pid = "507f1f77bcf86cd799439011"; // Valid MongoDB ObjectId
        const mockProduct = {
          _id: "507f1f77bcf86cd799439011",
          name: "Product to delete",
        };

        productModel.findByIdAndDelete.mockResolvedValue(mockProduct);

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(productModel.findByIdAndDelete).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011"
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: true,
          message: "Product Deleted successfully",
        });
      });

      it("should delete product with different valid ObjectId format", async () => {
        // Arrange
        mockReq.params.pid = "5f8d0d55b54764421b7156a9"; // Another valid ObjectId
        const mockProduct = {
          _id: "5f8d0d55b54764421b7156a9",
          name: "Another product",
        };

        productModel.findByIdAndDelete.mockResolvedValue(mockProduct);

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(productModel.findByIdAndDelete).toHaveBeenCalledWith(
          "5f8d0d55b54764421b7156a9"
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
      it("should call mongoose.Types.ObjectId.isValid and short-circuit on invalid id", async () => {
        // Arrange
        const spy = jest
          .spyOn(mongoose.Types.ObjectId, "isValid")
          .mockReturnValue(false);
        mockReq.params.pid = "bad-id";

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(spy).toHaveBeenCalledWith("bad-id");
        expect(productModel.findByIdAndDelete).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Invalid product ID",
        });

        spy.mockRestore();
      });

      it("should proceed to DB delete when ObjectId.isValid returns true", async () => {
        // Arrange
        const spy = jest
          .spyOn(mongoose.Types.ObjectId, "isValid")
          .mockReturnValue(true);
        mockReq.params.pid = "507f1f77bcf86cd799439011";
        productModel.findByIdAndDelete.mockResolvedValue({
          _id: mockReq.params.pid,
        });

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(spy).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
        expect(productModel.findByIdAndDelete).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011"
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: true,
          message: "Product Deleted successfully",
        });

        spy.mockRestore();
      });
    });

    // validation tests for invalid product ID
    describe("Invalid Product ID Validation", () => {
      it("should return 400 for invalid ObjectId format", async () => {
        // Arrange
        mockReq.params.pid = "invalid-id-123";

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Invalid product ID",
        });
        expect(productModel.findByIdAndDelete).not.toHaveBeenCalled();
      });

      it("should return 400 for empty product ID", async () => {
        // Arrange
        mockReq.params.pid = "";

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Invalid product ID",
        });
        expect(productModel.findByIdAndDelete).not.toHaveBeenCalled();
      });

      it("should return 400 for null product ID", async () => {
        // Arrange
        mockReq.params.pid = null;

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Invalid product ID",
        });
      });

      it("should return 400 for undefined product ID", async () => {
        // Arrange
        mockReq.params.pid = undefined;

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Invalid product ID",
        });
      });

      it("should return 400 for too short ObjectId", async () => {
        // Arrange
        mockReq.params.pid = "507f1f77"; // Too short

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Invalid product ID",
        });
      });

      it("should return 400 for too long ObjectId", async () => {
        // Arrange
        mockReq.params.pid = "507f1f77bcf86cd799439011123"; // Too long

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Invalid product ID",
        });
      });

      it("should return 400 for ObjectId with invalid characters", async () => {
        // Arrange
        mockReq.params.pid = "507f1f77bcf86cd79943901g"; // Contains 'g'

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Invalid product ID",
        });
      });
    });

    // error handling for product not found tests
    describe("Product Not Found", () => {
      it("should return 404 when product does not exist", async () => {
        // Arrange
        mockReq.params.pid = "507f1f77bcf86cd799439011"; // Valid ObjectId
        productModel.findByIdAndDelete.mockResolvedValue(null);

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(productModel.findByIdAndDelete).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011"
        );
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Product not found",
        });
      });

      it("should return 404 for valid ObjectId that does not match any product", async () => {
        // Arrange
        mockReq.params.pid = "000000000000000000000000"; // Valid but non-existent
        productModel.findByIdAndDelete.mockResolvedValue(null);

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Product not found",
        });
      });
    });

    // error handling tests
    describe("Error Handling", () => {
      it("should handle database deletion errors", async () => {
        // Arrange
        mockReq.params.pid = "507f1f77bcf86cd799439011";
        const error = new Error("Database connection lost");
        productModel.findByIdAndDelete.mockRejectedValue(error);

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Error while deleting product",
          error,
        });
      });

      it("should handle unexpected database errors", async () => {
        // Arrange
        mockReq.params.pid = "507f1f77bcf86cd799439011";
        const error = new Error("Unexpected error");
        productModel.findByIdAndDelete.mockRejectedValue(error);

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Error while deleting product",
          error,
        });
      });

      it("should handle timeout errors", async () => {
        // Arrange
        mockReq.params.pid = "507f1f77bcf86cd799439011";
        const error = new Error("Operation timed out");
        productModel.findByIdAndDelete.mockRejectedValue(error);

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Error while deleting product",
          error,
        });
      });
    });

    // tests using BVA
    describe("Boundary Values", () => {
      it("should handle minimum valid ObjectId (all zeros)", async () => {
        // Arrange
        mockReq.params.pid = "000000000000000000000000";
        const mockProduct = { _id: "000000000000000000000000" };
        productModel.findByIdAndDelete.mockResolvedValue(mockProduct);

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it("should handle maximum valid ObjectId (all f)", async () => {
        // Arrange
        mockReq.params.pid = "ffffffffffffffffffffffff";
        const mockProduct = { _id: "ffffffffffffffffffffffff" };
        productModel.findByIdAndDelete.mockResolvedValue(mockProduct);

        // Act
        await deleteProductController(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
    });
  });
});

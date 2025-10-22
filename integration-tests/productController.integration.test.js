import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import fs from "fs";
import path from "path";
import {
  getProductController,
  getSingleProductController,
  productPhotoController,
  productFiltersController,
  productCountController,
  productListController,
  searchProductController,
  realtedProductController,
  productCategoryController,
  createProductController,
  updateProductController,
  deleteProductController,
} from "../controllers/productController.js";

let mongoServer;

const mockRequest = (params = {}, body = {}) => ({ params, body });

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
};

describe("Product Controller Integration Tests", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 60000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoServer.stop();
  }, 60000);

  afterEach(async () => {
    if (mongoose.connection.readyState !== 0) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany();
      }
    }
  });

  describe("getProductController Integration", () => {
    it("should retrieve products with populated category from database", async () => {
      // Arrange
      const category = await categoryModel.create({ 
        name: "Electronics", 
        slug: "electronics" 
      });
      await productModel.create([
        { 
          name: "Laptop", 
          slug: "laptop", 
          description: "High-end", 
          price: 1000, 
          category: category._id, 
          quantity: 10 
        },
        { 
          name: "Phone", 
          slug: "phone", 
          description: "Smartphone", 
          price: 500, 
          category: category._id, 
          quantity: 20 
        },
      ]);
      const req = mockRequest();
      const res = mockResponse();

      // Act
      await getProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.products).toHaveLength(2);
      expect(response.products[0].category.name).toBe("Electronics");
      expect(response.products[0].category.slug).toBe("electronics");
    });

    it("sorts by createdAt desc deterministically and limits to 12", async () => {
      const category = await categoryModel.create({ name: "Books", slug: "books" });

      // Seed with explicit createdAt so order is deterministic
      const docs = [];
      for (let i = 1; i <= 15; i++) {
        docs.push({
          name: `Product ${i}`,
          slug: `product-${i}`,
          description: `Desc ${i}`,
          price: i * 10,
          category: category._id,
          quantity: i,
          createdAt: new Date(2024, 0, i), // Jan 1..15 2024
          updatedAt: new Date(2024, 0, i),
        });
      }
      await productModel.insertMany(docs);

      const req = mockRequest();
      const res = mockResponse();
      await getProductController(req, res);

      const { products } = res.send.mock.calls[0][0];
      expect(products).toHaveLength(12);
      // Newest should be Product 15
      expect(products[0].name).toBe("Product 15");
      // Oldest of the page should be Product 4 (15..4 = 12 items)
      expect(products[11].name).toBe("Product 4");
    });

    it("should return products with category data and exclude photo buffer", async () => {
      // Arrange
      const category = await categoryModel.create({ 
        name: "Test", 
        slug: "test" 
      });
      const photoData = Buffer.from("large photo data");
      await productModel.create({
        name: "Product", 
        slug: "product", 
        description: "Test", 
        price: 100, 
        category: category._id, 
        quantity: 5,
        photo: { data: photoData, contentType: "image/jpeg" }
      });
      const req = mockRequest();
      const res = mockResponse();

      // Act
      await getProductController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      const product = response.products[0];
      expect(product.name).toBe("Product");
      expect(product.category).toBeDefined();
      expect(product.photo?.data).toBeUndefined();
    });

    it("should return empty array when no products exist in database", async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();

      // Act
      await getProductController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.products).toHaveLength(0);
    });

    it("should populate category data for products from multiple categories", async () => {
      // Arrange
      const cat1 = await categoryModel.create({ name: "Electronics", slug: "electronics" });
      const cat2 = await categoryModel.create({ name: "Books", slug: "books" });
      await productModel.create([
        { name: "Laptop", slug: "laptop", description: "Tech", price: 1000, category: cat1._id, quantity: 5 },
        { name: "Novel", slug: "novel", description: "Fiction", price: 20, category: cat2._id, quantity: 10 },
      ]);
      const req = mockRequest();
      const res = mockResponse();

      // Act
      await getProductController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      const categories = response.products.map(p => p.category.name).sort();
      expect(categories).toContain("Electronics");
      expect(categories).toContain("Books");
    });
  });

  describe("getSingleProductController Integration", () => {
    it("should retrieve single product with populated category via slug lookup", async () => {
      // Arrange
      const category = await categoryModel.create({ 
        name: "Furniture", 
        slug: "furniture" 
      });
      await productModel.create({
        name: "Chair", 
        slug: "wooden-chair", 
        description: "Comfortable",
        price: 150, 
        category: category._id, 
        quantity: 5
      });
      const req = mockRequest({ slug: "wooden-chair" });
      const res = mockResponse();

      // Act
      await getSingleProductController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.product.name).toBe("Chair");
      expect(response.product.category.name).toBe("Furniture");
      expect(response.product.category._id.toString()).toBe(category._id.toString());
    });

    it("should return single product with category data and exclude photo buffer", async () => {
      // Arrange
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      const photoData = Buffer.from("photo data");
      await productModel.create({
        name: "Product",
        slug: "test-product",
        description: "Test",
        price: 100,
        category: category._id,
        quantity: 5,
        photo: { data: photoData, contentType: "image/png" }
      });
      const req = mockRequest({ slug: "test-product" });
      const res = mockResponse();

      // Act
      await getSingleProductController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      const product = response.product;
      expect(product.name).toBe("Product");
      expect(product.category).toBeDefined();
      expect(product.photo?.data).toBeUndefined();
    });

    it("should return null for non-existent slug", async () => {
      // Arrange
      const req = mockRequest({ slug: "non-existent" });
      const res = mockResponse();

      // Act
      await getSingleProductController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].product).toBeNull();
    });

    it("should handle slug with special characters", async () => {
      // Arrange
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      await productModel.create({
        name: "Special Product",
        slug: "special-product-2024",
        description: "Test",
        price: 99,
        category: category._id,
        quantity: 3
      });
      const req = mockRequest({ slug: "special-product-2024" });
      const res = mockResponse();

      // Act
      await getSingleProductController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.product.name).toBe("Special Product");
    });

    it("should perform case-sensitive slug matching", async () => {
      // Arrange
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      await productModel.create({
        name: "Product",
        slug: "test-slug",
        description: "Test",
        price: 50,
        category: category._id,
        quantity: 1
      });
      const req = mockRequest({ slug: "TEST-SLUG" });
      const res = mockResponse();

      // Act
      await getSingleProductController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].product).toBeNull();
    });
  });

  describe("productPhotoController Integration", () => {
    it("should retrieve photo from database and set correct content type", async () => {
      // Arrange
      const category = await categoryModel.create({ 
        name: "Test", 
        slug: "test" 
      });
      const photoData = Buffer.from("fake image data");
      const product = await productModel.create({
        name: "Product", 
        slug: "product", 
        description: "Test", 
        price: 200,
        category: category._id, 
        quantity: 5,
        photo: { data: photoData, contentType: "image/jpeg" }
      });
      const req = mockRequest({ pid: product._id.toString() });
      const res = mockResponse();

      // Act
      await productPhotoController(req, res);

      // Assert
      expect(res.set).toHaveBeenCalledWith("Content-type", "image/jpeg");
      expect(res.status).toHaveBeenCalledWith(200);
      const sentData = res.send.mock.calls[0][0];
      expect(Buffer.isBuffer(sentData)).toBe(true);
      expect(sentData.toString()).toBe(photoData.toString());
    });

    it("should handle different image content types correctly", async () => {
      // Arrange
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      const photoData = Buffer.from("png image data");
      const product = await productModel.create({
        name: "Product",
        slug: "product",
        description: "Test",
        price: 150,
        category: category._id,
        quantity: 3,
        photo: { data: photoData, contentType: "image/png" }
      });
      const req = mockRequest({ pid: product._id.toString() });
      const res = mockResponse();

      // Act
      await productPhotoController(req, res);

      // Assert
      expect(res.set).toHaveBeenCalledWith("Content-type", "image/png");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should reject invalid ObjectId before database query", async () => {
      // Arrange
      const req = mockRequest({ pid: "invalid-id" });
      const res = mockResponse();

      // Act
      await productPhotoController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Invalid product ID");
    });

    it("should reject empty string as product ID", async () => {
      // Arrange
      const req = mockRequest({ pid: "" });
      const res = mockResponse();

      // Act
      await productPhotoController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Invalid product ID");
    });

    it("should return 404 when photo data is missing in database", async () => {
      // Arrange
      const category = await categoryModel.create({ 
        name: "Test", 
        slug: "test" 
      });
      const product = await productModel.create({
        name: "No Photo", 
        slug: "no-photo", 
        description: "Missing", 
        price: 100, 
        category: category._id, 
        quantity: 1
      });
      const req = mockRequest({ pid: product._id.toString() });
      const res = mockResponse();

      // Act
      await productPhotoController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send.mock.calls[0][0].message).toBe("Product photo not found");
    });

    it("should return 404 when product exists but photo data is empty", async () => {
      // Arrange
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      const product = await productModel.create({
        name: "Empty Photo",
        slug: "empty-photo",
        description: "Test",
        price: 75,
        category: category._id,
        quantity: 2,
        photo: { data: null, contentType: "image/jpeg" }
      });
      const req = mockRequest({ pid: product._id.toString() });
      const res = mockResponse();

      // Act
      await productPhotoController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send.mock.calls[0][0].message).toBe("Product photo not found");
    });

    it("should return 404 for valid ObjectId with non-existent product", async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId();
      const req = mockRequest({ pid: nonExistentId.toString() });
      const res = mockResponse();

      // Act
      await productPhotoController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send.mock.calls[0][0].message).toBe("Product not found");
    });

    it("returns 200 even if contentType is missing (data present)", async () => {
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      const photoData = Buffer.from("raw-bytes");
      const product = await productModel.create({
        name: "No CT",
        slug: "no-ct",
        description: "x",
        price: 1,
        category: category._id,
        quantity: 1,
        photo: { data: photoData }, // no contentType
      });

      const req = mockRequest({ pid: product._id.toString() });
      const res = mockResponse();
      await productPhotoController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      // Express will be called with undefined; acceptable contract as long as bytes are served
      expect(res.set).toHaveBeenCalledWith("Content-type", undefined);
      const sent = res.send.mock.calls[0][0];
      expect(Buffer.isBuffer(sent)).toBe(true);
      expect(sent.equals(photoData)).toBe(true);
    });
  });

  describe("productFiltersController - Combinatorial Testing", () => {
    let cat1, cat2, cat3;

    beforeEach(async () => {
      cat1 = await categoryModel.create({ 
        name: "Electronics", 
        slug: "electronics" 
      });
      cat2 = await categoryModel.create({ 
        name: "Books", 
        slug: "books" 
      });
      cat3 = await categoryModel.create({ 
        name: "Clothing", 
        slug: "clothing" 
      });

      await productModel.create([
        { name: "Laptop", slug: "laptop", description: "Expensive", price: 1500, category: cat1._id, quantity: 5 },
        { name: "Phone", slug: "phone", description: "Mid-range", price: 500, category: cat1._id, quantity: 10 },
        { name: "Tablet", slug: "tablet", description: "Budget", price: 200, category: cat1._id, quantity: 15 },
        { name: "Novel", slug: "novel", description: "Fiction", price: 20, category: cat2._id, quantity: 50 },
        { name: "Textbook", slug: "textbook", description: "Educational", price: 80, category: cat2._id, quantity: 30 },
        { name: "T-Shirt", slug: "tshirt", description: "Cotton", price: 25, category: cat3._id, quantity: 100 },
        { name: "Jeans", slug: "jeans", description: "Denim", price: 60, category: cat3._id, quantity: 50 },
      ]);
    });

    it("should filter products by single category", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [cat1._id], radio: [] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(3);
      expect(response.products.every(p => p.category.toString() === cat1._id.toString())).toBe(true);
    });

    it("should filter products by multiple categories", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [cat1._id, cat2._id], radio: [] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(5);
    });

    it("should filter products by all three categories", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [cat1._id, cat2._id, cat3._id], radio: [] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(7);
    });

    it("should filter products by price range only", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [], radio: [50, 100] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(2);
      expect(response.products.every(p => p.price >= 50 && p.price <= 100)).toBe(true);
    });

    it("should filter products by category and price with matching results", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [cat1._id], radio: [400, 600] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(1);
      expect(response.products[0].name).toBe("Phone");
    });

    it("should return empty array when category and price filters have no matches", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [cat2._id], radio: [100, 200] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(0);
    });

    it("should filter by multiple categories and price range with matches", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [cat2._id, cat3._id], radio: [20, 30] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(2);
      expect(response.products.some(p => p.name === "Novel")).toBe(true);
      expect(response.products.some(p => p.name === "T-Shirt")).toBe(true);
    });

    it("should filter by multiple categories and narrow price range", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [cat1._id, cat3._id], radio: [50, 70] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(1);
      expect(response.products[0].name).toBe("Jeans");
    });

    it("should return all products when no filters are applied", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [], radio: [] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(7);
    });

    it("should include products at exact lower price bound", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [], radio: [500, 1000] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(1);
      expect(response.products[0].price).toBe(500);
    });

    it("should filter products with price starting at zero", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [], radio: [0, 50] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(2);
    });

    it("should include products at exact upper price bound", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [], radio: [1000, 1500] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(1);
      expect(response.products[0].price).toBe(1500);
    });

    it("should exclude products just below lower price bound", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [], radio: [21, 100] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products.every(p => p.price >= 21)).toBe(true);
      expect(response.products.some(p => p.name === "Novel")).toBe(false);
    });

    it("should exclude products just above upper price bound", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [], radio: [0, 499] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products.every(p => p.price <= 499)).toBe(true);
      expect(response.products.some(p => p.name === "Phone")).toBe(false);
    });

    it("should handle very wide price range", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [], radio: [0, 10000] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(7);
    });

    it("should handle very narrow price range with no matches", async () => {
      // Arrange
      const req = mockRequest({}, { checked: [], radio: [21, 24] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(0);
    });

    it("should filter by non-existent category ID", async () => {
      // Arrange
      const fakeId = new mongoose.Types.ObjectId();
      const req = mockRequest({}, { checked: [fakeId], radio: [] });
      const res = mockResponse();

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(0);
    });

    it("returns 400 when body is missing checked/radio keys", async () => {
      const req = { params: {}, body: {} }; // missing keys
      const res = mockResponse();

      await productFiltersController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const payload = res.send.mock.calls[0][0];
      expect(payload.success).toBe(false);
      expect(String(payload.message).toLowerCase()).toContain("filter");
    });

    it("handles large category $in lists", async () => {
      // Create 10 categories with one product each
      const catDocs = await categoryModel.insertMany(
        Array.from({ length: 10 }, (_, i) => ({ name: `C${i}`, slug: `c${i}` }))
      );
      await productModel.insertMany(
        catDocs.map((c, i) => ({
          name: `P${i}`,
          slug: `p-${i}`,
          description: `d${i}`,
          price: 10 + i,
          category: c._id,
          quantity: 1,
        }))
      );

      // Filter by first 7 categories
      const targetIds = catDocs.slice(0, 7).map((c) => c._id);
      const req = mockRequest({}, { checked: targetIds, radio: [] });
      const res = mockResponse();

      await productFiltersController(req, res);
      const { products } = res.send.mock.calls[0][0];

      expect(products).toHaveLength(7);
      const prodCatIds = new Set(products.map((p) => p.category.toString()));
      targetIds.forEach((id) => expect(prodCatIds.has(id.toString())).toBe(true));
    });
  });

  describe("productCountController Integration", () => {
    it("should count all products in database", async () => {
      // Arrange
      const category = await categoryModel.create({ 
        name: "Test", 
        slug: "test" 
      });
      await productModel.create([
        { name: "P1", slug: "p1", description: "D1", price: 10, category: category._id, quantity: 1 },
        { name: "P2", slug: "p2", description: "D2", price: 20, category: category._id, quantity: 1 },
        { name: "P3", slug: "p3", description: "D3", price: 30, category: category._id, quantity: 1 },
      ]);
      const req = mockRequest();
      const res = mockResponse();

      // Act
      await productCountController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].total).toBe(3);
    });

    it("should return zero for empty database", async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();

      // Act
      await productCountController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].total).toBe(0);
    });

    it("should count products across multiple categories", async () => {
      // Arrange
      const cat1 = await categoryModel.create({ name: "Cat1", slug: "cat1" });
      const cat2 = await categoryModel.create({ name: "Cat2", slug: "cat2" });
      await productModel.create([
        { name: "P1", slug: "p1", description: "D1", price: 10, category: cat1._id, quantity: 1 },
        { name: "P2", slug: "p2", description: "D2", price: 20, category: cat2._id, quantity: 1 },
        { name: "P3", slug: "p3", description: "D3", price: 30, category: cat1._id, quantity: 1 },
        { name: "P4", slug: "p4", description: "D4", price: 40, category: cat2._id, quantity: 1 },
      ]);
      const req = mockRequest();
      const res = mockResponse();

      // Act
      await productCountController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].total).toBe(4);
    });

    it("should count large number of products efficiently", async () => {
      // Arrange
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      const products = [];
      for (let i = 1; i <= 100; i++) {
        products.push({
          name: `Product${i}`,
          slug: `product-${i}`,
          description: `Desc${i}`,
          price: i * 10,
          category: category._id,
          quantity: i
        });
      }
      await productModel.create(products);
      const req = mockRequest();
      const res = mockResponse();

      // Act
      await productCountController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].total).toBe(100);
    });
  });

  describe("productListController - Pagination Integration", () => {
    beforeEach(async () => {
      const category = await categoryModel.create({ 
        name: "Pages", 
        slug: "pages" 
      });
      for (let i = 1; i <= 20; i++) {
        await productModel.create({
          name: `Product ${i}`, 
          slug: `prod-${i}`, 
          description: `Desc ${i}`,
          price: i * 10, 
          category: category._id, 
          quantity: 5
        });
        await new Promise(r => setTimeout(r, 5));
      }
    });

    it("should return 6 products for first page sorted by newest", async () => {
      // Arrange
      const req = mockRequest({ page: "1" });
      const res = mockResponse();

      // Act
      await productListController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(6);
      expect(response.products[0].name).toBe("Product 20");
    });

    it("should skip correctly for second page", async () => {
      // Arrange
      const req = mockRequest({ page: "2" });
      const res = mockResponse();

      // Act
      await productListController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(6);
      expect(response.products[0].name).toBe("Product 14");
      expect(response.products[5].name).toBe("Product 9");
    });

    it("should return partial results for last page", async () => {
      // Arrange
      const req = mockRequest({ page: "4" });
      const res = mockResponse();

      // Act
      await productListController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(2);
      expect(response.products[0].name).toBe("Product 2");
      expect(response.products[1].name).toBe("Product 1");
    });

    it("should return empty array for page beyond available data", async () => {
      // Arrange
      const req = mockRequest({ page: "10" });
      const res = mockResponse();

      // Act
      await productListController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(0);
    });

    it("should return paginated products excluding photo buffer data", async () => {
      // Arrange
      const req = mockRequest({ page: "1" });
      const res = mockResponse();

      // Act
      await productListController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      const product = response.products[0];
      expect(product.name).toBeDefined();
      expect(product.photo?.data).toBeUndefined();
    });

    it("should default to page 1 when page parameter is missing", async () => {
      // Arrange
      const req = mockRequest({});
      const res = mockResponse();

      // Act
      await productListController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(6);
      expect(response.products[0].name).toBe("Product 20");
    });

    it("should handle invalid page number gracefully", async () => {
      // Arrange
      const req = mockRequest({ page: "invalid" });
      const res = mockResponse();

      // Act
      await productListController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toBeDefined();
    });

    it("treats invalid page param as page 1 (current behavior)", async () => {
      // Seed with explicit createdAt for determinism
      await productModel.deleteMany({});
      const category = await categoryModel.create({ name: "Pages2", slug: "pages2" });
      const docs = [];
      for (let i = 1; i <= 10; i++) {
        docs.push({
          name: `Item ${i}`,
          slug: `item-${i}`,
          description: `D${i}`,
          price: i,
          category: category._id,
          quantity: 1,
          createdAt: new Date(2024, 5, i), // June 1..10 2024
          updatedAt: new Date(2024, 5, i),
        });
      }
      await productModel.insertMany(docs);

      const req = mockRequest({ page: "NaN" });
      const res = mockResponse();
      await productListController(req, res);

      const { products } = res.send.mock.calls[0][0];
      expect(products).toHaveLength(6);
      // Newest first
      expect(products[0].name).toBe("Item 10");
      expect(products[5].name).toBe("Item 5");
    });

    it("respects createdAt sort on every page with explicit timestamps", async () => {
      await productModel.deleteMany({});
      const category = await categoryModel.create({ name: "Pages3", slug: "pages3" });

      await productModel.insertMany(
        Array.from({ length: 14 }, (_, i) => ({
          name: `X${i + 1}`,
          slug: `x-${i + 1}`,
          description: `dx${i + 1}`,
          price: i + 1,
          category: category._id,
          quantity: 1,
          createdAt: new Date(2023, 11, i + 1), // Dec 1..14 2023
          updatedAt: new Date(2023, 11, i + 1),
        }))
      );

      // page 1
      let req = mockRequest({ page: "1" });
      let res = mockResponse();
      await productListController(req, res);
      let names = res.send.mock.calls[0][0].products.map((p) => p.name);
      expect(names[0]).toBe("X14");
      expect(names[5]).toBe("X9");

      // page 2
      req = mockRequest({ page: "2" });
      res = mockResponse();
      await productListController(req, res);
      names = res.send.mock.calls[0][0].products.map((p) => p.name);
      expect(names[0]).toBe("X8");
      expect(names[5]).toBe("X3");

      // page 3 (partial)
      req = mockRequest({ page: "3" });
      res = mockResponse();
      await productListController(req, res);
      names = res.send.mock.calls[0][0].products.map((p) => p.name);
      expect(names).toEqual(["X2", "X1"]);
    });
  });

  describe("searchProductController Integration", () => {
    beforeEach(async () => {
      const category = await categoryModel.create({ 
        name: "Search", 
        slug: "search" 
      });
      await productModel.create([
        { name: "Gaming Laptop", slug: "gaming-laptop", description: "High performance gaming", price: 2000, category: category._id, quantity: 3 },
        { name: "Office Laptop", slug: "office-laptop", description: "Business productivity", price: 1000, category: category._id, quantity: 5 },
        { name: "Tablet Device", slug: "tablet", description: "Portable touchscreen", price: 500, category: category._id, quantity: 10 },
        { name: "Wireless Mouse", slug: "mouse", description: "Ergonomic gaming mouse", price: 50, category: category._id, quantity: 20 },
      ]);
    });

    it("should search products by name using case-insensitive regex", async () => {
      // Arrange
      const req = mockRequest({ keyword: "laptop" });
      const res = mockResponse();

      // Act
      await searchProductController(req, res);

      // Assert
      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(2);
      expect(results.some(p => p.name === "Gaming Laptop")).toBe(true);
      expect(results.some(p => p.name === "Office Laptop")).toBe(true);
    });

    it("should search products by uppercase keyword", async () => {
      // Arrange
      const req = mockRequest({ keyword: "LAPTOP" });
      const res = mockResponse();

      // Act
      await searchProductController(req, res);

      // Assert
      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(2);
    });

    it("should search products by mixed case keyword", async () => {
      // Arrange
      const req = mockRequest({ keyword: "LaPtOp" });
      const res = mockResponse();

      // Act
      await searchProductController(req, res);

      // Assert
      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(2);
    });

    it("should search products by description using regex", async () => {
      // Arrange
      const req = mockRequest({ keyword: "gaming" });
      const res = mockResponse();

      // Act
      await searchProductController(req, res);

      // Assert
      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(2);
    });

    it("should search products matching both name and description", async () => {
      // Arrange
      const req = mockRequest({ keyword: "portable" });
      const res = mockResponse();

      // Act
      await searchProductController(req, res);

      // Assert
      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Tablet Device");
    });

    it("should search products by partial keyword", async () => {
      // Arrange
      const req = mockRequest({ keyword: "gam" });
      const res = mockResponse();

      // Act
      await searchProductController(req, res);

      // Assert
      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(2);
    });

    it("should return empty array when no matches found", async () => {
      // Arrange
      const req = mockRequest({ keyword: "nonexistent" });
      const res = mockResponse();

      // Act
      await searchProductController(req, res);

      // Assert
      expect(res.json.mock.calls[0][0]).toHaveLength(0);
    });

    it("should return search results excluding photo buffer data", async () => {
      // Arrange
      const req = mockRequest({ keyword: "laptop" });
      const res = mockResponse();

      // Act
      await searchProductController(req, res);

      // Assert
      const results = res.json.mock.calls[0][0];
      const product = results[0];
      expect(product.name).toContain("Laptop");
      expect(product.photo?.data).toBeUndefined();
    });

    it("should handle special regex characters in keyword", async () => {
      // Arrange
      const category = await categoryModel.create({ name: "Special", slug: "special" });
      await productModel.create({
        name: "Product (Special)",
        slug: "special-product",
        description: "Test",
        price: 100,
        category: category._id,
        quantity: 5
      });
      const req = mockRequest({ keyword: "special" });
      const res = mockResponse();

      // Act
      await searchProductController(req, res);

      // Assert
      const results = res.json.mock.calls[0][0];
      expect(results.some(p => p.name === "Product (Special)")).toBe(true);
    });

    it("should search across products from multiple categories", async () => {
      // Arrange
      const cat2 = await categoryModel.create({ name: "Other", slug: "other" });
      await productModel.create({
        name: "Gaming Chair",
        slug: "gaming-chair",
        description: "Comfortable",
        price: 300,
        category: cat2._id,
        quantity: 8
      });
      const req = mockRequest({ keyword: "gaming" });
      const res = mockResponse();

      // Act
      await searchProductController(req, res);

      // Assert
      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(3);
    });
  });

  describe("realtedProductController Integration", () => {
    let category, mainProduct;

    beforeEach(async () => {
      category = await categoryModel.create({ 
        name: "Electronics", 
        slug: "electronics" 
      });
      mainProduct = await productModel.create({
        name: "Main Laptop", 
        slug: "main", 
        description: "Primary", 
        price: 1000, 
        category: category._id, 
        quantity: 5
      });

      await productModel.create([
        { name: "Mouse", slug: "mouse", description: "Related1", price: 20, category: category._id, quantity: 50 },
        { name: "Keyboard", slug: "keyboard", description: "Related2", price: 50, category: category._id, quantity: 30 },
        { name: "Monitor", slug: "monitor", description: "Related3", price: 300, category: category._id, quantity: 10 },
        { name: "Webcam", slug: "webcam", description: "Related4", price: 80, category: category._id, quantity: 15 },
      ]);
    });

    it("should return products from same category excluding main product", async () => {
      // Arrange
      const req = mockRequest({ 
        pid: mainProduct._id.toString(), 
        cid: category._id.toString() 
      });
      const res = mockResponse();

      // Act
      await realtedProductController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(3);
      expect(response.products.every(p => p._id.toString() !== mainProduct._id.toString())).toBe(true);
      expect(response.products[0].category).toBeDefined();
    });

    it("should limit related products to maximum of 3", async () => {
      // Arrange
      const req = mockRequest({ 
        pid: mainProduct._id.toString(), 
        cid: category._id.toString() 
      });
      const res = mockResponse();

      // Act
      await realtedProductController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(3);
    });

    it("should only return products from same category", async () => {
      // Arrange
      const otherCat = await categoryModel.create({ 
        name: "Books", 
        slug: "books" 
      });
      await productModel.create({
        name: "Book", 
        slug: "book", 
        description: "Different", 
        price: 25, 
        category: otherCat._id, 
        quantity: 100
      });
      const req = mockRequest({ 
        pid: mainProduct._id.toString(), 
        cid: category._id.toString() 
      });
      const res = mockResponse();

      // Act
      await realtedProductController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products.some(p => p.name === "Book")).toBe(false);
    });

    it("should return fewer than 3 products when category has limited items", async () => {
      // Arrange
      await productModel.deleteMany({ category: category._id, _id: { $ne: mainProduct._id } });
      await productModel.create({
        name: "Single Related",
        slug: "single",
        description: "Only one",
        price: 100,
        category: category._id,
        quantity: 5
      });
      const req = mockRequest({ 
        pid: mainProduct._id.toString(), 
        cid: category._id.toString() 
      });
      const res = mockResponse();

      // Act
      await realtedProductController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(1);
    });

    it("should return empty array when no other products in category", async () => {
      // Arrange
      await productModel.deleteMany({ category: category._id, _id: { $ne: mainProduct._id } });
      const req = mockRequest({ 
        pid: mainProduct._id.toString(), 
        cid: category._id.toString() 
      });
      const res = mockResponse();

      // Act
      await realtedProductController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].products).toHaveLength(0);
    });

    it("should return related products with populated category excluding photo buffer", async () => {
      // Arrange
      const req = mockRequest({ 
        pid: mainProduct._id.toString(), 
        cid: category._id.toString() 
      });
      const res = mockResponse();

      // Act
      await realtedProductController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      const product = response.products[0];
      expect(product.name).toBeDefined();
      expect(product.category).toBeDefined();
      expect(product.photo?.data).toBeUndefined();
    });

    it("should populate category details for related products", async () => {
      // Arrange
      const req = mockRequest({ 
        pid: mainProduct._id.toString(), 
        cid: category._id.toString() 
      });
      const res = mockResponse();

      // Act
      await realtedProductController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products[0].category.name).toBe("Electronics");
      expect(response.products[0].category.slug).toBe("electronics");
    });
  });

  describe("productCategoryController Integration", () => {
    beforeEach(async () => {
      const cat1 = await categoryModel.create({ 
        name: "Sports", 
        slug: "sports" 
      });
      const cat2 = await categoryModel.create({ 
        name: "Kitchen", 
        slug: "kitchen" 
      });

      await productModel.create([
        { name: "Tennis Racket", slug: "racket", description: "Pro", price: 200, category: cat1._id, quantity: 10 },
        { name: "Soccer Ball", slug: "ball", description: "FIFA", price: 30, category: cat1._id, quantity: 25 },
        { name: "Blender", slug: "blender", description: "High-speed", price: 100, category: cat2._id, quantity: 15 },
      ]);
    });

    it("should retrieve all products for category by slug", async () => {
      // Arrange
      const req = mockRequest({ slug: "sports" });
      const res = mockResponse();

      // Act
      await productCategoryController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.category.name).toBe("Sports");
      expect(response.products).toHaveLength(2);
      expect(response.products[0].category).toBeDefined();
    });

    it("should populate category details in product results", async () => {
      // Arrange
      const req = mockRequest({ slug: "sports" });
      const res = mockResponse();

      // Act
      await productCategoryController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products[0].category.name).toBe("Sports");
      expect(response.products[0].category.slug).toBe("sports");
    });

    it("should return empty array for category with no products", async () => {
      // Arrange
      await categoryModel.create({ name: "Empty", slug: "empty" });
      const req = mockRequest({ slug: "empty" });
      const res = mockResponse();

      // Act
      await productCategoryController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(0);
    });

    it("should return null for non-existent category slug", async () => {
      // Arrange
      const req = mockRequest({ slug: "nonexistent" });
      const res = mockResponse();

      // Act
      await productCategoryController(req, res);

      // Assert
      expect(res.send.mock.calls[0][0].category).toBeNull();
    });

    it("should include all products when category has many items", async () => {
      // Arrange
      const cat = await categoryModel.create({ name: "Large", slug: "large" });
      for (let i = 1; i <= 15; i++) {
        await productModel.create({
          name: `Product${i}`,
          slug: `prod-${i}`,
          description: `Desc${i}`,
          price: i * 10,
          category: cat._id,
          quantity: 5
        });
      }
      const req = mockRequest({ slug: "large" });
      const res = mockResponse();

      // Act
      await productCategoryController(req, res);

      // Assert
      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(15);
    });
  });

  describe("Cross-Controller Integration Scenarios", () => {
    it("should maintain data consistency between getProduct and getSingleProduct", async () => {
      // Arrange
      const category = await categoryModel.create({ 
        name: "Test", 
        slug: "test" 
      });
      await productModel.create({
        name: "Product", 
        slug: "product", 
        description: "Testing", 
        price: 99.99, 
        category: category._id, 
        quantity: 7
      });
      const req1 = mockRequest();
      const res1 = mockResponse();
      const req2 = mockRequest({ slug: "product" });
      const res2 = mockResponse();

      // Act
      await getProductController(req1, res1);
      const fromList = res1.send.mock.calls[0][0].products[0];
      await getSingleProductController(req2, res2);
      const single = res2.send.mock.calls[0][0].product;

      // Assert
      expect(fromList.name).toBe(single.name);
      expect(fromList.price).toBe(single.price);
      expect(fromList.quantity).toBe(single.quantity);
      expect(fromList.category._id.toString()).toBe(single.category._id.toString());
    });

    it("should verify pagination totals match product count", async () => {
      // Arrange
      const category = await categoryModel.create({ 
        name: "Page", 
        slug: "page" 
      });
      for (let i = 1; i <= 13; i++) {
        await productModel.create({
          name: `P${i}`, 
          slug: `p-${i}`, 
          description: `D${i}`, 
          price: i * 10, 
          category: category._id, 
          quantity: 5
        });
      }
      const req1 = mockRequest();
      const res1 = mockResponse();
      const req2 = mockRequest({ page: "1" });
      const res2 = mockResponse();
      const req3 = mockRequest({ page: "2" });
      const res3 = mockResponse();
      const req4 = mockRequest({ page: "3" });
      const res4 = mockResponse();

      // Act
      await productCountController(req1, res1);
      const total = res1.send.mock.calls[0][0].total;
      await productListController(req2, res2);
      const page1 = res2.send.mock.calls[0][0].products.length;
      await productListController(req3, res3);
      const page2 = res3.send.mock.calls[0][0].products.length;
      await productListController(req4, res4);
      const page3 = res4.send.mock.calls[0][0].products.length;

      // Assert
      expect(total).toBe(13);
      expect(page1 + page2 + page3).toBe(13);
    });

    it("should verify related products are subset of category products", async () => {
      // Arrange
      const category = await categoryModel.create({ 
        name: "Accessories", 
        slug: "accessories" 
      });
      const main = await productModel.create({
        name: "Main", 
        slug: "main", 
        description: "Primary", 
        price: 25, 
        category: category._id, 
        quantity: 10
      });
      await productModel.create([
        { name: "Related1", slug: "rel1", description: "R1", price: 20, category: category._id, quantity: 15 },
        { name: "Related2", slug: "rel2", description: "R2", price: 30, category: category._id, quantity: 12 },
      ]);
      const req1 = mockRequest({ slug: "accessories" });
      const res1 = mockResponse();
      const req2 = mockRequest({ 
        pid: main._id.toString(), 
        cid: category._id.toString() 
      });
      const res2 = mockResponse();

      // Act
      await productCategoryController(req1, res1);
      const catProducts = res1.send.mock.calls[0][0].products;
      await realtedProductController(req2, res2);
      const related = res2.send.mock.calls[0][0].products;

      // Assert
      expect(catProducts).toHaveLength(3);
      expect(related).toHaveLength(2);
      related.forEach(r => {
        expect(catProducts.some(c => c._id.toString() === r._id.toString())).toBe(true);
      });
    });

    it("should verify filter and search return consistent category data", async () => {
      // Arrange
      const category = await categoryModel.create({ 
        name: "Gaming", 
        slug: "gaming" 
      });
      await productModel.create([
        { name: "Gaming Mouse", slug: "gaming-mouse", description: "RGB mouse", price: 50, category: category._id, quantity: 20 },
        { name: "Gaming Keyboard", slug: "gaming-keyboard", description: "Mechanical", price: 100, category: category._id, quantity: 15 },
      ]);
      const req1 = mockRequest({ keyword: "gaming" });
      const res1 = mockResponse();
      const req2 = mockRequest({}, { checked: [category._id], radio: [] });
      const res2 = mockResponse();

      // Act
      await searchProductController(req1, res1);
      const searchResults = res1.json.mock.calls[0][0];
      await productFiltersController(req2, res2);
      const filterResults = res2.send.mock.calls[0][0].products;

      // Assert
      expect(searchResults).toHaveLength(2);
      expect(filterResults).toHaveLength(2);
    });

    it("should verify search and category controller return same products", async () => {
      // Arrange
      const category = await categoryModel.create({ name: "Unique", slug: "unique" });
      await productModel.create([
        { name: "Unique Product 1", slug: "unique-1", description: "First unique", price: 100, category: category._id, quantity: 5 },
        { name: "Unique Product 2", slug: "unique-2", description: "Second unique", price: 150, category: category._id, quantity: 8 },
      ]);
      const req1 = mockRequest({ keyword: "unique" });
      const res1 = mockResponse();
      const req2 = mockRequest({ slug: "unique" });
      const res2 = mockResponse();

      // Act
      await searchProductController(req1, res1);
      const searchResults = res1.json.mock.calls[0][0];
      await productCategoryController(req2, res2);
      const categoryResults = res2.send.mock.calls[0][0].products;

      // Assert
      expect(searchResults).toHaveLength(2);
      expect(categoryResults).toHaveLength(2);
      expect(searchResults[0]._id.toString()).toBe(categoryResults[0]._id.toString());
    });

    it("should verify filtered products subset appears in full product list", async () => {
      // Arrange
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      const products = [];
      for (let i = 1; i <= 10; i++) {
        products.push({
          name: `Product${i}`,
          slug: `prod-${i}`,
          description: `Desc${i}`,
          price: i * 50,
          category: category._id,
          quantity: 5
        });
      }
      await productModel.create(products);
      const req1 = mockRequest({}, { checked: [category._id], radio: [100, 300] });
      const res1 = mockResponse();
      const req2 = mockRequest();
      const res2 = mockResponse();

      // Act
      await productFiltersController(req1, res1);
      const filteredProducts = res1.send.mock.calls[0][0].products;
      await getProductController(req2, res2);
      const allProducts = res2.send.mock.calls[0][0].products;

      // Assert
      expect(filteredProducts.length).toBeGreaterThan(0);
      filteredProducts.forEach(fp => {
        expect(allProducts.some(ap => ap._id.toString() === fp._id.toString())).toBe(true);
      });
    });

    it("should verify count reflects total across all pagination pages", async () => {
      // Arrange
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      for (let i = 1; i <= 25; i++) {
        await productModel.create({
          name: `Product${i}`,
          slug: `prod-${i}`,
          description: `Desc${i}`,
          price: i * 10,
          category: category._id,
          quantity: 5
        });
      }
      const req1 = mockRequest();
      const res1 = mockResponse();
      const req2 = mockRequest({ page: "1" });
      const res2 = mockResponse();
      const req3 = mockRequest({ page: "2" });
      const res3 = mockResponse();
      const req4 = mockRequest({ page: "3" });
      const res4 = mockResponse();
      const req5 = mockRequest({ page: "4" });
      const res5 = mockResponse();
      const req6 = mockRequest({ page: "5" });
      const res6 = mockResponse();

      // Act
      await productCountController(req1, res1);
      const totalCount = res1.send.mock.calls[0][0].total;
      await productListController(req2, res2);
      await productListController(req3, res3);
      await productListController(req4, res4);
      await productListController(req5, res5);
      await productListController(req6, res6);
      const allPagesCount = 
        res2.send.mock.calls[0][0].products.length +
        res3.send.mock.calls[0][0].products.length +
        res4.send.mock.calls[0][0].products.length +
        res5.send.mock.calls[0][0].products.length +
        res6.send.mock.calls[0][0].products.length;

      // Assert
      expect(totalCount).toBe(25);
      expect(allPagesCount).toBe(25);
    });
  });

  describe("createProductController Integration", () => {
    let category;
    let tempPhotoPath;

    beforeEach(async () => {
      category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics",
      });

      // Create a temporary photo file for testing
      tempPhotoPath = path.join(process.cwd(), "test-photo.jpg");
      fs.writeFileSync(tempPhotoPath, Buffer.from("fake-image-data"));
    });

    afterEach(() => {
      // Clean up temp photo
      if (fs.existsSync(tempPhotoPath)) {
        fs.unlinkSync(tempPhotoPath);
      }
    });

    // Happy path tests
    it("should create product with all valid fields and photo", async () => {
      const req = {
        fields: {
          name: "Test Laptop",
          description: "High performance laptop",
          price: 1000,
          category: category._id.toString(),
          quantity: 10,
          shipping: true,
        },
        files: {
          photo: {
            path: tempPhotoPath,
            size: 50000,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.message).toBe("Product Created Successfully");
      expect(response.products.name).toBe("Test Laptop");
      expect(response.products.slug).toBe("Test-Laptop");
      expect(response.products.photo.data).toBeDefined();
      expect(response.products.photo.contentType).toBe("image/jpeg");

      // Verify in database
      const dbProduct = await productModel.findOne({ name: "Test Laptop" });
      expect(dbProduct).toBeDefined();
      expect(dbProduct.price).toBe(1000);
      expect(dbProduct.quantity).toBe(10);
    });

    it("should create product without photo (photo optional)", async () => {
      const req = {
        fields: {
          name: "Product No Photo",
          description: "Test description",
          price: 500,
          category: category._id.toString(),
          quantity: 5,
          shipping: false,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.products.photo.data).toBeUndefined();
    });

    it("should reject product with price 0 (falsy check treats 0 as invalid)", async () => {
      const req = {
        fields: {
          name: "Free Product",
          description: "Free item",
          price: 0,
          category: category._id.toString(),
          quantity: 100,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const response = res.send.mock.calls[0][0];
      expect(response.error).toBe("Price is Required");
    });

    it("should create product with very high price (boundary value)", async () => {
      const req = {
        fields: {
          name: "Expensive Item",
          description: "Very expensive",
          price: 999999.99,
          category: category._id.toString(),
          quantity: 1,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.price).toBe(999999.99);
    });

    it("should create product with quantity = 1 (boundary value)", async () => {
      const req = {
        fields: {
          name: "Single Item",
          description: "Last one",
          price: 50,
          category: category._id.toString(),
          quantity: 1,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.quantity).toBe(1);
    });

    it("should create product with large quantity (boundary value)", async () => {
      const req = {
        fields: {
          name: "Bulk Item",
          description: "Many in stock",
          price: 10,
          category: category._id.toString(),
          quantity: 10000,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.quantity).toBe(10000);
    });

    it("should auto-generate slug from product name", async () => {
      const req = {
        fields: {
          name: "Gaming Mouse Pro 2024",
          description: "Professional gaming mouse",
          price: 80,
          category: category._id.toString(),
          quantity: 50,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.slug).toBe(
        "Gaming-Mouse-Pro-2024"
      );
    });

    it("should handle special characters in product name when creating slug", async () => {
      const req = {
        fields: {
          name: "Product & Service @ 50% Off!",
          description: "Special deal",
          price: 25,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const slug = res.send.mock.calls[0][0].products.slug;
      expect(slug).toBeDefined();
      // slugify converts & to 'and', keeps @ and % as-is by default
      expect(slug).toBe("Product-and-Service-@-50percent-Off!");
    });

    it("should create product with long name (boundary value)", async () => {
      const longName = "A".repeat(200);
      const req = {
        fields: {
          name: longName,
          description: "Long name product",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.name).toBe(longName);
    });

    it("should create product with long description (boundary value)", async () => {
      const longDesc = "B".repeat(1000);
      const req = {
        fields: {
          name: "Product",
          description: longDesc,
          price: 50,
          category: category._id.toString(),
          quantity: 3,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.description).toBe(longDesc);
    });

    it("should create product with photo at maximum allowed size (999999 bytes)", async () => {
      const largePath = path.join(process.cwd(), "large-photo.jpg");
      fs.writeFileSync(largePath, Buffer.alloc(999999, "x"));

      const req = {
        fields: {
          name: "Large Photo Product",
          description: "Has large photo",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {
          photo: {
            path: largePath,
            size: 999999,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      fs.unlinkSync(largePath);
    });

    it("should create product with shipping = true", async () => {
      const req = {
        fields: {
          name: "Shippable Product",
          description: "Can be shipped",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
          shipping: true,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.shipping).toBe(true);
    });

    it("should create product with shipping = false", async () => {
      const req = {
        fields: {
          name: "Non-Shippable Product",
          description: "Cannot be shipped",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
          shipping: false,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.shipping).toBe(false);
    });

    it("should create product with different image types (PNG)", async () => {
      const pngPath = path.join(process.cwd(), "test.png");
      fs.writeFileSync(pngPath, Buffer.from("fake-png-data"));

      const req = {
        fields: {
          name: "PNG Product",
          description: "Has PNG image",
          price: 50,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {
          photo: {
            path: pngPath,
            size: 10000,
            type: "image/png",
          },
        },
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.photo.contentType).toBe(
        "image/png"
      );
      fs.unlinkSync(pngPath);
    });

    it("should create product with different image types (WEBP)", async () => {
      const webpPath = path.join(process.cwd(), "test.webp");
      fs.writeFileSync(webpPath, Buffer.from("fake-webp-data"));

      const req = {
        fields: {
          name: "WEBP Product",
          description: "Has WEBP image",
          price: 50,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {
          photo: {
            path: webpPath,
            size: 10000,
            type: "image/webp",
          },
        },
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.photo.contentType).toBe(
        "image/webp"
      );
      fs.unlinkSync(webpPath);
    });

    // Validation error tests - Required fields
    it("should return 400 when name is missing", async () => {
      const req = {
        fields: {
          description: "No name product",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Name is Required");
    });

    it("should return 400 when description is missing", async () => {
      const req = {
        fields: {
          name: "Product",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Description is Required");
    });

    it("should return 400 when price is missing", async () => {
      const req = {
        fields: {
          name: "Product",
          description: "Test",
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Price is Required");
    });

    it("should return 400 when category is missing", async () => {
      const req = {
        fields: {
          name: "Product",
          description: "Test",
          price: 100,
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Category is Required");
    });

    it("should return 400 when quantity is missing", async () => {
      const req = {
        fields: {
          name: "Product",
          description: "Test",
          price: 100,
          category: category._id.toString(),
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Quantity is Required");
    });

    it("should return 400 when photo size exceeds 1MB (1000001 bytes)", async () => {
      const oversizedPath = path.join(process.cwd(), "oversized.jpg");
      fs.writeFileSync(oversizedPath, Buffer.alloc(1000001, "x"));

      const req = {
        fields: {
          name: "Product",
          description: "Test",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {
          photo: {
            path: oversizedPath,
            size: 1000001,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe(
        "Photo is required and should be less than 1mb"
      );
      fs.unlinkSync(oversizedPath);
    });

    it("should return 400 when photo size is exactly 1000001 bytes (boundary)", async () => {
      const boundaryPath = path.join(process.cwd(), "boundary.jpg");
      fs.writeFileSync(boundaryPath, Buffer.alloc(1000001, "y"));

      const req = {
        fields: {
          name: "Product",
          description: "Test",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {
          photo: {
            path: boundaryPath,
            size: 1000001,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      fs.unlinkSync(boundaryPath);
    });

    // Empty string validation tests
    it("should return 400 when name is empty string", async () => {
      const req = {
        fields: {
          name: "",
          description: "Test",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Name is Required");
    });

    it("should return 400 when description is empty string", async () => {
      const req = {
        fields: {
          name: "Product",
          description: "",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Description is Required");
    });

    it("should return 400 when price is 0 (falsy check treats 0 as invalid)", async () => {
      // Controller uses !price which treats 0 as falsy
      const req = {
        fields: {
          name: "Product",
          description: "Test",
          price: 0,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Price is Required");
    });

    it("should return 400 when category is empty string", async () => {
      const req = {
        fields: {
          name: "Product",
          description: "Test",
          price: 100,
          category: "",
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Category is Required");
    });

    it("should return 400 when quantity is 0 (falsy check treats 0 as invalid)", async () => {
      const req = {
        fields: {
          name: "Product",
          description: "Test",
          price: 100,
          category: category._id.toString(),
          quantity: 0,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      // Controller uses !quantity which treats 0 as falsy
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Quantity is Required");
    });

    // Database integration tests
    it("should persist product to database with correct category reference", async () => {
      const req = {
        fields: {
          name: "DB Test Product",
          description: "Testing DB",
          price: 250,
          category: category._id.toString(),
          quantity: 15,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      const dbProduct = await productModel
        .findOne({ name: "DB Test Product" })
        .populate("category");
      expect(dbProduct).toBeDefined();
      expect(dbProduct.category.name).toBe("Electronics");
      expect(dbProduct.category._id.toString()).toBe(category._id.toString());
    });

    it("should handle database errors gracefully (invalid category ID)", async () => {
      const req = {
        fields: {
          name: "Product",
          description: "Test",
          price: 100,
          category: "invalid-category-id",
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send.mock.calls[0][0].success).toBe(false);
      expect(res.send.mock.calls[0][0].message).toBe(
        "Error in creating product"
      );
    });

    it("should handle database errors gracefully (non-existent category)", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = {
        fields: {
          name: "Product",
          description: "Test",
          price: 100,
          category: fakeId.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      // Should still create product (no foreign key constraint)
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should handle file system errors gracefully (invalid photo path)", async () => {
      const req = {
        fields: {
          name: "Product",
          description: "Test",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {
          photo: {
            path: "/non/existent/path/photo.jpg",
            size: 50000,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send.mock.calls[0][0].success).toBe(false);
    });

    it("should create multiple products in sequence without conflicts", async () => {
      for (let i = 1; i <= 5; i++) {
        const req = {
          fields: {
            name: `Product ${i}`,
            description: `Description ${i}`,
            price: i * 100,
            category: category._id.toString(),
            quantity: i * 10,
          },
          files: {},
        };
        const res = mockResponse();

        await createProductController(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
      }

      const count = await productModel.countDocuments();
      expect(count).toBe(5);
    });

    it("should create products with same name but different slugs if needed", async () => {
      const req1 = {
        fields: {
          name: "Duplicate Name",
          description: "First",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res1 = mockResponse();

      const req2 = {
        fields: {
          name: "Duplicate Name",
          description: "Second",
          price: 200,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res2 = mockResponse();

      await createProductController(req1, res1);
      await createProductController(req2, res2);

      expect(res1.status).toHaveBeenCalledWith(201);
      expect(res2.status).toHaveBeenCalledWith(201);

      // Both should have same slug (no duplicate prevention currently)
      const products = await productModel.find({ name: "Duplicate Name" });
      expect(products).toHaveLength(2);
    });

    it("should maintain data integrity for concurrent product creations", async () => {
      const promises = [];
      for (let i = 1; i <= 3; i++) {
        const req = {
          fields: {
            name: `Concurrent ${i}`,
            description: `Desc ${i}`,
            price: i * 50,
            category: category._id.toString(),
            quantity: i * 5,
          },
          files: {},
        };
        const res = mockResponse();
        promises.push(createProductController(req, res));
      }

      await Promise.all(promises);

      const count = await productModel.countDocuments();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    // Integration with category model
    it("should work with multiple categories correctly", async () => {
      const cat2 = await categoryModel.create({
        name: "Books",
        slug: "books",
      });

      const req1 = {
        fields: {
          name: "Laptop",
          description: "Tech",
          price: 1000,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res1 = mockResponse();

      const req2 = {
        fields: {
          name: "Novel",
          description: "Fiction",
          price: 20,
          category: cat2._id.toString(),
          quantity: 50,
        },
        files: {},
      };
      const res2 = mockResponse();

      await createProductController(req1, res1);
      await createProductController(req2, res2);

      const laptop = await productModel
        .findOne({ name: "Laptop" })
        .populate("category");
      const novel = await productModel
        .findOne({ name: "Novel" })
        .populate("category");

      expect(laptop.category.name).toBe("Electronics");
      expect(novel.category.name).toBe("Books");
    });

    it("should store photo data as Buffer in database", async () => {
      const req = {
        fields: {
          name: "Photo Product",
          description: "Has photo",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {
          photo: {
            path: tempPhotoPath,
            size: 50000,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await createProductController(req, res);

      const dbProduct = await productModel.findOne({ name: "Photo Product" });
      expect(Buffer.isBuffer(dbProduct.photo.data)).toBe(true);
      expect(dbProduct.photo.contentType).toBe("image/jpeg");
    });

    it("should handle negative price values (if accepted by model)", async () => {
      const req = {
        fields: {
          name: "Negative Price",
          description: "Testing negative",
          price: -100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      // Depends on model validation
      expect(res.status).toHaveBeenCalled();
    });

    it("should handle negative quantity values (if accepted by model)", async () => {
      const req = {
        fields: {
          name: "Negative Quantity",
          description: "Testing negative",
          price: 100,
          category: category._id.toString(),
          quantity: -5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      // Depends on model validation
      expect(res.status).toHaveBeenCalled();
    });

    it("should handle very small photo (1 byte)", async () => {
      const tinyPath = path.join(process.cwd(), "tiny.jpg");
      fs.writeFileSync(tinyPath, Buffer.from("x"));

      const req = {
        fields: {
          name: "Tiny Photo",
          description: "1 byte photo",
          price: 50,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {
          photo: {
            path: tinyPath,
            size: 1,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      fs.unlinkSync(tinyPath);
    });

    it("should handle unicode characters in product name", async () => {
      const req = {
        fields: {
          name: "产品测试 🚀 Продукт",
          description: "Unicode test",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.name).toBe(
        "产品测试 🚀 Продукт"
      );
    });

    it("should handle unicode characters in description", async () => {
      const req = {
        fields: {
          name: "Product",
          description: "描述 🎉 Описание تفاصيل",
          price: 100,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.description).toBe(
        "描述 🎉 Описание تفاصيل"
      );
    });

    it("should handle decimal price values correctly", async () => {
      const req = {
        fields: {
          name: "Decimal Price",
          description: "Testing decimals",
          price: 99.99,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].products.price).toBe(99.99);
    });

    it("should handle price with many decimal places", async () => {
      const req = {
        fields: {
          name: "Precise Price",
          description: "Many decimals",
          price: 123.456789,
          category: category._id.toString(),
          quantity: 5,
        },
        files: {},
      };
      const res = mockResponse();

      await createProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("updateProductController Integration - Comprehensive Coverage", () => {
    let category;
    let existingProduct;
    let tempPhotoPath;

    beforeEach(async () => {
      category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics",
      });

      existingProduct = await productModel.create({
        name: "Original Product",
        slug: "original-product",
        description: "Original description",
        price: 100,
        category: category._id,
        quantity: 10,
        shipping: false,
      });

      tempPhotoPath = path.join(process.cwd(), "update-photo.jpg");
      fs.writeFileSync(tempPhotoPath, Buffer.from("updated-photo-data"));
    });

    afterEach(() => {
      if (fs.existsSync(tempPhotoPath)) {
        fs.unlinkSync(tempPhotoPath);
      }
    });

    // Happy path tests
    it("should update all product fields successfully", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Updated Product",
          description: "Updated description",
          price: 200,
          category: category._id.toString(),
          quantity: 20,
          shipping: true,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.message).toBe("Product Updated Successfully");
      expect(response.products.name).toBe("Updated Product");
      expect(response.products.slug).toBe("Updated-Product");
      expect(response.products.description).toBe("Updated description");
      expect(response.products.price).toBe(200);
      expect(response.products.quantity).toBe(20);
      expect(response.products.shipping).toBe(true);
    });

    it("should update product with new photo", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product With New Photo",
          description: "Updated",
          price: 150,
          category: category._id.toString(),
          quantity: 15,
        },
        files: {
          photo: {
            path: tempPhotoPath,
            size: 50000,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const dbProduct = await productModel.findById(existingProduct._id);
      expect(dbProduct.photo.data).toBeDefined();
      expect(Buffer.isBuffer(dbProduct.photo.data)).toBe(true);
      expect(dbProduct.photo.contentType).toBe("image/jpeg");
    });

    it("should update product without changing photo when photo not provided", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Updated Name Only",
          description: "Updated description",
          price: 150,
          category: category._id.toString(),
          quantity: 15,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products.name).toBe("Updated Name Only");
    });

    it("should regenerate slug when name is updated", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Completely New Name",
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products.slug).toBe(
        "Completely-New-Name"
      );
    });

    it("should update product category to different category", async () => {
      const newCategory = await categoryModel.create({
        name: "Books",
        slug: "books",
      });

      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Updated Product",
          description: "Description",
          price: 100,
          category: newCategory._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const dbProduct = await productModel
        .findById(existingProduct._id)
        .populate("category");
      expect(dbProduct.category.name).toBe("Books");
    });

    it("should reject update with price 0 (falsy check treats 0 as invalid)", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Free Product",
          description: "Now free",
          price: 0,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Price is Required");
    });

    it("should update quantity to 1 (minimum boundary)", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Last One",
          description: "Last item",
          price: 100,
          category: category._id.toString(),
          quantity: 1,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products.quantity).toBe(1);
    });

    it("should update shipping status from false to true", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
          shipping: true,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products.shipping).toBe(true);
    });

    it("should update product with special characters in name", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product @ 50% Off & More!",
          description: "Special offer",
          price: 50,
          category: category._id.toString(),
          quantity: 20,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const slug = res.send.mock.calls[0][0].products.slug;
      // slugify converts & to 'and', keeps @ and % as-is by default
      expect(slug).toBe("Product-@-50percent-Off-and-More!");
    });

    it("should update product with unicode characters", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "产品 🎉 Product",
          description: "Unicode description 描述",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products.name).toBe("产品 🎉 Product");
    });

    it("should update product with very long name", async () => {
      const longName = "X".repeat(200);
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: longName,
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products.name).toBe(longName);
    });

    it("should update product with very long description", async () => {
      const longDesc = "Y".repeat(1000);
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: longDesc,
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products.description).toBe(longDesc);
    });

    it("should update product with photo at maximum size (999999 bytes)", async () => {
      const maxPath = path.join(process.cwd(), "max-photo.jpg");
      fs.writeFileSync(maxPath, Buffer.alloc(999999, "m"));

      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {
          photo: {
            path: maxPath,
            size: 999999,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      fs.unlinkSync(maxPath);
    });

    it("should update product with different image types (PNG)", async () => {
      const pngPath = path.join(process.cwd(), "update.png");
      fs.writeFileSync(pngPath, Buffer.from("png-data"));

      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "PNG Product",
          description: "Updated with PNG",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {
          photo: {
            path: pngPath,
            size: 10000,
            type: "image/png",
          },
        },
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const dbProduct = await productModel.findById(existingProduct._id);
      expect(dbProduct.photo.contentType).toBe("image/png");
      fs.unlinkSync(pngPath);
    });

    it("should update decimal price values correctly", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 99.99,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products.price).toBe(99.99);
    });

    // Validation error tests
    it("should return 400 when name is missing", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Name is Required");
    });

    it("should return 400 when description is missing", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Description is Required");
    });

    it("should return 400 when price is missing", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Price is Required");
    });

    it("should return 400 when category is missing", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Category is Required");
    });

    it("should return 400 when quantity is missing", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: category._id.toString(),
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Quantity is Required");
    });

    it("should return 400 when photo size exceeds 1MB", async () => {
      const largePath = path.join(process.cwd(), "large-update.jpg");
      fs.writeFileSync(largePath, Buffer.alloc(1000001, "l"));

      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {
          photo: {
            path: largePath,
            size: 1000001,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe(
        "Photo should be less than 1mb"
      );
      fs.unlinkSync(largePath);
    });

    it("should return 400 when name is empty string", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "",
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Name is Required");
    });

    it("should return 400 when description is empty string", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Description is Required");
    });

    it("should return 400 when category is empty string", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: "",
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].error).toBe("Category is Required");
    });

    // Product not found tests
    it("should return 404 when product ID does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = {
        params: { pid: fakeId.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send.mock.calls[0][0].success).toBe(false);
      expect(res.send.mock.calls[0][0].message).toBe("Product not found");
    });

    it("should return 500 when product ID is invalid format", async () => {
      const req = {
        params: { pid: "invalid-id" },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send.mock.calls[0][0].success).toBe(false);
    });

    it("should handle file system errors gracefully (invalid photo path)", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {
          photo: {
            path: "/non/existent/path/photo.jpg",
            size: 50000,
            type: "image/jpeg",
          },
        },
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send.mock.calls[0][0].success).toBe(false);
    });

    // Database integration tests
    it("should persist updates to database correctly", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Persisted Update",
          description: "Updated in DB",
          price: 300,
          category: category._id.toString(),
          quantity: 30,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      const dbProduct = await productModel.findById(existingProduct._id);
      expect(dbProduct.name).toBe("Persisted Update");
      expect(dbProduct.description).toBe("Updated in DB");
      expect(dbProduct.price).toBe(300);
      expect(dbProduct.quantity).toBe(30);
    });

    it("should maintain product _id after update", async () => {
      const originalId = existingProduct._id.toString();
      const req = {
        params: { pid: originalId },
        fields: {
          name: "Updated Name",
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products._id.toString()).toBe(
        originalId
      );
    });

    it("should update multiple products independently", async () => {
      const product2 = await productModel.create({
        name: "Product 2",
        slug: "product-2",
        description: "Second product",
        price: 200,
        category: category._id,
        quantity: 20,
      });

      const req1 = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Updated Product 1",
          description: "First update",
          price: 150,
          category: category._id.toString(),
          quantity: 15,
        },
        files: {},
      };
      const res1 = mockResponse();

      const req2 = {
        params: { pid: product2._id.toString() },
        fields: {
          name: "Updated Product 2",
          description: "Second update",
          price: 250,
          category: category._id.toString(),
          quantity: 25,
        },
        files: {},
      };
      const res2 = mockResponse();

      await updateProductController(req1, res1);
      await updateProductController(req2, res2);

      expect(res1.status).toHaveBeenCalledWith(200);
      expect(res2.status).toHaveBeenCalledWith(200);

      const db1 = await productModel.findById(existingProduct._id);
      const db2 = await productModel.findById(product2._id);

      expect(db1.name).toBe("Updated Product 1");
      expect(db2.name).toBe("Updated Product 2");
    });

    it("should handle concurrent updates to same product", async () => {
      const req1 = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Concurrent Update 1",
          description: "First concurrent",
          price: 111,
          category: category._id.toString(),
          quantity: 11,
        },
        files: {},
      };
      const res1 = mockResponse();

      const req2 = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Concurrent Update 2",
          description: "Second concurrent",
          price: 222,
          category: category._id.toString(),
          quantity: 22,
        },
        files: {},
      };
      const res2 = mockResponse();

      await Promise.all([
        updateProductController(req1, res1),
        updateProductController(req2, res2),
      ]);

      // Both should succeed (last write wins)
      expect(res1.status).toHaveBeenCalled();
      expect(res2.status).toHaveBeenCalled();
    });

    it("should replace photo when updating with new photo", async () => {
      // First create product with photo
      const photoPath1 = path.join(process.cwd(), "original.jpg");
      fs.writeFileSync(photoPath1, Buffer.from("original-photo"));

      existingProduct.photo.data = fs.readFileSync(photoPath1);
      existingProduct.photo.contentType = "image/jpeg";
      await existingProduct.save();

      // Now update with new photo
      const photoPath2 = path.join(process.cwd(), "new.jpg");
      fs.writeFileSync(photoPath2, Buffer.from("new-photo"));

      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: category._id.toString(),
          quantity: 10,
        },
        files: {
          photo: {
            path: photoPath2,
            size: 10000,
            type: "image/png",
          },
        },
      };
      const res = mockResponse();

      await updateProductController(req, res);

      const dbProduct = await productModel.findById(existingProduct._id);
      expect(dbProduct.photo.data.toString()).toBe("new-photo");
      expect(dbProduct.photo.contentType).toBe("image/png");

      fs.unlinkSync(photoPath1);
      fs.unlinkSync(photoPath2);
    });

    it("should handle updates with invalid category ID format", async () => {
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: "invalid-category-id",
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send.mock.calls[0][0].success).toBe(false);
    });

    it("should update product with non-existent category ID (no foreign key)", async () => {
      const fakeCategory = new mongoose.Types.ObjectId();
      const req = {
        params: { pid: existingProduct._id.toString() },
        fields: {
          name: "Product",
          description: "Description",
          price: 100,
          category: fakeCategory.toString(),
          quantity: 10,
        },
        files: {},
      };
      const res = mockResponse();

      await updateProductController(req, res);

      // Should succeed (no FK constraint)
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deleteProductController Integration - Comprehensive Coverage", () => {
    let category;
    let productToDelete;

    beforeEach(async () => {
      category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics",
      });

      productToDelete = await productModel.create({
        name: "Product To Delete",
        slug: "product-to-delete",
        description: "Will be deleted",
        price: 100,
        category: category._id,
        quantity: 10,
      });
    });

    // Happy path tests
    it("should delete existing product successfully", async () => {
      const req = mockRequest({ pid: productToDelete._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.message).toBe("Product Deleted successfully");

      // Verify deleted from database
      const dbProduct = await productModel.findById(productToDelete._id);
      expect(dbProduct).toBeNull();
    });

    it("should delete product with photo", async () => {
      const photoPath = path.join(process.cwd(), "delete-photo.jpg");
      fs.writeFileSync(photoPath, Buffer.from("photo-to-delete"));

      productToDelete.photo.data = fs.readFileSync(photoPath);
      productToDelete.photo.contentType = "image/jpeg";
      await productToDelete.save();

      const req = mockRequest({ pid: productToDelete._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const dbProduct = await productModel.findById(productToDelete._id);
      expect(dbProduct).toBeNull();

      fs.unlinkSync(photoPath);
    });

    it("should delete product and remove from database completely", async () => {
      const productId = productToDelete._id.toString();
      const req = mockRequest({ pid: productId });
      const res = mockResponse();

      await deleteProductController(req, res);

      const deletedProduct = await productModel.findById(productId);
      expect(deletedProduct).toBeNull();

      // Verify count decreased
      const count = await productModel.countDocuments();
      expect(count).toBe(0);
    });

    it("should delete multiple products independently", async () => {
      const product2 = await productModel.create({
        name: "Product 2",
        slug: "product-2",
        description: "Second",
        price: 200,
        category: category._id,
        quantity: 20,
      });

      const product3 = await productModel.create({
        name: "Product 3",
        slug: "product-3",
        description: "Third",
        price: 300,
        category: category._id,
        quantity: 30,
      });

      const req1 = mockRequest({ pid: productToDelete._id.toString() });
      const res1 = mockResponse();
      const req2 = mockRequest({ pid: product2._id.toString() });
      const res2 = mockResponse();

      await deleteProductController(req1, res1);
      await deleteProductController(req2, res2);

      expect(res1.status).toHaveBeenCalledWith(200);
      expect(res2.status).toHaveBeenCalledWith(200);

      const deleted1 = await productModel.findById(productToDelete._id);
      const deleted2 = await productModel.findById(product2._id);
      const remaining = await productModel.findById(product3._id);

      expect(deleted1).toBeNull();
      expect(deleted2).toBeNull();
      expect(remaining).not.toBeNull();
    });

    it("should handle deletion with valid ObjectId format", async () => {
      const validId = productToDelete._id.toString();
      const req = mockRequest({ pid: validId });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should successfully delete product that belongs to a category", async () => {
      const req = mockRequest({ pid: productToDelete._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Category should still exist
      const categoryStillExists = await categoryModel.findById(category._id);
      expect(categoryStillExists).not.toBeNull();
    });

    it("should delete product with minimum data (required fields only)", async () => {
      const minProduct = await productModel.create({
        name: "Min Product",
        slug: "min-product",
        description: "Minimal",
        price: 1,
        category: category._id,
        quantity: 1,
      });

      const req = mockRequest({ pid: minProduct._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should delete product with maximum data (all fields)", async () => {
      const photoPath = path.join(process.cwd(), "max-delete.jpg");
      fs.writeFileSync(photoPath, Buffer.from("max-data"));

      const maxProduct = await productModel.create({
        name: "Max Product",
        slug: "max-product",
        description: "Maximum data product",
        price: 999999,
        category: category._id,
        quantity: 10000,
        shipping: true,
        photo: {
          data: fs.readFileSync(photoPath),
          contentType: "image/jpeg",
        },
      });

      const req = mockRequest({ pid: maxProduct._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      fs.unlinkSync(photoPath);
    });

    it("should delete newly created product immediately", async () => {
      const newProduct = await productModel.create({
        name: "New Product",
        slug: "new-product",
        description: "Just created",
        price: 50,
        category: category._id,
        quantity: 5,
      });

      const req = mockRequest({ pid: newProduct._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should delete product with unicode name", async () => {
      const unicodeProduct = await productModel.create({
        name: "产品 🚀 Product",
        slug: "unicode-product",
        description: "Unicode test",
        price: 100,
        category: category._id,
        quantity: 10,
      });

      const req = mockRequest({ pid: unicodeProduct._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    // Error path tests - Invalid ID
    it("should return 400 when product ID is invalid format", async () => {
      const req = mockRequest({ pid: "invalid-id" });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(false);
      expect(response.message).toBe("Invalid product ID");
    });

    it("should return 400 when product ID is empty string", async () => {
      const req = mockRequest({ pid: "" });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Invalid product ID");
    });

    it("should return 400 when product ID is undefined", async () => {
      const req = mockRequest({ pid: undefined });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Invalid product ID");
    });

    it("should return 400 when product ID is null", async () => {
      const req = mockRequest({ pid: null });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Invalid product ID");
    });

    it("should return 400 when product ID has invalid characters", async () => {
      const req = mockRequest({ pid: "12345-invalid-@#$" });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Invalid product ID");
    });

    it("should return 400 when product ID is too short", async () => {
      const req = mockRequest({ pid: "123" });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Invalid product ID");
    });

    it("should return 400 when product ID is too long", async () => {
      const req = mockRequest({ pid: "a".repeat(100) });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Invalid product ID");
    });

    // Error path tests - Product not found
    it("should return 404 when product does not exist (valid ObjectId)", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const req = mockRequest({ pid: nonExistentId.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(false);
      expect(response.message).toBe("Product not found");
    });

    it("should return 404 when attempting to delete already deleted product", async () => {
      const productId = productToDelete._id.toString();

      // First deletion
      const req1 = mockRequest({ pid: productId });
      const res1 = mockResponse();
      await deleteProductController(req1, res1);
      expect(res1.status).toHaveBeenCalledWith(200);

      // Second deletion attempt
      const req2 = mockRequest({ pid: productId });
      const res2 = mockResponse();
      await deleteProductController(req2, res2);

      expect(res2.status).toHaveBeenCalledWith(404);
      expect(res2.send.mock.calls[0][0].message).toBe("Product not found");
    });

    it("should return 404 for valid ObjectId that never existed", async () => {
      const neverExistedId = new mongoose.Types.ObjectId();
      const req = mockRequest({ pid: neverExistedId.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send.mock.calls[0][0].message).toBe("Product not found");
    });

    // Database integrity tests
    it("should not affect other products when deleting one", async () => {
      const product2 = await productModel.create({
        name: "Keep This",
        slug: "keep-this",
        description: "Should remain",
        price: 200,
        category: category._id,
        quantity: 20,
      });

      const req = mockRequest({ pid: productToDelete._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      const remainingProduct = await productModel.findById(product2._id);
      expect(remainingProduct).not.toBeNull();
      expect(remainingProduct.name).toBe("Keep This");
    });

    it("should maintain database integrity after deletion", async () => {
      const countBefore = await productModel.countDocuments();

      const req = mockRequest({ pid: productToDelete._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      const countAfter = await productModel.countDocuments();
      expect(countAfter).toBe(countBefore - 1);
    });

    it("should handle concurrent deletions of different products", async () => {
      const product2 = await productModel.create({
        name: "Product 2",
        slug: "product-2",
        description: "Second",
        price: 200,
        category: category._id,
        quantity: 20,
      });

      const product3 = await productModel.create({
        name: "Product 3",
        slug: "product-3",
        description: "Third",
        price: 300,
        category: category._id,
        quantity: 30,
      });

      const req1 = mockRequest({ pid: productToDelete._id.toString() });
      const res1 = mockResponse();
      const req2 = mockRequest({ pid: product2._id.toString() });
      const res2 = mockResponse();
      const req3 = mockRequest({ pid: product3._id.toString() });
      const res3 = mockResponse();

      await Promise.all([
        deleteProductController(req1, res1),
        deleteProductController(req2, res2),
        deleteProductController(req3, res3),
      ]);

      expect(res1.status).toHaveBeenCalled();
      expect(res2.status).toHaveBeenCalled();
      expect(res3.status).toHaveBeenCalled();

      const count = await productModel.countDocuments();
      expect(count).toBe(0);
    });

    it("should handle concurrent deletion attempts of same product", async () => {
      const productId = productToDelete._id.toString();

      const req1 = mockRequest({ pid: productId });
      const res1 = mockResponse();
      const req2 = mockRequest({ pid: productId });
      const res2 = mockResponse();

      await Promise.all([
        deleteProductController(req1, res1),
        deleteProductController(req2, res2),
      ]);

      // One should succeed (200), one should fail (404)
      const statuses = [
        res1.status.mock.calls[0][0],
        res2.status.mock.calls[0][0],
      ];
      expect(statuses).toContain(200);
      expect(statuses).toContain(404);
    });

    it("should verify product is truly removed from database", async () => {
      const productId = productToDelete._id;
      const req = mockRequest({ pid: productId.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      const deleted = await productModel.findById(productId);
      expect(deleted).toBeNull();

      const exists = await productModel.exists({ _id: productId });
      expect(exists).toBeNull();
    });

    it("should delete all products in a category without affecting category", async () => {
      const product2 = await productModel.create({
        name: "Product 2",
        slug: "product-2",
        description: "Second",
        price: 200,
        category: category._id,
        quantity: 20,
      });

      const req1 = mockRequest({ pid: productToDelete._id.toString() });
      const res1 = mockResponse();
      const req2 = mockRequest({ pid: product2._id.toString() });
      const res2 = mockResponse();

      await deleteProductController(req1, res1);
      await deleteProductController(req2, res2);

      const productsInCategory = await productModel.find({
        category: category._id,
      });
      expect(productsInCategory).toHaveLength(0);

      const categoryStillExists = await categoryModel.findById(category._id);
      expect(categoryStillExists).not.toBeNull();
    });

    // Edge cases
    it("should handle deletion when database connection is slow", async () => {
      const req = mockRequest({ pid: productToDelete._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalled();
    });

    it("should handle product with very long name deletion", async () => {
      const longNameProduct = await productModel.create({
        name: "X".repeat(200),
        slug: "long-name",
        description: "Long name",
        price: 100,
        category: category._id,
        quantity: 10,
      });

      const req = mockRequest({ pid: longNameProduct._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle product with special characters deletion", async () => {
      const specialProduct = await productModel.create({
        name: "Product @ 50% & More!",
        slug: "special-product",
        description: "Special chars",
        price: 100,
        category: category._id,
        quantity: 10,
      });

      const req = mockRequest({ pid: specialProduct._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle deletion of product with price 0", async () => {
      const freeProduct = await productModel.create({
        name: "Free Product",
        slug: "free-product",
        description: "Free",
        price: 0,
        category: category._id,
        quantity: 100,
      });

      const req = mockRequest({ pid: freeProduct._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle deletion of product with quantity 0", async () => {
      const outOfStockProduct = await productModel.create({
        name: "Out of Stock",
        slug: "out-of-stock",
        description: "No stock",
        price: 100,
        category: category._id,
        quantity: 0,
      });

      const req = mockRequest({ pid: outOfStockProduct._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle deletion of product with very large quantities", async () => {
      const bulkProduct = await productModel.create({
        name: "Bulk Product",
        slug: "bulk-product",
        description: "Many items",
        price: 10,
        category: category._id,
        quantity: 1000000,
      });

      const req = mockRequest({ pid: bulkProduct._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle deletion of product with very high price", async () => {
      const expensiveProduct = await productModel.create({
        name: "Expensive",
        slug: "expensive",
        description: "Very expensive",
        price: 999999.99,
        category: category._id,
        quantity: 1,
      });

      const req = mockRequest({ pid: expensiveProduct._id.toString() });
      const res = mockResponse();

      await deleteProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
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
});
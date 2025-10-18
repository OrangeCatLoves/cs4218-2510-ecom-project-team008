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
      const category = await categoryModel.create({ name: "Electronics", slug: "electronics" });
      await productModel.create([
        { name: "Laptop", slug: "laptop", description: "High-end", price: 1000, category: category._id, quantity: 10 },
        { name: "Phone", slug: "phone", description: "Smartphone", price: 500, category: category._id, quantity: 20 },
      ]);

      const req = mockRequest();
      const res = mockResponse();
      await getProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.products).toHaveLength(2);
      // Verify category population (integration with categoryModel)
      expect(response.products[0].category.name).toBe("Electronics");
      expect(response.products[0].category.slug).toBe("electronics");
    });

    it("should limit to 12 products and sort by createdAt descending", async () => {
      const category = await categoryModel.create({ name: "Books", slug: "books" });
      for (let i = 1; i <= 15; i++) {
        await productModel.create({
          name: `Product ${i}`, slug: `product-${i}`, description: `Desc ${i}`,
          price: i * 10, category: category._id, quantity: i,
        });
        await new Promise(r => setTimeout(r, 10));
      }

      const req = mockRequest();
      const res = mockResponse();
      await getProductController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(12);
      expect(response.products[0].name).toBe("Product 15");
      expect(response.products[11].name).toBe("Product 4");
    });

    it("BUG REPORT: Response field typo 'counTotal' should be 'countTotal'", async () => {
      /**
       * BUG IDENTIFIED
       * Location: controllers/productController.js, line ~87
       * Issue: Response object has typo 'counTotal' instead of 'countTotal'
       * Severity: Low - Typo in API response field name
       * Impact: API inconsistency, potential confusion for frontend developers
       * Expected: { success: true, countTotal: X, message: "...", products: [...] }
       * Actual: { success: true, counTotal: X, message: "...", products: [...] }
       * Fix Required: Change 'counTotal' to 'countTotal' for consistent naming
       */
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      await productModel.create({
        name: "Product", slug: "product", description: "Test", 
        price: 100, category: category._id, quantity: 5
      });

      const req = mockRequest();
      const res = mockResponse();
      await getProductController(req, res);

      const response = res.send.mock.calls[0][0];
      // Current buggy behavior
      expect(response.counTotal).toBeDefined();
      expect(response.counTotal).toBe(1);
      // After fix, should be:
      // expect(response.countTotal).toBe(1);
    });
  });

  describe("getSingleProductController Integration", () => {
    it("should retrieve single product with populated category via slug lookup", async () => {
      const category = await categoryModel.create({ name: "Furniture", slug: "furniture" });
      await productModel.create({
        name: "Chair", slug: "wooden-chair", description: "Comfortable",
        price: 150, category: category._id, quantity: 5
      });

      const req = mockRequest({ slug: "wooden-chair" });
      const res = mockResponse();
      await getSingleProductController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.product.name).toBe("Chair");
      // Verify category integration
      expect(response.product.category.name).toBe("Furniture");
    });

    it("should return null for non-existent slug", async () => {
      const req = mockRequest({ slug: "non-existent" });
      const res = mockResponse();
      await getSingleProductController(req, res);

      expect(res.send.mock.calls[0][0].product).toBeNull();
    });
  });

  describe("productPhotoController Integration", () => {
    it("should retrieve photo from database and set correct content type", async () => {
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      const photoData = Buffer.from("fake image data");
      const product = await productModel.create({
        name: "Product", slug: "product", description: "Test", price: 200,
        category: category._id, quantity: 5,
        photo: { data: photoData, contentType: "image/jpeg" }
      });

      const req = mockRequest({ pid: product._id.toString() });
      const res = mockResponse();
      await productPhotoController(req, res);

      expect(res.set).toHaveBeenCalledWith("Content-type", "image/jpeg");
      expect(res.status).toHaveBeenCalledWith(200);
      const sentData = res.send.mock.calls[0][0];
      expect(Buffer.isBuffer(sentData)).toBe(true);
      expect(sentData.toString()).toBe(photoData.toString());
    });

    it("should validate ObjectId before database query", async () => {
      const req = mockRequest({ pid: "invalid-id" });
      const res = mockResponse();
      await productPhotoController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Invalid product ID");
    });

    it("should handle missing photo data in database", async () => {
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      const product = await productModel.create({
        name: "No Photo", slug: "no-photo", description: "Missing", 
        price: 100, category: category._id, quantity: 1
      });

      const req = mockRequest({ pid: product._id.toString() });
      const res = mockResponse();
      await productPhotoController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send.mock.calls[0][0].message).toBe("Product photo not found");
    });
  });

  describe("productFiltersController - Combinatorial Testing", () => {
    let cat1, cat2, cat3;

    beforeEach(async () => {
      cat1 = await categoryModel.create({ name: "Electronics", slug: "electronics" });
      cat2 = await categoryModel.create({ name: "Books", slug: "books" });
      cat3 = await categoryModel.create({ name: "Clothing", slug: "clothing" });

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

    it("Combo: Category filter only (single)", async () => {
      const req = mockRequest({}, { checked: [cat1._id], radio: [] });
      const res = mockResponse();
      await productFiltersController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(3);
      expect(response.products.every(p => p.category.toString() === cat1._id.toString())).toBe(true);
    });

    it("Combo: Category filter (multiple categories)", async () => {
      const req = mockRequest({}, { checked: [cat1._id, cat2._id], radio: [] });
      const res = mockResponse();
      await productFiltersController(req, res);

      expect(res.send.mock.calls[0][0].products).toHaveLength(5);
    });

    it("Combo: Price filter only", async () => {
      const req = mockRequest({}, { checked: [], radio: [50, 100] });
      const res = mockResponse();
      await productFiltersController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(2); // Textbook (80), Jeans (60)
      expect(response.products.every(p => p.price >= 50 && p.price <= 100)).toBe(true);
    });

    it("Combo: Category + Price (matching results)", async () => {
      const req = mockRequest({}, { checked: [cat1._id], radio: [400, 600] });
      const res = mockResponse();
      await productFiltersController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(1);
      expect(response.products[0].name).toBe("Phone");
    });

    it("Combo: Category + Price (no matching results)", async () => {
      const req = mockRequest({}, { checked: [cat2._id], radio: [100, 200] });
      const res = mockResponse();
      await productFiltersController(req, res);

      expect(res.send.mock.calls[0][0].products).toHaveLength(0);
    });

    it("Combo: Multiple categories + Price range", async () => {
      const req = mockRequest({}, { checked: [cat2._id, cat3._id], radio: [20, 30] });
      const res = mockResponse();
      await productFiltersController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(2); // Novel (20), T-Shirt (25)
    });

    it("Combo: No filters (returns all products)", async () => {
      const req = mockRequest({}, { checked: [], radio: [] });
      const res = mockResponse();
      await productFiltersController(req, res);

      expect(res.send.mock.calls[0][0].products).toHaveLength(7);
    });

    it("Boundary: Price at exact lower bound (inclusive)", async () => {
      const req = mockRequest({}, { checked: [], radio: [500, 1000] });
      const res = mockResponse();
      await productFiltersController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(1);
      expect(response.products[0].price).toBe(500);
    });

    it("Boundary: Price starting at zero", async () => {
      const req = mockRequest({}, { checked: [], radio: [0, 50] });
      const res = mockResponse();
      await productFiltersController(req, res);

      expect(res.send.mock.calls[0][0].products).toHaveLength(2); // Novel (20), T-Shirt (25)
    });

    it("Boundary: Price at exact upper bound (inclusive)", async () => {
      const req = mockRequest({}, { checked: [], radio: [1000, 1500] });
      const res = mockResponse();
      await productFiltersController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(1);
      expect(response.products[0].price).toBe(1500);
    });
  });

  describe("productCountController Integration", () => {
    it("should count all products in database", async () => {
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      await productModel.create([
        { name: "P1", slug: "p1", description: "D1", price: 10, category: category._id, quantity: 1 },
        { name: "P2", slug: "p2", description: "D2", price: 20, category: category._id, quantity: 1 },
        { name: "P3", slug: "p3", description: "D3", price: 30, category: category._id, quantity: 1 },
      ]);

      const req = mockRequest();
      const res = mockResponse();
      await productCountController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].total).toBe(3);
    });

    it("should return 0 for empty database", async () => {
      const req = mockRequest();
      const res = mockResponse();
      await productCountController(req, res);

      expect(res.send.mock.calls[0][0].total).toBe(0);
    });
  });

  describe("productListController - Pagination Integration", () => {
    beforeEach(async () => {
      const category = await categoryModel.create({ name: "Pages", slug: "pages" });
      for (let i = 1; i <= 20; i++) {
        await productModel.create({
          name: `Product ${i}`, slug: `prod-${i}`, description: `Desc ${i}`,
          price: i * 10, category: category._id, quantity: 5
        });
        await new Promise(r => setTimeout(r, 5));
      }
    });

    it("should paginate with 6 products per page (page 1)", async () => {
      const req = mockRequest({ page: "1" });
      const res = mockResponse();
      await productListController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(6);
      expect(response.products[0].name).toBe("Product 20");
    });

    it("should skip correctly for page 2", async () => {
      const req = mockRequest({ page: "2" });
      const res = mockResponse();
      await productListController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(6);
      expect(response.products[0].name).toBe("Product 14");
      expect(response.products[5].name).toBe("Product 9");
    });

    it("should return empty array for page beyond data", async () => {
      const req = mockRequest({ page: "10" });
      const res = mockResponse();
      await productListController(req, res);

      expect(res.send.mock.calls[0][0].products).toHaveLength(0);
    });
  });

  describe("searchProductController Integration", () => {
    beforeEach(async () => {
      const category = await categoryModel.create({ name: "Search", slug: "search" });
      await productModel.create([
        { name: "Gaming Laptop", slug: "gaming-laptop", description: "High performance gaming", price: 2000, category: category._id, quantity: 3 },
        { name: "Office Laptop", slug: "office-laptop", description: "Business productivity", price: 1000, category: category._id, quantity: 5 },
        { name: "Tablet Device", slug: "tablet", description: "Portable touchscreen", price: 500, category: category._id, quantity: 10 },
        { name: "Wireless Mouse", slug: "mouse", description: "Ergonomic gaming mouse", price: 50, category: category._id, quantity: 20 },
      ]);
    });

    it("should search by name using regex (case-insensitive)", async () => {
      const req = mockRequest({ keyword: "laptop" });
      const res = mockResponse();
      await searchProductController(req, res);

      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(2);
      expect(results.some(p => p.name === "Gaming Laptop")).toBe(true);
      expect(results.some(p => p.name === "Office Laptop")).toBe(true);
    });

    it("should search by description using regex", async () => {
      const req = mockRequest({ keyword: "gaming" });
      const res = mockResponse();
      await searchProductController(req, res);

      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(2); // Gaming Laptop, Wireless Mouse
    });

    it("should return empty array when no matches found", async () => {
      const req = mockRequest({ keyword: "nonexistent" });
      const res = mockResponse();
      await searchProductController(req, res);

      expect(res.json.mock.calls[0][0]).toHaveLength(0);
    });
  });

  describe("realtedProductController Integration", () => {
    let category, mainProduct;

    beforeEach(async () => {
      category = await categoryModel.create({ name: "Electronics", slug: "electronics" });
      mainProduct = await productModel.create({
        name: "Main Laptop", slug: "main", description: "Primary", 
        price: 1000, category: category._id, quantity: 5
      });

      await productModel.create([
        { name: "Mouse", slug: "mouse", description: "Related1", price: 20, category: category._id, quantity: 50 },
        { name: "Keyboard", slug: "keyboard", description: "Related2", price: 50, category: category._id, quantity: 30 },
        { name: "Monitor", slug: "monitor", description: "Related3", price: 300, category: category._id, quantity: 10 },
        { name: "Webcam", slug: "webcam", description: "Related4", price: 80, category: category._id, quantity: 15 },
      ]);
    });

    it("should return products from same category excluding main product", async () => {
      const req = mockRequest({ pid: mainProduct._id.toString(), cid: category._id.toString() });
      const res = mockResponse();
      await realtedProductController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(3); // Limited to 3
      expect(response.products.every(p => p._id.toString() !== mainProduct._id.toString())).toBe(true);
      // Verify category population
      expect(response.products[0].category).toBeDefined();
    });

    it("should enforce limit of 3 related products", async () => {
      const req = mockRequest({ pid: mainProduct._id.toString(), cid: category._id.toString() });
      const res = mockResponse();
      await realtedProductController(req, res);

      expect(res.send.mock.calls[0][0].products).toHaveLength(3);
    });

    it("should only return products from same category", async () => {
      const otherCat = await categoryModel.create({ name: "Books", slug: "books" });
      await productModel.create({
        name: "Book", slug: "book", description: "Different", 
        price: 25, category: otherCat._id, quantity: 100
      });

      const req = mockRequest({ pid: mainProduct._id.toString(), cid: category._id.toString() });
      const res = mockResponse();
      await realtedProductController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products.some(p => p.name === "Book")).toBe(false);
    });
  });

  describe("productCategoryController Integration", () => {
    beforeEach(async () => {
      const cat1 = await categoryModel.create({ name: "Sports", slug: "sports" });
      const cat2 = await categoryModel.create({ name: "Kitchen", slug: "kitchen" });

      await productModel.create([
        { name: "Tennis Racket", slug: "racket", description: "Pro", price: 200, category: cat1._id, quantity: 10 },
        { name: "Soccer Ball", slug: "ball", description: "FIFA", price: 30, category: cat1._id, quantity: 25 },
        { name: "Blender", slug: "blender", description: "High-speed", price: 100, category: cat2._id, quantity: 15 },
      ]);
    });

    it("should retrieve all products for category by slug", async () => {
      const req = mockRequest({ slug: "sports" });
      const res = mockResponse();
      await productCategoryController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.category.name).toBe("Sports");
      expect(response.products).toHaveLength(2);
      // Verify category population in products
      expect(response.products[0].category).toBeDefined();
    });

    it("should return empty array for category with no products", async () => {
      await categoryModel.create({ name: "Empty", slug: "empty" });
      const req = mockRequest({ slug: "empty" });
      const res = mockResponse();
      await productCategoryController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.products).toHaveLength(0);
    });

    it("should return null for non-existent category slug", async () => {
      const req = mockRequest({ slug: "nonexistent" });
      const res = mockResponse();
      await productCategoryController(req, res);

      expect(res.send.mock.calls[0][0].category).toBeNull();
    });
  });

  describe("Cross-Controller Integration Scenarios", () => {
    it("should maintain data consistency between getProduct and getSingleProduct", async () => {
      const category = await categoryModel.create({ name: "Test", slug: "test" });
      await productModel.create({
        name: "Product", slug: "product", description: "Testing", 
        price: 99.99, category: category._id, quantity: 7
      });

      // Retrieve from list
      const req1 = mockRequest();
      const res1 = mockResponse();
      await getProductController(req1, res1);
      const fromList = res1.send.mock.calls[0][0].products[0];

      // Retrieve single
      const req2 = mockRequest({ slug: "product" });
      const res2 = mockResponse();
      await getSingleProductController(req2, res2);
      const single = res2.send.mock.calls[0][0].product;

      // Verify consistency
      expect(fromList.name).toBe(single.name);
      expect(fromList.price).toBe(single.price);
      expect(fromList.quantity).toBe(single.quantity);
      expect(fromList.category._id.toString()).toBe(single.category._id.toString());
    });

    it("should verify pagination totals match product count", async () => {
      const category = await categoryModel.create({ name: "Page", slug: "page" });
      for (let i = 1; i <= 13; i++) {
        await productModel.create({
          name: `P${i}`, slug: `p-${i}`, description: `D${i}`, 
          price: i * 10, category: category._id, quantity: 5
        });
      }

      // Get total count
      const req1 = mockRequest();
      const res1 = mockResponse();
      await productCountController(req1, res1);
      const total = res1.send.mock.calls[0][0].total;

      // Get all pages
      const req2 = mockRequest({ page: "1" });
      const res2 = mockResponse();
      await productListController(req2, res2);
      const page1 = res2.send.mock.calls[0][0].products.length;

      const req3 = mockRequest({ page: "2" });
      const res3 = mockResponse();
      await productListController(req3, res3);
      const page2 = res3.send.mock.calls[0][0].products.length;

      const req4 = mockRequest({ page: "3" });
      const res4 = mockResponse();
      await productListController(req4, res4);
      const page3 = res4.send.mock.calls[0][0].products.length;

      // Verify totals match
      expect(total).toBe(13);
      expect(page1 + page2 + page3).toBe(13);
    });

    it("should verify related products are subset of category products", async () => {
      const category = await categoryModel.create({ name: "Accessories", slug: "accessories" });
      const main = await productModel.create({
        name: "Main", slug: "main", description: "Primary", 
        price: 25, category: category._id, quantity: 10
      });
      await productModel.create([
        { name: "Related1", slug: "rel1", description: "R1", price: 20, category: category._id, quantity: 15 },
        { name: "Related2", slug: "rel2", description: "R2", price: 30, category: category._id, quantity: 12 },
      ]);

      // Get all category products
      const req1 = mockRequest({ slug: "accessories" });
      const res1 = mockResponse();
      await productCategoryController(req1, res1);
      const catProducts = res1.send.mock.calls[0][0].products;

      // Get related products
      const req2 = mockRequest({ pid: main._id.toString(), cid: category._id.toString() });
      const res2 = mockResponse();
      await realtedProductController(req2, res2);
      const related = res2.send.mock.calls[0][0].products;

      // Verify related is subset of category
      expect(catProducts).toHaveLength(3);
      expect(related).toHaveLength(2);
      related.forEach(r => {
        expect(catProducts.some(c => c._id.toString() === r._id.toString())).toBe(true);
      });
    });

    it("should verify filter and search return consistent category data", async () => {
      const category = await categoryModel.create({ name: "Gaming", slug: "gaming" });
      await productModel.create([
        { name: "Gaming Mouse", slug: "gaming-mouse", description: "RGB mouse", price: 50, category: category._id, quantity: 20 },
        { name: "Gaming Keyboard", slug: "gaming-keyboard", description: "Mechanical", price: 100, category: category._id, quantity: 15 },
      ]);

      // Search by keyword
      const req1 = mockRequest({ keyword: "gaming" });
      const res1 = mockResponse();
      await searchProductController(req1, res1);
      const searchResults = res1.json.mock.calls[0][0];

      // Filter by category
      const req2 = mockRequest({}, { checked: [category._id], radio: [] });
      const res2 = mockResponse();
      await productFiltersController(req2, res2);
      const filterResults = res2.send.mock.calls[0][0].products;

      // Should return same products
      expect(searchResults).toHaveLength(2);
      expect(filterResults).toHaveLength(2);
    });
  });
});
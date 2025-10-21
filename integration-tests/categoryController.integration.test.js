import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import jwt from "jsonwebtoken";

// Mock db config to prevent real DB connection
jest.mock("../config/db", () => jest.fn());

import app from "../app.js";
import categoryModel from "../models/categoryModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js"; // used for delete guard spy

describe("Category Controller Integration Tests", () => {
  let mongodbServer;

  // Set up in-memory database once for all tests
  beforeAll(async () => {
    mongodbServer = await MongoMemoryServer.create();
    const uri = mongodbServer.getUri();
    await mongoose.connect(uri);
    // Ensure indexes (if any) are ready before uniqueness-sensitive tests
    await categoryModel.init();
  }, 60000);

  // Clean up database after all tests
  afterAll(async () => {
    await mongoose.disconnect();
    await mongodbServer.stop();
  }, 60000);

  // Clean up collections before each test
  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany();
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create admin user and get JWT token
  const createAdminUser = async () => {
    const admin = await userModel.create({
      name: "Test Admin",
      email: "admin@test.com",
      password: "admin123",
      phone: "1234567890",
      address: "Test Address",
      answer: "test",
      role: 1, // admin role
    });

    const token = jwt.sign(
      { _id: admin._id },
      process.env.JWT_SECRET || "mockKey",
      { expiresIn: "7d" }
    );

    return { admin, token };
  };

  // Helper to create regular user and get JWT token
  const createRegularUser = async () => {
    const user = await userModel.create({
      name: "Test User",
      email: "user@test.com",
      password: "user123",
      phone: "0987654321",
      address: "User Address",
      answer: "test",
      role: 0, // regular user
    });

    const token = jwt.sign(
      { _id: user._id },
      process.env.JWT_SECRET || "mockKey",
      { expiresIn: "7d" }
    );

    return { user, token };
  };

  // Placeholder test to verify setup
  test("should have test environment ready", () => {
    expect(app).toBeDefined();
    expect(mongoose.connection.readyState).toBe(1); // connected
  });

  describe("GET /api/v1/category/get-category - categoryControlller", () => {
    test("should retrieve all categories from database via HTTP", async () => {
      // Arrange - create test categories
      await categoryModel.create([
        { name: "Electronics", slug: "electronics" },
        { name: "Books", slug: "books" },
        { name: "Clothing", slug: "clothing" },
      ]);

      // Act - make HTTP request
      const res = await request(app).get("/api/v1/category/get-category");

      // Assert - verify response
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.category).toHaveLength(3);
      expect(res.body.category[0].name).toBeDefined();
      expect(res.body.category[0].slug).toBeDefined();
      expect(res.body.category[0]._id).toBeDefined();
    });

    test("should return empty array when no categories exist", async () => {
      // Act
      const res = await request(app).get("/api/v1/category/get-category");

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.category).toHaveLength(0);
    });

    test("should return categories with correctly formatted slugs", async () => {
      // Arrange
      await categoryModel.create([
        { name: "Home & Garden", slug: "home-garden" },
        { name: "Sports & Outdoors", slug: "sports-outdoors" },
      ]);

      // Act
      const res = await request(app).get("/api/v1/category/get-category");

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.category).toHaveLength(2);
      const slugs = res.body.category.map((c) => c.slug);
      expect(slugs).toContain("home-garden");
      expect(slugs).toContain("sports-outdoors");
    });

    test("should handle large number of categories", async () => {
      // Arrange - create 50 categories
      const categories = [];
      for (let i = 1; i <= 50; i++) {
        categories.push({ name: `Category ${i}`, slug: `category-${i}` });
      }
      await categoryModel.create(categories);

      // Act
      const res = await request(app).get("/api/v1/category/get-category");

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.category).toHaveLength(50);
    });
  });

  describe("GET /api/v1/category/single-category/:slug - singleCategoryController", () => {
    test("should retrieve single category by slug via HTTP", async () => {
      // Arrange
      await categoryModel.create({
        name: "Gaming Laptops",
        slug: "gaming-laptops",
      });

      // Act
      const res = await request(app).get(
        "/api/v1/category/single-category/gaming-laptops"
      );

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.category.name).toBe("Gaming Laptops");
      expect(res.body.category.slug).toBe("gaming-laptops");
    });

    test("should return 404 when category slug does not exist", async () => {
      // Act
      const res = await request(app).get(
        "/api/v1/category/single-category/non-existent"
      );

      // Assert
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Category not found");
    });

    test("should perform case-insensitive slug matching", async () => {
      // Arrange
      await categoryModel.create({
        name: "Electronics",
        slug: "electronics",
      });

      // Act - try uppercase slug
      const res = await request(app).get(
        "/api/v1/category/single-category/Electronics"
      );

      // Assert - should find it (MongoDB slug field has lowercase: true)
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.category.name).toBe("Electronics");
      expect(res.body.category.slug).toBe("electronics");
    });

    test("should retrieve category with special characters in slug", async () => {
      // Arrange
      await categoryModel.create({
        name: "Home & Garden",
        slug: "home-garden",
      });

      // Act
      const res = await request(app).get(
        "/api/v1/category/single-category/home-garden"
      );

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.category.name).toBe("Home & Garden");
    });
  });

  describe("POST /api/v1/category/create-category - createCategoryController", () => {
    test("should create new category with valid admin token", async () => {
      // Arrange
      const { token } = await createAdminUser();

      // Act
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", token)
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("New category created");
      expect(res.body.category.name).toBe("Electronics");
      expect(res.body.category.slug).toBe("electronics");

      // Verify in database
      const dbCategory = await categoryModel.findOne({ slug: "electronics" });
      expect(dbCategory).toBeDefined();
      expect(dbCategory.name).toBe("Electronics");
    });

    test("should reject category creation without authorization token", async () => {
      // Act - no Authorization header
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test("should reject category creation with non-admin token", async () => {
      // Arrange
      const { token } = await createRegularUser();

      // Act
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", token)
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test("should return 409 when category name already exists", async () => {
      // Arrange
      const { token } = await createAdminUser();
      await categoryModel.create({ name: "Electronics", slug: "electronics" });

      // Act - try to create duplicate
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", token)
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Category already exists");
    });

    test("should handle case-insensitive duplicate detection", async () => {
      // Arrange
      const { token } = await createAdminUser();
      await categoryModel.create({ name: "Electronics", slug: "electronics" });

      // Act - try lowercase version
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", token)
        .send({ name: "electronics" });

      // Assert
      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe("Category already exists");
    });

    test("should reject empty category name", async () => {
      // Arrange
      const { token } = await createAdminUser();

      // Act
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", token)
        .send({ name: "" });

      // Assert
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Name is required");
    });

    test("should reject whitespace-only category name", async () => {
      // Arrange
      const { token } = await createAdminUser();

      // Act
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", token)
        .send({ name: "   " });

      // Assert
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Name is required");
    });

    test("should automatically generate slug from category name", async () => {
      // Arrange
      const { token } = await createAdminUser();

      // Act
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", token)
        .send({ name: "Home & Garden" });

      // Assert
      expect(res.statusCode).toBe(201);
      expect(res.body.category.slug).toBe("home-and-garden");
    });
  });

  describe("PUT /api/v1/category/update-category/:id - updateCategoryController", () => {
    test("should update category name with valid admin token", async () => {
      // Arrange
      const { token } = await createAdminUser();
      const category = await categoryModel.create({
        name: "Old Name",
        slug: "old-name",
      });

      // Act
      const res = await request(app)
        .put(`/api/v1/category/update-category/${category._id}`)
        .set("Authorization", token)
        .send({ name: "New Name" });

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Category updated successfully");
      expect(res.body.category.name).toBe("New Name");
      expect(res.body.category.slug).toBe("new-name");

      // Verify in database
      const dbCategory = await categoryModel.findById(category._id);
      expect(dbCategory.name).toBe("New Name");
      expect(dbCategory.slug).toBe("new-name");
    });

    test("should reject update without authorization token", async () => {
      // Arrange
      const category = await categoryModel.create({
        name: "Test",
        slug: "test",
      });

      // Act
      const res = await request(app)
        .put(`/api/v1/category/update-category/${category._id}`)
        .send({ name: "Updated" });

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test("should reject update with non-admin token", async () => {
      // Arrange
      const { token } = await createRegularUser();
      const category = await categoryModel.create({
        name: "Test",
        slug: "test",
      });

      // Act
      const res = await request(app)
        .put(`/api/v1/category/update-category/${category._id}`)
        .set("Authorization", token)
        .send({ name: "Updated" });

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test("should return 404 when updating non-existent category", async () => {
      // Arrange
      const { token } = await createAdminUser();
      const fakeId = new mongoose.Types.ObjectId();

      // Act
      const res = await request(app)
        .put(`/api/v1/category/update-category/${fakeId}`)
        .set("Authorization", token)
        .send({ name: "Updated" });

      // Assert
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Category not found");
    });

    test("should prevent duplicate names when updating", async () => {
      // Arrange
      const { token } = await createAdminUser();
      await categoryModel.create({ name: "Electronics", slug: "electronics" });
      const gaming = await categoryModel.create({
        name: "Gaming",
        slug: "gaming",
      });

      // Act - try to update Gaming to Electronics
      const res = await request(app)
        .put(`/api/v1/category/update-category/${gaming._id}`)
        .set("Authorization", token)
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe("Category already exists");
    });

    test("should allow updating category to same name (self-update)", async () => {
      // Arrange
      const { token } = await createAdminUser();
      const category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics",
      });

      // Act - update to same name
      const res = await request(app)
        .put(`/api/v1/category/update-category/${category._id}`)
        .set("Authorization", token)
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("DELETE /api/v1/category/delete-category/:id - deleteCategoryController", () => {
    test("should delete category with valid admin token", async () => {
      // Arrange
      const { token } = await createAdminUser();
      const category = await categoryModel.create({
        name: "To Delete",
        slug: "to-delete",
      });

      // Act
      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${category._id}`)
        .set("Authorization", token);

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Category deleted successfully");

      // Verify removed from database
      const dbCategory = await categoryModel.findById(category._id);
      expect(dbCategory).toBeNull();
    });

    test("should reject delete without authorization token", async () => {
      // Arrange
      const category = await categoryModel.create({
        name: "Test",
        slug: "test",
      });

      // Act
      const res = await request(app).delete(
        `/api/v1/category/delete-category/${category._id}`
      );

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test("should reject delete with non-admin token", async () => {
      // Arrange
      const { token } = await createRegularUser();
      const category = await categoryModel.create({
        name: "Test",
        slug: "test",
      });

      // Act
      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${category._id}`)
        .set("Authorization", token);

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test("should return 404 when deleting non-existent category", async () => {
      // Arrange
      const { token } = await createAdminUser();
      const fakeId = new mongoose.Types.ObjectId();

      // Act
      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${fakeId}`)
        .set("Authorization", token);

      // Assert
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Category not found");
    });

    // delete guard when products still reference category
    test("should block deletion when products reference the category (countDocuments > 0)", async () => {
      const { token } = await createAdminUser();
      const category = await categoryModel.create({
        name: "Guarded",
        slug: "guarded",
      });

      const spy = jest
        .spyOn(productModel, "countDocuments")
        .mockResolvedValueOnce(3); // simulate products using this category

      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${category._id}`)
        .set("Authorization", token);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cannot delete category/i);

      spy.mockRestore();
      const stillThere = await categoryModel.findById(category._id);
      expect(stillThere).not.toBeNull();
    });
  });

  describe("Auth token edge cases (HTTP)", () => {
    test("should reject category creation with an invalid/forged JWT token", async () => {
      // Arrange: a forged token with wrong secret
      const admin = await userModel.create({
        name: "Tmp Admin",
        email: "tmp@x.com",
        password: "x",
        phone: "1",
        address: "a",
        answer: "a",
        role: 1,
      });
      const badToken = jwt.sign({ _id: admin._id }, "WRONG_SECRET", {
        expiresIn: "7d",
      });

      // Act
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", badToken)
        .send({ name: "Forged" });

      // Assert
      expect(res.statusCode).toBe(401);
    });
  });

  describe("HTTP: DB error propagation and invalid ObjectIds", () => {
    test("GET /api/v1/category/get-category should return 500 when DB is down", async () => {
      await mongoose.connection.close();
      const res = await request(app).get("/api/v1/category/get-category");
      expect([500, 503]).toContain(res.statusCode);
      await mongoose.connect(mongodbServer.getUri());
      await categoryModel.init();
    });

    test("PUT /api/v1/category/update-category/:id returns error for invalid ObjectId", async () => {
      const { token } = await createAdminUser();
      const res = await request(app)
        .put("/api/v1/category/update-category/not-a-valid-objectid")
        .set("Authorization", token)
        .send({ name: "Anything" });
      expect([400, 500]).toContain(res.statusCode);
    });

    test("DELETE /api/v1/category/delete-category/:id returns error for invalid ObjectId", async () => {
      const { token } = await createAdminUser();
      const res = await request(app)
        .delete("/api/v1/category/delete-category/not-a-valid-objectid")
        .set("Authorization", token);
      expect([400, 500]).toContain(res.statusCode);
    });
  });

  describe("HTTP: concurrent duplicate creation & create→read single", () => {
    test("should reject concurrent duplicate creations (only one category persists)", async () => {
      const { token } = await createAdminUser();

      const r1 = request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", token)
        .send({ name: "Concurrent Cat" });

      const r2 = request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", token)
        .send({ name: "Concurrent Cat" }); // exact duplicate (same casing)

      const [res1, res2] = await Promise.all([r1, r2]);

      const codes = [res1.statusCode, res2.statusCode];

      expect(codes).toEqual(expect.arrayContaining([201]));
      expect(codes.some((c) => c === 409 || c === 500)).toBe(true);

      const count = await categoryModel.countDocuments({
        slug: "concurrent-cat",
      });
      expect(count).toBe(1);
    });

    test("creating a category makes it immediately retrievable by /single-category/:slug", async () => {
      const { token } = await createAdminUser();

      const createRes = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", token)
        .send({ name: "Home & Garden" });

      expect(createRes.statusCode).toBe(201);
      const slug = createRes.body.category.slug; // "home-and-garden"

      const readRes = await request(app).get(
        `/api/v1/category/single-category/${slug}`
      );
      expect(readRes.statusCode).toBe(200);
      expect(readRes.body.category.slug).toBe(slug);
    });
  });
});

/**
 * Integration Test: Category Controller ↔ Category Model ↔ MongoDB
 * Test Scope: Backend integration (Controller-Model-Database)
 */

import mongoose2 from "mongoose";
import { MongoMemoryServer as MongoMemoryServer2 } from "mongodb-memory-server";
import categoryModel2 from "../models/categoryModel.js";
import {
  createCategoryController,
  updateCategoryController,
  categoryControlller,
  singleCategoryController,
  deleteCategoryController,
} from "../controllers/categoryController.js";

let mongoServer;

const mockRequest = (params = {}, body = {}) => ({ params, body });

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

describe("Integration: Category Controller ↔ Model ↔ Database", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer2.create();
    await mongoose2.connect(mongoServer.getUri());
    // Ensure indexes are ready
    await categoryModel2.init();
  }, 60000);

  afterAll(async () => {
    if (mongoose2.connection.readyState !== 0) {
      await mongoose2.disconnect();
    }
    await mongoServer.stop();
  }, 60000);

  afterEach(async () => {
    if (mongoose2.connection.readyState !== 0) {
      const collections = mongoose2.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany();
      }
    }
  });

  describe("Create Category Integration", () => {
    it("should create category with slugified name in database", async () => {
      const req = mockRequest({}, { name: "Consumer Electronics" });
      const res = mockResponse();

      await createCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.category.name).toBe("Consumer Electronics");
      expect(response.category.slug).toBe("consumer-electronics");

      // Verify in database
      const dbCategory = await categoryModel2.findOne({
        slug: "consumer-electronics",
      });
      expect(dbCategory).toBeTruthy();
      expect(dbCategory.name).toBe("Consumer Electronics");
    });

    it("should trim whitespace during category creation", async () => {
      const req = mockRequest({}, { name: "   Books   " });
      const res = mockResponse();

      await createCategoryController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.category.name).toBe("Books");
      expect(response.category.slug).toBe("books");

      const dbCategory = await categoryModel2.findOne({ slug: "books" });
      expect(dbCategory.name).toBe("Books");
    });

    it("should reject empty category name", async () => {
      const req = mockRequest({}, { name: "" });
      const res = mockResponse();

      await createCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0]).toEqual({
        success: false,
        message: "Name is required",
      });

      // Verify not in database
      const count = await categoryModel2.countDocuments();
      expect(count).toBe(0);
    });

    it("should reject whitespace-only category name", async () => {
      const req = mockRequest({}, { name: "   " });
      const res = mockResponse();

      await createCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Name is required");
    });

    it("should prevent duplicate categories (case-insensitive)", async () => {
      // Create first category
      await categoryModel2.create({ name: "Electronics", slug: "electronics" });

      // Attempt duplicate with different case
      const req = mockRequest({}, { name: "ELECTRONICS" });
      const res = mockResponse();

      await createCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send.mock.calls[0][0]).toEqual({
        success: false,
        message: "Category already exists",
      });

      // Verify only one category in DB
      const count = await categoryModel2.countDocuments();
      expect(count).toBe(1);
    });

    it("should allow categories with similar but different names", async () => {
      await categoryModel2.create({ name: "Books", slug: "books" });

      const req = mockRequest({}, { name: "eBooks" });
      const res = mockResponse();

      await createCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send.mock.calls[0][0].success).toBe(true);

      const count = await categoryModel2.countDocuments();
      expect(count).toBe(2);
    });

    it("should handle special characters in category names", async () => {
      const req = mockRequest({}, { name: "Arts & Crafts" });
      const res = mockResponse();

      await createCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.send.mock.calls[0][0];
      expect(response.category.name).toBe("Arts & Crafts");
      expect(response.category.slug).toBe("arts-and-crafts");
    });

    it("should handle database errors gracefully", async () => {
      // Force a database error by closing connection
      await mongoose2.connection.close();

      const req = mockRequest({}, { name: "Test Category" });
      const res = mockResponse();
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await createCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send.mock.calls[0][0].success).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      // Reconnect for other tests
      await mongoose2.connect(mongoServer.getUri());
      await categoryModel2.init();
    });
  });

  describe("Update Category Integration", () => {
    it("should update category name and regenerate slug", async () => {
      const category = await categoryModel2.create({
        name: "Tech",
        slug: "tech",
      });

      const req = mockRequest(
        { id: category._id.toString() },
        { name: "Technology" }
      );
      const res = mockResponse();

      await updateCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.category.name).toBe("Technology");
      expect(response.category.slug).toBe("technology");

      // Verify in database
      const updated = await categoryModel2.findById(category._id);
      expect(updated.name).toBe("Technology");
      expect(updated.slug).toBe("technology");
    });

    it("should trim whitespace during update", async () => {
      const category = await categoryModel2.create({
        name: "Books",
        slug: "books",
      });

      const req = mockRequest(
        { id: category._id.toString() },
        { name: "  Literature  " }
      );
      const res = mockResponse();

      await updateCategoryController(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.category.name).toBe("Literature");
      expect(response.category.slug).toBe("literature");
    });

    it("should reject empty name during update", async () => {
      const category = await categoryModel2.create({
        name: "Sports",
        slug: "sports",
      });

      const req = mockRequest({ id: category._id.toString() }, { name: "" });
      const res = mockResponse();

      await updateCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send.mock.calls[0][0].message).toBe("Name is required");

      // Verify category unchanged
      const unchanged = await categoryModel2.findById(category._id);
      expect(unchanged.name).toBe("Sports");
    });

    it("should prevent updating to duplicate name (excluding self)", async () => {
      const cat1 = await categoryModel2.create({
        name: "Electronics",
        slug: "electronics",
      });
      const cat2 = await categoryModel2.create({
        name: "Books",
        slug: "books",
      });

      // Try to update cat2 to Electronics
      const req = mockRequest(
        { id: cat2._id.toString() },
        { name: "Electronics" }
      );
      const res = mockResponse();

      await updateCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send.mock.calls[0][0].message).toBe("Category already exists");

      // Verify cat2 unchanged
      const unchanged = await categoryModel2.findById(cat2._id);
      expect(unchanged.name).toBe("Books");
    });

    it("should allow updating category to same name (self-update)", async () => {
      const category = await categoryModel2.create({
        name: "Fashion",
        slug: "fashion",
      });

      const req = mockRequest(
        { id: category._id.toString() },
        { name: "Fashion" }
      );
      const res = mockResponse();

      await updateCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].success).toBe(true);
    });

    it("should handle non-existent category ID", async () => {
      const fakeId = new mongoose2.Types.ObjectId();
      const req = mockRequest({ id: fakeId.toString() }, { name: "New Name" });
      const res = mockResponse();

      await updateCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send.mock.calls[0][0]).toEqual({
        success: false,
        message: "Category not found",
      });
    });

    it("should handle invalid ObjectId format", async () => {
      const req = mockRequest({ id: "invalid-id" }, { name: "New Name" });
      const res = mockResponse();

      await updateCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send.mock.calls[0][0].success).toBe(false);
    });
  });

  describe("Get All Categories Integration", () => {
    it("should retrieve all categories from database", async () => {
      await categoryModel2.create([
        { name: "Electronics", slug: "electronics" },
        { name: "Books", slug: "books" },
        { name: "Clothing", slug: "clothing" },
      ]);

      const req = mockRequest();
      const res = mockResponse();

      await categoryControlller(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.category).toHaveLength(3);
      expect(response.category.map((c) => c.name)).toEqual(
        expect.arrayContaining(["Electronics", "Books", "Clothing"])
      );
    });

    it("should return empty array when no categories exist", async () => {
      const req = mockRequest();
      const res = mockResponse();

      await categoryControlller(req, res);

      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.category).toHaveLength(0);
    });

    it("should handle database errors during fetch", async () => {
      await mongoose2.connection.close();

      const req = mockRequest();
      const res = mockResponse();
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await categoryControlller(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send.mock.calls[0][0].message).toBe(
        "Error while getting all categories"
      );

      consoleSpy.mockRestore();
      await mongoose2.connect(mongoServer.getUri());
      await categoryModel2.init();
    });
  });

  describe("Get Single Category Integration", () => {
    it("should retrieve category by slug from database", async () => {
      await categoryModel2.create({ name: "Gaming", slug: "gaming" });

      const req = mockRequest({ slug: "gaming" });
      const res = mockResponse();

      await singleCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.send.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.category.name).toBe("Gaming");
      expect(response.category.slug).toBe("gaming");
    });

    it("should return 404 for non-existent slug", async () => {
      const req = mockRequest({ slug: "non-existent" });
      const res = mockResponse();

      await singleCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send.mock.calls[0][0]).toEqual({
        success: false,
        message: "Category not found",
      });
    });

    it("should handle special characters in slug lookup", async () => {
      await categoryModel2.create({
        name: "Arts & Crafts",
        slug: "arts-crafts",
      });

      const req = mockRequest({ slug: "arts-crafts" });
      const res = mockResponse();

      await singleCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].category.name).toBe("Arts & Crafts");
    });
  });

  describe("Delete Category Integration", () => {
    it("should delete category from database", async () => {
      const category = await categoryModel2.create({
        name: "Outdated",
        slug: "outdated",
      });

      const req = mockRequest({ id: category._id.toString() });
      const res = mockResponse();

      await deleteCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0]).toEqual({
        success: true,
        message: "Category deleted successfully",
      });

      // Verify deleted from database
      const deleted = await categoryModel2.findById(category._id);
      expect(deleted).toBeNull();
    });

    it("should return 404 when deleting non-existent category", async () => {
      const fakeId = new mongoose2.Types.ObjectId();
      const req = mockRequest({ id: fakeId.toString() });
      const res = mockResponse();

      await deleteCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send.mock.calls[0][0]).toEqual({
        success: false,
        message: "Category not found",
      });
    });

    it("should handle invalid ObjectId during deletion", async () => {
      const req = mockRequest({ id: "invalid-id" });
      const res = mockResponse();

      await deleteCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send.mock.calls[0][0].success).toBe(false);
    });
  });

  describe("Cross-Operation Integration Scenarios", () => {
    it("should maintain data consistency across create, read, update, delete", async () => {
      // Create
      const createReq = mockRequest({}, { name: "Test Category" });
      const createRes = mockResponse();
      await createCategoryController(createReq, createRes);
      const created = createRes.send.mock.calls[0][0].category;

      // Read Single
      const readReq = mockRequest({ slug: "test-category" });
      const readRes = mockResponse();
      await singleCategoryController(readReq, readRes);
      const read = readRes.send.mock.calls[0][0].category;
      expect(read._id.toString()).toBe(created._id.toString());

      // Update
      const updateReq = mockRequest(
        { id: created._id.toString() },
        { name: "Updated Category" }
      );
      const updateRes = mockResponse();
      await updateCategoryController(updateReq, updateRes);

      // Read All
      const allReq = mockRequest();
      const allRes = mockResponse();
      await categoryControlller(allReq, allRes);
      const all = allRes.send.mock.calls[0][0].category;
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe("Updated Category");

      // Delete
      const deleteReq = mockRequest({ id: created._id.toString() });
      const deleteRes = mockResponse();
      await deleteCategoryController(deleteReq, deleteRes);

      // Verify deletion
      const finalReq = mockRequest();
      const finalRes = mockResponse();
      await categoryControlller(finalReq, finalRes);
      expect(finalRes.send.mock.calls[0][0].category).toHaveLength(0);
    });

    it("should handle concurrent duplicate checks correctly", async () => {
      // Create initial category
      await categoryModel2.create({ name: "Popular", slug: "popular" });

      // Attempt two simultaneous duplicate creations
      const req1 = mockRequest({}, { name: "Popular" });
      const res1 = mockResponse();
      const req2 = mockRequest({}, { name: "popular" });
      const res2 = mockResponse();

      await Promise.all([
        createCategoryController(req1, res1),
        createCategoryController(req2, res2),
      ]);

      // Both should be rejected
      expect(res1.status).toHaveBeenCalledWith(409);
      expect(res2.status).toHaveBeenCalledWith(409);

      // Only one category in DB
      const count = await categoryModel2.countDocuments();
      expect(count).toBe(1);
    });

    it("should verify slug uniqueness across operations", async () => {
      // Create category
      const createReq = mockRequest({}, { name: "Home & Garden" });
      const createRes = mockResponse();
      await createCategoryController(createReq, createRes);
      const created = createRes.send.mock.calls[0][0].category;

      // Attempt to create with same slug-generating name
      const dupeReq = mockRequest({}, { name: "HOME & GARDEN" });
      const dupeRes = mockResponse();
      await createCategoryController(dupeReq, dupeRes);

      expect(dupeRes.status).toHaveBeenCalledWith(409);

      // Update to different name
      const updateReq = mockRequest(
        { id: created._id.toString() },
        { name: "Home Improvement" }
      );
      const updateRes = mockResponse();
      await updateCategoryController(updateReq, updateRes);

      // Now should be able to create with old name
      const newReq = mockRequest({}, { name: "Home & Garden" });
      const newRes = mockResponse();
      await createCategoryController(newReq, newRes);

      expect(newRes.status).toHaveBeenCalledWith(201);

      const count = await categoryModel2.countDocuments();
      expect(count).toBe(2);
    });

    it("should maintain referential integrity after deletions", async () => {
      // Create multiple categories
      await categoryModel2.create([
        { name: "Cat1", slug: "cat1" },
        { name: "Cat2", slug: "cat2" },
        { name: "Cat3", slug: "cat3" },
      ]);

      // Get all
      const allReq = mockRequest();
      const allRes = mockResponse();
      await categoryControlller(allReq, allRes);
      const categories = allRes.send.mock.calls[0][0].category;

      // Delete middle category
      const deleteReq = mockRequest({ id: categories[1]._id.toString() });
      const deleteRes = mockResponse();
      await deleteCategoryController(deleteReq, deleteRes);

      // Verify correct categories remain
      const finalReq = mockRequest();
      const finalRes = mockResponse();
      await categoryControlller(finalReq, finalRes);
      const remaining = finalRes.send.mock.calls[0][0].category;

      expect(remaining).toHaveLength(2);
      expect(remaining.find((c) => c.slug === "cat2")).toBeUndefined();
      expect(remaining.find((c) => c.slug === "cat1")).toBeDefined();
      expect(remaining.find((c) => c.slug === "cat3")).toBeDefined();
    });
  });

  describe("Controller DB outage paths", () => {
    it("updateCategoryController should return 500 when DB is down", async () => {
      const c = await categoryModel2.create({ name: "Tmp", slug: "tmp" });
      await mongoose2.connection.close();

      const req = { params: { id: c._id.toString() }, body: { name: "New" } };
      const res = { status: jest.fn(() => res), send: jest.fn(() => res) };

      await updateCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalled();

      await mongoose2.connect(mongoServer.getUri());
      await categoryModel2.init();
    });

    it("deleteCategoryController should return 500 when DB is down", async () => {
      const c = await categoryModel2.create({ name: "Tmp2", slug: "tmp2" });
      await mongoose2.connection.close();

      const req = { params: { id: c._id.toString() } };
      const res = { status: jest.fn(() => res), send: jest.fn(() => res) };

      await deleteCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      await mongoose2.connect(mongoServer.getUri());
      await categoryModel2.init();
    });
  });

  describe("Controller: create/update slug collision behavior (defensive)", () => {
    it("createCategoryController should block creation when slug already exists (case-insensitive)", async () => {
      await categoryModel2.create({
        name: "Sports & Outdoors",
        slug: "sports-outdoors",
      });

      const req = { params: {}, body: { name: "SPORTS & OUTDOORS" } };
      const res = { status: jest.fn(() => res), send: jest.fn(() => res) };

      await createCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send.mock.calls[0][0].message).toMatch(/already exists/i);
    });

    it("updateCategoryController should allow changing to a new non-conflicting slug", async () => {
      const c = await categoryModel2.create({
        name: "Home Improvement",
        slug: "home-improvement",
      });

      const req = {
        params: { id: c._id.toString() },
        body: { name: "DIY" },
      };
      const res = { status: jest.fn(() => res), send: jest.fn(() => res) };

      await updateCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.send.mock.calls[0][0];
      expect(payload.category.slug).toBe("diy");
    });
  });
});

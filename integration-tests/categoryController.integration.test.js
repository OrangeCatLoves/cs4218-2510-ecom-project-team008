import mongoose from 'mongoose';
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import jwt from "jsonwebtoken";

// Mock db config to prevent real DB connection
jest.mock('../config/db', () => jest.fn());

import app from "../app.js";
import categoryModel from "../models/categoryModel.js";
import userModel from "../models/userModel.js";

describe('Category Controller Integration Tests', () => {
  let mongodbServer;

  // Set up in-memory database once for all tests
  beforeAll(async () => {
    mongodbServer = await MongoMemoryServer.create();
    const uri = mongodbServer.getUri();
    await mongoose.connect(uri);
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
      process.env.JWT_SECRET || 'mockKey',
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
      process.env.JWT_SECRET || 'mockKey',
      { expiresIn: "7d" }
    );

    return { user, token };
  };

  // Placeholder test to verify setup
  test('should have test environment ready', () => {
    expect(app).toBeDefined();
    expect(mongoose.connection.readyState).toBe(1); // connected
  });

  describe('GET /api/v1/category/get-category - categoryControlller', () => {
    test('should retrieve all categories from database via HTTP', async () => {
      // Arrange - create test categories
      await categoryModel.create([
        { name: "Electronics", slug: "electronics" },
        { name: "Books", slug: "books" },
        { name: "Clothing", slug: "clothing" },
      ]);

      // Act - make HTTP request
      const res = await request(app)
        .get('/api/v1/category/get-category');

      // Assert - verify response
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.category).toHaveLength(3);
      expect(res.body.category[0].name).toBeDefined();
      expect(res.body.category[0].slug).toBeDefined();
      expect(res.body.category[0]._id).toBeDefined();
    });

    test('should return empty array when no categories exist', async () => {
      // Act
      const res = await request(app)
        .get('/api/v1/category/get-category');

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.category).toHaveLength(0);
    });

    test('should return categories with correctly formatted slugs', async () => {
      // Arrange
      await categoryModel.create([
        { name: "Home & Garden", slug: "home-garden" },
        { name: "Sports & Outdoors", slug: "sports-outdoors" },
      ]);

      // Act
      const res = await request(app)
        .get('/api/v1/category/get-category');

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.category).toHaveLength(2);
      const slugs = res.body.category.map(c => c.slug);
      expect(slugs).toContain("home-garden");
      expect(slugs).toContain("sports-outdoors");
    });

    test('should handle large number of categories', async () => {
      // Arrange - create 50 categories
      const categories = [];
      for (let i = 1; i <= 50; i++) {
        categories.push({ name: `Category ${i}`, slug: `category-${i}` });
      }
      await categoryModel.create(categories);

      // Act
      const res = await request(app)
        .get('/api/v1/category/get-category');

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.category).toHaveLength(50);
    });
  });

  describe('GET /api/v1/category/single-category/:slug - singleCategoryController', () => {
    test('should retrieve single category by slug via HTTP', async () => {
      // Arrange
      await categoryModel.create({
        name: "Gaming Laptops",
        slug: "gaming-laptops"
      });

      // Act
      const res = await request(app)
        .get('/api/v1/category/single-category/gaming-laptops');

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.category.name).toBe("Gaming Laptops");
      expect(res.body.category.slug).toBe("gaming-laptops");
    });

    test('should return 404 when category slug does not exist', async () => {
      // Act
      const res = await request(app)
        .get('/api/v1/category/single-category/non-existent');

      // Assert
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Category not found");
    });

    test('should perform case-insensitive slug matching', async () => {
      // Arrange
      await categoryModel.create({
        name: "Electronics",
        slug: "electronics"
      });

      // Act - try uppercase slug
      const res = await request(app)
        .get('/api/v1/category/single-category/Electronics');

      // Assert - should find it (MongoDB slug field has lowercase: true)
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.category.name).toBe("Electronics");
      expect(res.body.category.slug).toBe("electronics");
    });

    test('should retrieve category with special characters in slug', async () => {
      // Arrange
      await categoryModel.create({
        name: "Home & Garden",
        slug: "home-garden"
      });

      // Act
      const res = await request(app)
        .get('/api/v1/category/single-category/home-garden');

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.category.name).toBe("Home & Garden");
    });
  });

  describe('POST /api/v1/category/create-category - createCategoryController', () => {
    test('should create new category with valid admin token', async () => {
      // Arrange
      const { token } = await createAdminUser();

      // Act
      const res = await request(app)
        .post('/api/v1/category/create-category')
        .set('Authorization', token)
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

    test('should reject category creation without authorization token', async () => {
      // Act - no Authorization header
      const res = await request(app)
        .post('/api/v1/category/create-category')
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test('should reject category creation with non-admin token', async () => {
      // Arrange
      const { token } = await createRegularUser();

      // Act
      const res = await request(app)
        .post('/api/v1/category/create-category')
        .set('Authorization', token)
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test('should return 409 when category name already exists', async () => {
      // Arrange
      const { token } = await createAdminUser();
      await categoryModel.create({ name: "Electronics", slug: "electronics" });

      // Act - try to create duplicate
      const res = await request(app)
        .post('/api/v1/category/create-category')
        .set('Authorization', token)
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Category already exists");
    });

    test('should handle case-insensitive duplicate detection', async () => {
      // Arrange
      const { token } = await createAdminUser();
      await categoryModel.create({ name: "Electronics", slug: "electronics" });

      // Act - try lowercase version
      const res = await request(app)
        .post('/api/v1/category/create-category')
        .set('Authorization', token)
        .send({ name: "electronics" });

      // Assert
      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe("Category already exists");
    });

    test('should reject empty category name', async () => {
      // Arrange
      const { token } = await createAdminUser();

      // Act
      const res = await request(app)
        .post('/api/v1/category/create-category')
        .set('Authorization', token)
        .send({ name: "" });

      // Assert
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Name is required");
    });

    test('should reject whitespace-only category name', async () => {
      // Arrange
      const { token } = await createAdminUser();

      // Act
      const res = await request(app)
        .post('/api/v1/category/create-category')
        .set('Authorization', token)
        .send({ name: "   " });

      // Assert
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Name is required");
    });

    test('should automatically generate slug from category name', async () => {
      // Arrange
      const { token } = await createAdminUser();

      // Act
      const res = await request(app)
        .post('/api/v1/category/create-category')
        .set('Authorization', token)
        .send({ name: "Home & Garden" });

      // Assert
      expect(res.statusCode).toBe(201);
      expect(res.body.category.slug).toBe("home-and-garden");
    });
  });

  describe('PUT /api/v1/category/update-category/:id - updateCategoryController', () => {
    test('should update category name with valid admin token', async () => {
      // Arrange
      const { token } = await createAdminUser();
      const category = await categoryModel.create({
        name: "Old Name",
        slug: "old-name"
      });

      // Act
      const res = await request(app)
        .put(`/api/v1/category/update-category/${category._id}`)
        .set('Authorization', token)
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

    test('should reject update without authorization token', async () => {
      // Arrange
      const category = await categoryModel.create({
        name: "Test",
        slug: "test"
      });

      // Act
      const res = await request(app)
        .put(`/api/v1/category/update-category/${category._id}`)
        .send({ name: "Updated" });

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test('should reject update with non-admin token', async () => {
      // Arrange
      const { token } = await createRegularUser();
      const category = await categoryModel.create({
        name: "Test",
        slug: "test"
      });

      // Act
      const res = await request(app)
        .put(`/api/v1/category/update-category/${category._id}`)
        .set('Authorization', token)
        .send({ name: "Updated" });

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test('should return 404 when updating non-existent category', async () => {
      // Arrange
      const { token } = await createAdminUser();
      const fakeId = new mongoose.Types.ObjectId();

      // Act
      const res = await request(app)
        .put(`/api/v1/category/update-category/${fakeId}`)
        .set('Authorization', token)
        .send({ name: "Updated" });

      // Assert
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Category not found");
    });

    test('should prevent duplicate names when updating', async () => {
      // Arrange
      const { token } = await createAdminUser();
      await categoryModel.create({ name: "Electronics", slug: "electronics" });
      const gaming = await categoryModel.create({ name: "Gaming", slug: "gaming" });

      // Act - try to update Gaming to Electronics
      const res = await request(app)
        .put(`/api/v1/category/update-category/${gaming._id}`)
        .set('Authorization', token)
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe("Category already exists");
    });

    test('should allow updating category to same name (self-update)', async () => {
      // Arrange
      const { token } = await createAdminUser();
      const category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics"
      });

      // Act - update to same name
      const res = await request(app)
        .put(`/api/v1/category/update-category/${category._id}`)
        .set('Authorization', token)
        .send({ name: "Electronics" });

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/category/delete-category/:id - deleteCategoryController', () => {
    test('should delete category with valid admin token', async () => {
      // Arrange
      const { token } = await createAdminUser();
      const category = await categoryModel.create({
        name: "To Delete",
        slug: "to-delete"
      });

      // Act
      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${category._id}`)
        .set('Authorization', token);

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Category deleted successfully");

      // Verify removed from database
      const dbCategory = await categoryModel.findById(category._id);
      expect(dbCategory).toBeNull();
    });

    test('should reject delete without authorization token', async () => {
      // Arrange
      const category = await categoryModel.create({
        name: "Test",
        slug: "test"
      });

      // Act
      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${category._id}`);

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test('should reject delete with non-admin token', async () => {
      // Arrange
      const { token } = await createRegularUser();
      const category = await categoryModel.create({
        name: "Test",
        slug: "test"
      });

      // Act
      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${category._id}`)
        .set('Authorization', token);

      // Assert
      expect(res.statusCode).toBe(401);
    });

    test('should return 404 when deleting non-existent category', async () => {
      // Arrange
      const { token } = await createAdminUser();
      const fakeId = new mongoose.Types.ObjectId();

      // Act
      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${fakeId}`)
        .set('Authorization', token);

      // Assert
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Category not found");
    });
  });
});

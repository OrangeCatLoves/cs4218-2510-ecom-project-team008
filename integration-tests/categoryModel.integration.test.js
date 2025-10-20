import mongoose from 'mongoose';
import { MongoMemoryServer } from "mongodb-memory-server";

// Mock db config
jest.mock('../config/db', () => jest.fn());

import categoryModel from "../models/categoryModel.js";

describe('Category Model Integration Tests', () => {
  let mongodbServer;

  beforeAll(async () => {
    mongodbServer = await MongoMemoryServer.create();
    const uri = mongodbServer.getUri();
    await mongoose.connect(uri);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongodbServer.stop();
  }, 60000);

  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany();
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Placeholder test
  test('should have model ready', () => {
    expect(categoryModel).toBeDefined();
    expect(mongoose.connection.readyState).toBe(1);
  });

  describe('Model + MongoDB Schema Integration', () => {
    test('should enforce unique constraint on category name at database level', async () => {
      // Arrange
      await categoryModel.create({ name: "Electronics", slug: "electronics" });

      // Act & Assert - try to create duplicate
      await expect(
        categoryModel.create({ name: "Electronics", slug: "electronics-2" })
      ).rejects.toThrow();

      // Verify error code
      try {
        await categoryModel.create({ name: "Electronics", slug: "electronics-3" });
      } catch (error) {
        expect(error.code).toBe(11000); // MongoDB duplicate key error
        expect(error.keyPattern.name).toBe(1);
      }
    });

    test('should enforce required name field at database level', async () => {
      // Act & Assert
      await expect(
        categoryModel.create({ slug: "test" })
      ).rejects.toThrow();

      // Verify validation error
      try {
        await categoryModel.create({ slug: "test-2" });
      } catch (error) {
        expect(error.name).toBe('ValidationError');
        expect(error.errors.name).toBeDefined();
        expect(error.errors.name.kind).toBe('required');
      }
    });

    test('should store slug in lowercase format', async () => {
      // Arrange & Act
      const category = await categoryModel.create({
        name: "Gaming",
        slug: "GAMING-LAPTOPS"
      });

      // Assert
      expect(category.slug).toBe("gaming-laptops");

      // Verify in database
      const dbCategory = await categoryModel.findById(category._id);
      expect(dbCategory.slug).toBe("gaming-laptops");
    });

    test('should allow creating category without explicit slug', async () => {
      // Act
      const category = await categoryModel.create({ name: "Electronics" });

      // Assert
      expect(category).toBeDefined();
      expect(category.name).toBe("Electronics");
      // Slug may be undefined or empty based on schema
    });
  });

  describe('Model + Controller Data Flow Integration', () => {
    test('should return data in format expected by controllers', async () => {
      // Arrange
      await categoryModel.create({ name: "Electronics", slug: "electronics" });

      // Act - use same query pattern as controller
      const categories = await categoryModel.find({});

      // Assert - verify format
      expect(categories).toHaveLength(1);
      expect(categories[0]._id).toBeDefined();
      expect(categories[0]._id).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(categories[0].name).toBe("Electronics");
      expect(categories[0].slug).toBe("electronics");
    });

    test('should support findOne by slug query used by singleCategoryController', async () => {
      // Arrange
      await categoryModel.create({ name: "Electronics", slug: "electronics" });

      // Act - exact pattern controller uses
      const category = await categoryModel.findOne({ slug: "electronics" });

      // Assert
      expect(category).toBeDefined();
      expect(category.name).toBe("Electronics");
      expect(category.slug).toBe("electronics");
    });

    test('should support findByIdAndUpdate used by updateCategoryController', async () => {
      // Arrange
      const category = await categoryModel.create({
        name: "Old",
        slug: "old"
      });

      // Act - pattern controller uses
      const updated = await categoryModel.findByIdAndUpdate(
        category._id,
        { name: "Updated", slug: "updated" },
        { new: true }
      );

      // Assert
      expect(updated.name).toBe("Updated");
      expect(updated.slug).toBe("updated");

      // Verify old values replaced
      const dbCategory = await categoryModel.findById(category._id);
      expect(dbCategory.name).toBe("Updated");
    });

    test('should support findByIdAndDelete used by deleteCategoryController', async () => {
      // Arrange
      const category = await categoryModel.create({
        name: "ToDelete",
        slug: "to-delete"
      });

      // Act - pattern controller uses
      const deleted = await categoryModel.findByIdAndDelete(category._id);

      // Assert
      expect(deleted).toBeDefined();
      expect(deleted.name).toBe("ToDelete");

      // Verify no longer in database
      const dbCategory = await categoryModel.findById(category._id);
      expect(dbCategory).toBeNull();
    });
  });

  describe('Database Constraint Violations & Error Handling', () => {
    test('should handle duplicate key error with proper error code', async () => {
      // Arrange
      await categoryModel.create({ name: "Electronics", slug: "electronics" });

      // Act & Assert
      try {
        await categoryModel.create({ name: "Electronics", slug: "electronics-2" });
        fail('Should have thrown duplicate key error');
      } catch (error) {
        expect(error.code).toBe(11000);
        expect(error.keyPattern).toBeDefined();
        expect(error.keyPattern.name).toBe(1);
      }
    });

    test('should document case-sensitive behavior at database level', async () => {
      // Arrange
      await categoryModel.create({ name: "Electronics", slug: "electronics" });

      // Act - MongoDB allows different cases by default
      const result = await categoryModel.create({
        name: "electronics",
        slug: "electronics-lower"
      });

      // Assert - both exist (database is case-sensitive)
      expect(result).toBeDefined();
      const all = await categoryModel.find({});
      expect(all).toHaveLength(2);

      // This documents mismatch between controller logic (case-insensitive)
      // and database constraint (case-sensitive by default)
    });

    test('should handle concurrent create operations on same name', async () => {
      // Arrange - create two promises to create same category
      const create1 = categoryModel.create({ name: "Test", slug: "test-1" });
      const create2 = categoryModel.create({ name: "Test", slug: "test-2" });

      // Act - run concurrently
      const results = await Promise.allSettled([create1, create2]);

      // Assert - one succeeds, one fails
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0].reason.code).toBe(11000);
    });
  });
});

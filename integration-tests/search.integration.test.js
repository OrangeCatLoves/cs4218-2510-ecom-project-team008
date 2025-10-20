import mongoose from 'mongoose';
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

jest.mock('../config/db', () => jest.fn());
import productModel from "../models/productModel";
import categoryModel from "../models/categoryModel";
import app from "../app";

describe('Integration between backend Search System with MongoDB Database', () => {
  let mongodbServer;
  let category1, category2;
  let product1, product2;

  beforeAll(async() => {
    mongodbServer = await MongoMemoryServer.create();
    const uri = mongodbServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async() => {
    await mongoose.disconnect();
    await mongodbServer.stop();
  });

  beforeEach(async() => {
    category1 = await categoryModel.create({
      name: "Mock Category1",
      slug: "Mock Category Slug1"
    });

    product1 = await productModel.create({
      name: "Mock Product1",
      description: "Mock Description1",
      price: 19.99,
      quantity: 1,
      slug: "Mock Product Slug1",
      category: category1._id
    });

    category2 = await categoryModel.create({
      name: "Mock Category2",
      slug: "Mock Category Slug2"
    });

    product2 = await productModel.create({
      name: "Mock Product2",
      description: "Mock Description2",
      price: 19.990,
      quantity: 1,
      slug: "Mock Product Slug2",
      category: category2._id
    });
  });

  afterEach(async() => {
    const collections = await mongoose.connection.db.collections();

    for(let collection of collections) {
      await collection.deleteMany();
    }

    jest.clearAllMocks();
  });

  describe('searchProductController', () => {
    test('GET /api/v1/products/:keyword should return 200 and search results correctly based on search keyword', async() => {
      // Arrange
      const searchKeyword = "Mock Product";

      // Act
      const res = await request(app)
        .get(`/api/v1/product/search/${searchKeyword}`);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      expect(res.body[0].name).toEqual(product1.name);
      expect(res.body[0].description).toEqual(product1.description);
      expect(res.body[0].price).toBe(product1.price);

      expect(res.body[1].name).toEqual(product2.name);
      expect(res.body[1].description).toEqual(product2.description);
      expect(res.body[1].price).toBe(product2.price);
    });

    test('GET /api/v1/products/:keyword should return 200 and search results correctly based on search keyword', async() => {
      // Arrange
      const searchKeyword = "Mock Description";

      // Act
      const res = await request(app)
        .get(`/api/v1/product/search/${searchKeyword}`);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      expect(res.body[0].name).toEqual(product1.name);
      expect(res.body[0].description).toEqual(product1.description);
      expect(res.body[0].price).toBe(product1.price);

      expect(res.body[1].name).toEqual(product2.name);
      expect(res.body[1].description).toEqual(product2.description);
      expect(res.body[1].price).toBe(product2.price);
    });

    test('GET /api/v1/products/:keyword should return 200 and empty array if database has no product', async() => {
      // Arrange
      await productModel.deleteMany();
      await categoryModel.deleteMany();
      const searchKeyword = "Mock Product";

      // Act
      const res = await request(app)
        .get(`/api/v1/product/search/${searchKeyword}`);

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    test('GET /api/v1/products/:keyword should return 404 if database is not empty but no product matching search keyword', async() => {
      // Arrange
      const searchKeyword = "Invalid";

      // Act
      const res = await request(app)
        .get(`/api/v1/products/${searchKeyword}`);

      // Assert
      expect(res.statusCode).toBe(404);
    });

    test('GET /api/v1/products/:keyword should return 500 if database error occurs', async() => {
      // Arrange
      const searchKeyword = "Mock Product";
      const error = new Error("An Error Occurred.");
      jest.spyOn(productModel, 'find').mockImplementation(() => {
        throw error;
      });
      const consoleSpy = jest.spyOn(console, 'log');

      // Act
      const res = await request(app)
        .get(`/api/v1/product/search/${searchKeyword}`);

      // Assert
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBeFalsy();
      expect(res.body.message).toEqual("Error In Search Product API");
      expect(consoleSpy).toHaveBeenCalledWith(error);
    });
  });
});
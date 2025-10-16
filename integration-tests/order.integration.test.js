import mongoose from 'mongoose';
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import {server} from "../server";
import orderModel from "../models/orderModel";
import productModel from "../models/productModel";
import userModel from "../models/userModel";
import categoryModel from "../models/categoryModel";
import jwt, {JsonWebTokenError} from "jsonwebtoken";

jest.mock('../config/db', () => jest.fn());

describe('Integration between backend Order System with MongoDB Database', () => {
  let mongodbServer;

  // Set up in-memory database once for test cases
  beforeAll(async() => {
    mongodbServer = await MongoMemoryServer.create();
    const uri = mongodbServer.getUri();
    await mongoose.connect(uri);
  });

  // Clean up database after all test cases are run
  afterAll(async() => {
    await mongoose.disconnect();
    await mongodbServer.stop();
    await new Promise(resolve => server.close(resolve));
  });

  // Clean up collections before each test case so that every test case starts with an empty database
  beforeEach(async() => {
    const collections = await mongoose.connection.db.collections();

    for(let collection of collections) {
      await collection.deleteMany();
    }
  });

  it('GET /api/v1/auth/orders should return 200 and all orders for authenticated user', async() => {
    // Arrange
    const user1 = await userModel.create({
      name: "Mock Name1",
      email: "mock_email@gmail.com",
      password: "Mock Password1",
      phone: "Mock Phone1",
      address: "Mock Address1",
      answer: "Mock Answer1",
      role: 0
    });

    const category1 = await categoryModel.create({
      name: "Mock Category1",
      slug: "Mock Category Slug1"
    });

    const product1 = await productModel.create({
      name: "Mock Product1",
      description: "Mock Description1",
      price: 19.99,
      quantity: 1,
      slug: "Mock Product Slug",
      category: category1._id
    });

    const order1 = await orderModel.create({
      products: [product1._id],
      payment: {
        success: true,
        message: "Mock Message1",
      },
      buyer: user1._id,
      status: "Not Process"
    });

    // Act
    const jwtToken = jwt.sign({
        _id: user1._id,
      },
      process.env.JWT_SECRET || 'mockKey',
      {
        expiresIn: '5m',
      });
    const res = await request(server)
      .get('/api/v1/auth/orders')
      .set("Authorization", jwtToken);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].products).toHaveLength(1);
    expect(res.body[0].products[0].name).toEqual(product1.name);
    expect(res.body[0].products[0].description).toEqual(product1.description);
    expect(res.body[0].products[0].price).toBe(product1.price);
    expect(res.body[0].products[0].category.toString()).toEqual(category1._id.toString());
    expect(res.body[0].products[0].quantity).toBe(product1.quantity);
    expect(res.body[0].products[0].slug).toEqual(product1.slug);
    expect(res.body[0].payment.success).toBeTruthy();
    expect(res.body[0].payment.message).toEqual(order1.payment.message);
    expect(res.body[0].buyer.name).toEqual(user1.name);
    expect(res.body[0].status).toEqual(order1.status);
  });

  it('GET /api/v1/auth/orders should return 500 for non-authenticated user', async() => {
    // Arrange
    const consoleSpy = jest.spyOn(console, 'log');

    // Act
    await request(server).get('/api/v1/auth/orders');

    // Assert
    expect(consoleSpy).toHaveBeenCalled(expect.any(JsonWebTokenError));
  });
});
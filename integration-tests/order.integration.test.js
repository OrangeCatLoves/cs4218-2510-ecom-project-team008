import mongoose from 'mongoose';
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

jest.mock('../config/db', () => jest.fn());
import orderModel from "../models/orderModel";
import productModel from "../models/productModel";
import userModel from "../models/userModel";
import categoryModel from "../models/categoryModel";
import jwt from "jsonwebtoken";
import app from "../app";

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
  });

  // Clean up collections before each test case so that every test case starts with an empty database
  beforeEach(async() => {
    const collections = await mongoose.connection.db.collections();

    for(let collection of collections) {
      await collection.deleteMany();
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  })

  describe('getOrdersController', () => {
    test('GET /api/v1/auth/orders should return 200 and all orders for authenticated user', async() => {
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
          errors: {},
          params: {}
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
      const res = await request(app)
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

    test('GET /api/v1/auth/orders should return 200 and empty array if authenticated user does not have any order', async() => {
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
      const jwtToken = jwt.sign({
          _id: user1._id,
        },
        process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m',
        });

      // Act
      const res = await request(app)
        .get('/api/v1/auth/orders')
        .set('Authorization', jwtToken);

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    test('GET /api/v1/auth/orders should return 401 for non-authenticated user', async() => {
      // Arrange
      // No need, we can just call the endpoint without authentication header

      // Act
      const res = await request(app)
        .get('/api/v1/auth/orders');

      // Assert
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toEqual("Unauthorized: Invalid or missing token");
      expect(res.body.success).toBeFalsy();
    });

    test('GET /api/v1/auth/orders should return 500 and console log error when error occurs', async() => {
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
      const jwtToken = jwt.sign({
          _id: user1._id,
        },
        process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m',
        });
      const error = new Error("An Error occurred.");
      jest.spyOn(orderModel, "find").mockReturnValueOnce({
        populate: jest.fn().mockReturnValueOnce({
          populate: jest.fn().mockRejectedValueOnce(error)
        })
      });
      const consoleSpy = jest.spyOn(console, 'log')
        .mockImplementation(() => {});

      // Act
      const res = await request(app)
        .get('/api/v1/auth/orders')
        .set("Authorization", jwtToken);

      // Assert
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Error While Getting Orders");
      expect(res.body.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('getAllOrdersController', () => {
    test('Get /api/v1/auth/all-orders should return 200 and all orders on the system for authenticated admin user', async() => {
      // Arrange
      const admin = await userModel.create({
        name: "Mock Admin",
        email: "mock_admin_email@gmail.com",
        password: "Mock Admin Password1",
        phone: "Mock Admin Phone",
        address: "Mock Admin Address",
        answer: "Mock Admin Answer",
        role: 1
      });
      const user1 = await userModel.create({
        name: "Mock Name1",
        email: "mock_email1@gmail.com",
        password: "Mock Password1",
        phone: "Mock Phone1",
        address: "Mock Address1",
        answer: "Mock Answer1",
        role: 0
      });
      const user2 = await userModel.create({
        name: "Mock Name2",
        email: "mock_email2@gmail.com",
        password: "Mock Password2",
        phone: "Mock Phone2",
        address: "Mock Address2",
        answer: "Mock Answer2",
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
          errors: {},
          params: {}
        },
        buyer: user1._id,
        status: "Not Process"
      });
      const category2 = await categoryModel.create({
        name: "Mock Category2",
        slug: "Mock Category Slug2"
      });

      const product2 = await productModel.create({
        name: "Mock Product2",
        description: "Mock Description2",
        price: 199.99,
        quantity: 1,
        slug: "Mock Product Slug",
        category: category2._id
      });

      const order2 = await orderModel.create({
        products: [product2._id],
        payment: {
          success: false,
          message: "Mock Message2",
          errors: {},
          params: {}
        },
        buyer: user2._id,
        status: "Processing"
      });
      const jwtToken = jwt.sign({
        _id: admin._id,
      }, process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m'
        });

      // Act
      const res = await request(app)
        .get('/api/v1/auth/all-orders')
        .set('Authorization', jwtToken);

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);

      expect(res.body[0].buyer.name).toEqual(user2.name);
      expect(res.body[0].products).toHaveLength(1);
      expect(res.body[0].products[0].name).toEqual(product2.name);
      expect(res.body[0].products[0].description).toEqual(product2.description);
      expect(res.body[0].products[0].price).toBe(product2.price);
      expect(res.body[0].products[0].category.toString()).toEqual(category2._id.toString());
      expect(res.body[0].products[0].quantity).toBe(product2.quantity);
      expect(res.body[0].products[0].slug).toEqual(product2.slug);
      expect(res.body[0].payment.success).toBeFalsy();
      expect(res.body[0].payment.message).toEqual(order2.payment.message);
      expect(res.body[0].buyer.name).toEqual(user2.name);
      expect(res.body[0].status).toEqual(order2.status);

      expect(res.body[1].buyer.name).toEqual(user1.name);
      expect(res.body[1].products).toHaveLength(1);
      expect(res.body[1].products[0].name).toEqual(product1.name);
      expect(res.body[1].products[0].description).toEqual(product1.description);
      expect(res.body[1].products[0].price).toBe(product1.price);
      expect(res.body[1].products[0].category.toString()).toEqual(category1._id.toString());
      expect(res.body[1].products[0].quantity).toBe(product1.quantity);
      expect(res.body[1].products[0].slug).toEqual(product1.slug);
      expect(res.body[1].payment.success).toBeTruthy();
      expect(res.body[1].payment.message).toEqual(order1.payment.message);
      expect(res.body[1].buyer.name).toEqual(user1.name);
      expect(res.body[1].status).toEqual(order1.status);
    });

    test('GET /api/v1/auth/all-orders should return 200 and empty array if no orders in the system', async() => {
      // Arrange
      const admin = await userModel.create({
        name: "Mock Admin",
        email: "mock_admin_email@gmail.com",
        password: "Mock Admin Password1",
        phone: "Mock Admin Phone",
        address: "Mock Admin Address",
        answer: "Mock Admin Answer",
        role: 1
      });
      const jwtToken = jwt.sign({
        _id: admin._id
      }, process.env.JWT_SECRET || "mockKey",
        {
          expiresIn: '5m'
        });

      // Act
      const res = await request(app)
        .get('/api/v1/auth/all-orders')
        .set('Authorization', jwtToken);

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    test('GET /api/v1/auth/all-orders should return 401 for non-authenticated user', async() => {
      // Arrange
      // No arrangement because we are testing endpoint without jwt token

      // Act
      const res = await request(app)
        .get('/api/v1/auth/all-orders');

      // Assert
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toEqual("Unauthorized: Invalid or missing token");
      expect(res.body.success).toBeFalsy();
    });

    test('GET /api/v1/auth/all-orders should return 401 for authenticated user who is not admin', async() => {
      // Arrange
      const user1 = await userModel.create({
        name: "Mock Name1",
        email: "mock_email1@gmail.com",
        password: "Mock Password1",
        phone: "Mock Phone1",
        address: "Mock Address1",
        answer: "Mock Answer1",
        role: 0
      });
      const jwtToken = jwt.sign({
        _id: user1._id
      }, process.env.JWT_SECRET || "mockKey",
        {
          expiresIn: '5m'
        });

      // Act
      const res = await request(app)
        .get('/api/v1/auth/all-orders')
        .set('Authorization', jwtToken);

      // Assert
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toEqual("UnAuthorized Access");
      expect(res.body.success).toBeFalsy();
    });

    test('GET /api/v1/auth/all-orders should return 500 and console log error if error occurs', async() => {
      // Arrange
      const admin = await userModel.create({
        name: "Mock Admin",
        email: "mock_admin_email@gmail.com",
        password: "Mock Admin Password1",
        phone: "Mock Admin Phone",
        address: "Mock Admin Address",
        answer: "Mock Admin Answer",
        role: 1
      });

      const jwtToken = jwt.sign({
          _id: admin._id,
        },
        process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m',
        });
      const error = new Error("An Error occurred.");
      jest.spyOn(orderModel, "find").mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValueOnce(error)
      });
      const consoleSpy = jest.spyOn(console, 'log')
        .mockImplementation(() => {});

      // Act
      const res = await request(app)
        .get('/api/v1/auth/all-orders')
        .set("Authorization", jwtToken);

      // Assert
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Error While Getting Orders");
      expect(res.body.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('orderStatusController', () => {
    test('PUT /api/v1/auth/order-status/:orderId should update order status to correctly for authenticated user', async() => {
      // Arrange
      const admin = await userModel.create({
        name: "Mock Admin",
        email: "mock_admin_email@gmail.com",
        password: "Mock Admin Password1",
        phone: "Mock Admin Phone",
        address: "Mock Admin Address",
        answer: "Mock Admin Answer",
        role: 1
      });
      const user1 = await userModel.create({
        name: "Mock Name1",
        email: "mock_email1@gmail.com",
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
          errors: {},
          params: {}
        },
        buyer: user1._id,
        status: "Not Process"
      });
      const jwtToken = jwt.sign({
          _id: admin._id,
        },
        process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m',
        });

      // Act
      const res = await request(app)
        .put(`/api/v1/auth/order-status/${order1._id}`)
        .set('Authorization', jwtToken)
        .send({status: "Processing"});

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toEqual("Processing");
    });

    test('PUT /api/v1/auth/order-status/:orderId should return 401 for authenticated user who is not admin', async() => {
      // Arrange
      const user1 = await userModel.create({
        name: "Mock Name1",
        email: "mock_email1@gmail.com",
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
          errors: {},
          params: {}
        },
        buyer: user1._id,
        status: "Not Process"
      });

      // Act
      const res = await request(app)
        .put(`/api/v1/auth/order-status/${order1._id}`)
        .send({status: "Processing"});

      // Assert
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toEqual("Unauthorized: Invalid or missing token");
      expect(res.body.success).toBeFalsy();
    });

    test('PUT /api/v1/auth/order-status/:orderId should return 401 for authenticated user who is not admin', async() => {
      // Arrange
      const user1 = await userModel.create({
        name: "Mock Name1",
        email: "mock_email1@gmail.com",
        password: "Mock Password1",
        phone: "Mock Phone1",
        address: "Mock Address1",
        answer: "Mock Answer1",
        role: 0
      });
      const jwtToken = jwt.sign({
          _id: user1._id,
        },
        process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m',
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
          errors: {},
          params: {}
        },
        buyer: user1._id,
        status: "Not Process"
      });

      // Act
      const res = await request(app)
        .put(`/api/v1/auth/order-status/${order1._id}`)
        .set('Authorization', jwtToken)
        .send({status: "Processing"});

      // Assert
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toEqual("UnAuthorized Access");
      expect(res.body.success).toBeFalsy();
    });

    test('PUT /api/v1/auth/order-status/:orderId should return 500 and console log error if error occurs', async() => {
      // Arrange
      const admin = await userModel.create({
        name: "Mock Admin",
        email: "mock_admin_email@gmail.com",
        password: "Mock Admin Password1",
        phone: "Mock Admin Phone",
        address: "Mock Admin Address",
        answer: "Mock Admin Answer",
        role: 1
      });
      const user1 = await userModel.create({
        name: "Mock Name1",
        email: "mock_email1@gmail.com",
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
          errors: {},
          params: {}
        },
        buyer: user1._id,
        status: "Not Process"
      });
      const jwtToken = jwt.sign({
          _id: admin._id,
        },
        process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m',
        });
      const error = new Error("An Error Occurred.");
      jest.spyOn(orderModel, "findByIdAndUpdate").mockRejectedValueOnce(error);
      const consoleSpy = jest.spyOn(console, "log")
        .mockImplementation(() => {});

      // Act
      const res = await request(app)
        .put(`/api/v1/auth/order-status/${order1._id}`)
        .set('Authorization', jwtToken)
        .send({status: "Processing"});

      // Assert
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Error While Updating Order");
      expect(res.body.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(error);
    });
  });
});
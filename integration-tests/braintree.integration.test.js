import mongoose from 'mongoose';
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import app from "../app.js";
import braintree from "braintree";
import orderModel from "../models/orderModel.js";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

// Mock Braintree SDK at module level
jest.mock('braintree', () => ({
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

// Mock config/db
jest.mock('../config/db.js', () => jest.fn());

describe('Braintree Integration Tests', () => {
  let mongodbServer;
  let mockGateway;

  beforeAll(async () => {
    // Real in-memory MongoDB
    mongodbServer = await MongoMemoryServer.create();
    const uri = mongodbServer.getUri();
    await mongoose.connect(uri);

    // Get mock gateway instance
    mockGateway = braintree.BraintreeGateway.mock.results[0].value;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongodbServer.stop();
  });

  beforeEach(async () => {
    // Clean database between tests
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany();
    }

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('braintreeTokenController - /braintree/token - GET', () => {
    it('should return 200 and client token when Braintree SDK succeeds', async () => {
      // Arrange - Mock successful Braintree response with complete structure
      mockGateway.clientToken.generate.mockImplementation((options, callback) => {
        callback(null, {
          clientToken: "eyJ2ZXJzaW9uIjoyLCJhdXRob3JpemF0aW9uRmluZ2VycHJpbnQiOiJleUp..."
        });
      });

      // Act - Make HTTP request
      const res = await request(app).get('/api/v1/product/braintree/token');

      // Assert - Verify integration: Braintree SDK → Controller → HTTP Response
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('clientToken');
      expect(res.body.clientToken).toBe("eyJ2ZXJzaW9uIjoyLCJhdXRob3JpemF0aW9uRmluZ2VycHJpbnQiOiJleUp...");

      // Anti-Pattern #1 Check: NOT testing mock behavior
      // We test HTTP response (integration result), not that mock was called
    });

    it('should return 500 when Braintree SDK returns error', async () => {
      // Arrange - Mock Braintree SDK error
      const braintreeError = new Error("Braintree API unavailable");
      mockGateway.clientToken.generate.mockImplementation((options, callback) => {
        callback(braintreeError, null);
      });

      // Act
      const res = await request(app).get('/api/v1/product/braintree/token');

      // Assert - Verify error propagation: Braintree error → Controller → HTTP error
      expect(res.statusCode).toBe(500);
      // Controller sends the error object directly
      expect(res.body).toHaveProperty('message', 'Braintree API unavailable');
    });

    it('should return 200 with empty object when Braintree returns empty response', async () => {
      // Arrange - Mock unexpected Braintree response (edge case)
      mockGateway.clientToken.generate.mockImplementation((options, callback) => {
        callback(null, {});
      });

      // Act
      const res = await request(app).get('/api/v1/product/braintree/token');

      // Assert - Verify controller doesn't crash on unexpected response
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({});

      // Integration check: Edge case flows through without crashing
    });
  });

  describe('brainTreePaymentController - /braintree/payment - POST', () => {
    it('should process payment, create order, and decrement inventory when payment succeeds', async () => {
      // Arrange - Create category
      const category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics"
      });

      // Create user
      const user = await userModel.create({
        name: "Test User",
        email: "test@example.com",
        password: await bcrypt.hash("password123", 10),
        phone: "12345678",
        address: "123 Main St",
        answer: "answer",
        role: 0
      });

      // Create products with inventory
      const product1 = await productModel.create({
        name: "iPhone 14",
        slug: "iphone-14",
        description: "Latest iPhone",
        price: 999,
        quantity: 10,
        category: category._id
      });

      const product2 = await productModel.create({
        name: "AirPods Pro",
        slug: "airpods-pro",
        description: "Wireless earbuds",
        price: 199,
        quantity: 20,
        category: category._id
      });

      // Create JWT token for authentication
      const jwtToken = jwt.sign(
        { _id: user._id },
        process.env.JWT_SECRET || "mockKey",
        { expiresIn: "7d" }
      );

      // Mock successful Braintree payment with complete response structure
      mockGateway.transaction.sale.mockImplementation((params, callback) => {
        callback(null, {
          success: true,
          transaction: {
            id: "txn_abc123",
            status: "submitted_for_settlement",
            type: "sale",
            currencyIsoCode: "USD",
            amount: "2595.00",
            merchantAccountId: "merchant_123",
            paymentInstrumentType: "credit_card",
            createdAt: "2025-10-20T10:30:00Z",
            updatedAt: "2025-10-20T10:30:00Z"
          }
        });
      });

      // Cart with multiple items
      const cart = {
        "iphone-14": {
          quantity: 2,
          price: 999,
          productId: product1._id.toString()
        },
        "airpods-pro": {
          quantity: 3,
          price: 199,
          productId: product2._id.toString()
        }
      };

      // Act - Make authenticated payment request
      const res = await request(app)
        .post('/api/v1/product/braintree/payment')
        .set('Authorization', jwtToken)
        .send({
          nonce: "fake-payment-nonce-123",
          cart: cart
        });

      // Assert - Verify integration: Auth → Cart → Braintree → Order → Inventory → Response
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ok: true });

      // Verify order created in database with complete data
      const order = await orderModel.findOne({ buyer: user._id });
      expect(order).not.toBeNull();
      expect(order.status).toBe("Processing");
      expect(order.products).toHaveLength(5); // 2 iPhones + 3 AirPods
      expect(order.payment.transaction.id).toBe("txn_abc123");
      expect(order.payment.transaction.amount).toBe("2595.00");

      // Verify inventory decremented correctly
      const updatedProduct1 = await productModel.findById(product1._id);
      expect(updatedProduct1.quantity).toBe(8); // 10 - 2

      const updatedProduct2 = await productModel.findById(product2._id);
      expect(updatedProduct2.quantity).toBe(17); // 20 - 3

      // Anti-Pattern #1: NOT testing mock behavior - testing database changes
      // Anti-Pattern #4: Complete Braintree response structure used
    });

    it('should create order without inventory decrement when payment is declined', async () => {
      // Arrange - Create category
      const category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics"
      });

      // Create user
      const user = await userModel.create({
        name: "Test User",
        email: "test@example.com",
        password: await bcrypt.hash("password123", 10),
        phone: "12345678",
        address: "123 Main St",
        answer: "answer",
        role: 0
      });

      // Create product
      const product = await productModel.create({
        name: "iPhone 14",
        slug: "iphone-14",
        description: "Latest iPhone",
        price: 999,
        quantity: 10,
        category: category._id
      });

      const jwtToken = jwt.sign(
        { _id: user._id },
        process.env.JWT_SECRET || "mockKey",
        { expiresIn: "7d" }
      );

      // Mock declined Braintree payment with complete response structure
      mockGateway.transaction.sale.mockImplementation((params, callback) => {
        callback(null, {
          success: false,
          message: "Processor Declined",
          transaction: {
            id: "txn_declined_456",
            status: "processor_declined",
            type: "sale",
            currencyIsoCode: "USD",
            amount: "999.00",
            processorResponseCode: "2000",
            processorResponseText: "Do Not Honor"
          }
        });
      });

      const cart = {
        "iphone-14": {
          quantity: 1,
          price: 999,
          productId: product._id.toString()
        }
      };

      // Act
      const res = await request(app)
        .post('/api/v1/product/braintree/payment')
        .set('Authorization', jwtToken)
        .send({
          nonce: "fake-payment-nonce-123",
          cart: cart
        });

      // Assert - Verify partial integration: Order created, but no inventory change
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ok: true });

      // Order created WITHOUT "Processing" status
      const order = await orderModel.findOne({ buyer: user._id });
      expect(order).not.toBeNull();
      expect(order.status).not.toBe("Processing");
      expect(order.payment.success).toBe(false);
      expect(order.payment.message).toBe("Processor Declined");

      // Inventory unchanged
      const updatedProduct = await productModel.findById(product._id);
      expect(updatedProduct.quantity).toBe(10); // No decrement

      // Integration check: Conditional logic works (success vs failed payment)
    });

    it('should return 500 when Braintree SDK returns error', async () => {
      // Arrange
      const category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics"
      });

      const user = await userModel.create({
        name: "Test User",
        email: "test@example.com",
        password: await bcrypt.hash("password123", 10),
        phone: "12345678",
        address: "123 Main St",
        answer: "answer",
        role: 0
      });

      const product = await productModel.create({
        name: "iPhone 14",
        slug: "iphone-14",
        description: "Latest iPhone",
        price: 999,
        quantity: 10,
        category: category._id
      });

      const jwtToken = jwt.sign(
        { _id: user._id },
        process.env.JWT_SECRET || "mockKey",
        { expiresIn: "7d" }
      );

      // Mock Braintree SDK error
      const braintreeError = new Error("Network timeout");
      mockGateway.transaction.sale.mockImplementation((params, callback) => {
        callback(braintreeError, null);
      });

      const cart = {
        "iphone-14": {
          quantity: 1,
          price: 999,
          productId: product._id.toString()
        }
      };

      // Act
      const res = await request(app)
        .post('/api/v1/product/braintree/payment')
        .set('Authorization', jwtToken)
        .send({
          nonce: "fake-payment-nonce-123",
          cart: cart
        });

      // Assert - Verify error propagation: Braintree error → Controller → HTTP 500
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('message', 'Network timeout');

      // Verify no order created on error
      const order = await orderModel.findOne({ buyer: user._id });
      expect(order).toBeNull();

      // Integration check: Error propagation across layers
    });

    it('should correctly process cart with multiple items and quantities', async () => {
      // Arrange
      const category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics"
      });

      const user = await userModel.create({
        name: "Test User",
        email: "test@example.com",
        password: await bcrypt.hash("password123", 10),
        phone: "12345678",
        address: "123 Main St",
        answer: "answer",
        role: 0
      });

      const product1 = await productModel.create({
        name: "iPhone 14",
        slug: "iphone-14",
        description: "Latest iPhone",
        price: 999,
        quantity: 10,
        category: category._id
      });

      const product2 = await productModel.create({
        name: "AirPods Pro",
        slug: "airpods-pro",
        description: "Wireless earbuds",
        price: 199,
        quantity: 20,
        category: category._id
      });

      const jwtToken = jwt.sign(
        { _id: user._id },
        process.env.JWT_SECRET || "mockKey",
        { expiresIn: "7d" }
      );

      // Mock Braintree to capture amount passed
      let capturedAmount;
      mockGateway.transaction.sale.mockImplementation((params, callback) => {
        capturedAmount = params.amount;
        callback(null, {
          success: true,
          transaction: {
            id: "txn_test123",
            status: "submitted_for_settlement",
            type: "sale",
            currencyIsoCode: "USD",
            amount: params.amount,
            merchantAccountId: "merchant_123",
            paymentInstrumentType: "credit_card",
            createdAt: "2025-10-20T10:30:00Z",
            updatedAt: "2025-10-20T10:30:00Z"
          }
        });
      });

      const cart = {
        "iphone-14": {
          quantity: 2,
          price: 999,
          productId: product1._id.toString()
        },
        "airpods-pro": {
          quantity: 3,
          price: 199,
          productId: product2._id.toString()
        }
      };

      // Act
      const res = await request(app)
        .post('/api/v1/product/braintree/payment')
        .set('Authorization', jwtToken)
        .send({
          nonce: "fake-payment-nonce-123",
          cart: cart
        });

      // Assert - Verify cart data transformation
      expect(res.statusCode).toBe(200);

      // Verify total calculation: (999*2 + 199*3).toFixed(2) = "2595.00"
      expect(capturedAmount).toBe("2595.00");

      // Verify productsPaid array has correct count (2+3=5 ObjectIds)
      const order = await orderModel.findOne({ buyer: user._id });
      expect(order.products).toHaveLength(5);

      // Verify each product decremented by correct quantity
      const updatedProduct1 = await productModel.findById(product1._id);
      expect(updatedProduct1.quantity).toBe(8); // 10 - 2

      const updatedProduct2 = await productModel.findById(product2._id);
      expect(updatedProduct2.quantity).toBe(17); // 20 - 3

      // Integration check: Cart structure → Total calculation → Database updates
    });

    it('should save complete Braintree payment data to database', async () => {
      // Arrange
      const category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics"
      });

      const user = await userModel.create({
        name: "Test User",
        email: "test@example.com",
        password: await bcrypt.hash("password123", 10),
        phone: "12345678",
        address: "123 Main St",
        answer: "answer",
        role: 0
      });

      const product = await productModel.create({
        name: "iPhone 14",
        slug: "iphone-14",
        description: "Latest iPhone",
        price: 999,
        quantity: 10,
        category: category._id
      });

      const jwtToken = jwt.sign(
        { _id: user._id },
        process.env.JWT_SECRET || "mockKey",
        { expiresIn: "7d" }
      );

      // Mock with complete Braintree response structure (Anti-Pattern #4)
      const completeBraintreeResponse = {
        success: true,
        transaction: {
          id: "txn_complete_789",
          status: "submitted_for_settlement",
          type: "sale",
          currencyIsoCode: "USD",
          amount: "999.00",
          merchantAccountId: "merchant_123",
          paymentInstrumentType: "credit_card",
          createdAt: "2025-10-20T10:30:00Z",
          updatedAt: "2025-10-20T10:30:00Z",
          // Additional fields that might be accessed downstream
          processorResponseCode: "1000",
          processorResponseText: "Approved"
        }
      };

      mockGateway.transaction.sale.mockImplementation((params, callback) => {
        callback(null, completeBraintreeResponse);
      });

      const cart = {
        "iphone-14": {
          quantity: 1,
          price: 999,
          productId: product._id.toString()
        }
      };

      // Act
      const res = await request(app)
        .post('/api/v1/product/braintree/payment')
        .set('Authorization', jwtToken)
        .send({
          nonce: "fake-payment-nonce-123",
          cart: cart
        });

      // Assert - Verify complete Braintree data saved (Anti-Pattern #4)
      expect(res.statusCode).toBe(200);

      const order = await orderModel.findOne({ buyer: user._id });
      expect(order.payment.transaction.id).toBe("txn_complete_789");
      expect(order.payment.transaction.status).toBe("submitted_for_settlement");
      expect(order.payment.transaction.amount).toBe("999.00");
      expect(order.payment.transaction.processorResponseCode).toBe("1000");
      expect(order.payment.transaction.processorResponseText).toBe("Approved");

      // Integration check: Complete Braintree response → Database storage
      // No data loss between Braintree and MongoDB
    });

    it('should handle empty cart edge case', async () => {
      // Arrange
      const user = await userModel.create({
        name: "Test User",
        email: "test@example.com",
        password: await bcrypt.hash("password123", 10),
        phone: "12345678",
        address: "123 Main St",
        answer: "answer",
        role: 0
      });

      const jwtToken = jwt.sign(
        { _id: user._id },
        process.env.JWT_SECRET || "mockKey",
        { expiresIn: "7d" }
      );

      // Mock Braintree for $0.00 transaction
      mockGateway.transaction.sale.mockImplementation((params, callback) => {
        callback(null, {
          success: true,
          transaction: {
            id: "txn_empty_cart",
            status: "submitted_for_settlement",
            type: "sale",
            currencyIsoCode: "USD",
            amount: "0.00",
            merchantAccountId: "merchant_123",
            paymentInstrumentType: "credit_card",
            createdAt: "2025-10-20T10:30:00Z",
            updatedAt: "2025-10-20T10:30:00Z"
          }
        });
      });

      const emptyCart = {};

      // Act
      const res = await request(app)
        .post('/api/v1/product/braintree/payment')
        .set('Authorization', jwtToken)
        .send({
          nonce: "fake-payment-nonce-123",
          cart: emptyCart
        });

      // Assert - Verify edge case handling
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ok: true });

      const order = await orderModel.findOne({ buyer: user._id });
      expect(order).not.toBeNull();
      expect(order.products).toHaveLength(0); // No products
      expect(order.payment.transaction.amount).toBe("0.00");

      // Integration check: Edge case flows through all layers without crashing
    });
  });
});

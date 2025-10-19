import mongoose from 'mongoose';
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

jest.mock('../config/db', () => jest.fn());
import userModel from "../models/userModel";
import jwt from "jsonwebtoken";
import app from "../app";
import {expect} from "@playwright/test";

describe('Integration between backend Profile System with MongoDB Database', () => {
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
  });

  describe('updateProfileController', () => {
    test('PUT /api/v1/auth/profile should return 200 and updated user for authenticated user', async() => {
      // Arrange
      const user = await userModel.create({
        name: "Mock Name",
        email: "mock_email@gmail.com",
        password: "Mock Password",
        phone: "Mock Phone",
        address: "Mock Address",
        answer: "Mock Answer",
        role: 0
      });

      const jwtToken = jwt.sign({
        _id: user._id
      }, process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m'
        });

      const updatedUser = {
        name: "Updated Name",
        phone: "Updated Phone",
        address: "Updated Address",
      };

      // Act
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', jwtToken)
        .send(updatedUser);

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBeTruthy();
      expect(res.body.message).toBe("Profile Updated Successfully");
      expect(res.body.updatedUser.name).toEqual(updatedUser.name);
      expect(res.body.updatedUser.phone).toEqual(updatedUser.phone);
      expect(res.body.updatedUser.address).toEqual(updatedUser.address);
    });

    test('PUT /api/v1/auth/profile should return 200 and keep old user data if update data is empty', async() => {
      // Arrange
      const user = await userModel.create({
        name: "Mock Name",
        email: "mock_email@gmail.com",
        password: "Mock Password",
        phone: "Mock Phone",
        address: "Mock Address",
        answer: "Mock Answer",
        role: 0
      });

      const jwtToken = jwt.sign({
          _id: user._id
        }, process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m'
        });

      const updatedUser = {
        name: "",
        phone: "",
        address: "",
      };

      // Act
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', jwtToken)
        .send(updatedUser);

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBeTruthy();
      expect(res.body.message).toEqual("Profile Updated Successfully");
      expect(res.body.updatedUser.name).toEqual(user.name);
      expect(res.body.updatedUser.phone).toEqual(user.phone);
      expect(res.body.updatedUser.address).toEqual(user.address);
    });

    test('PUT /api/v1/auth/profile should return 401 for non-authenticated user', async() => {
      // Arrange
      const updatedUser = {
        name: "Updated Name",
        phone: "Updated Phone",
        address: "Updated Address",
      };

      // Act
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .send(updatedUser);

      // Assert
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toEqual("Unauthorized: Invalid or missing token");
      expect(res.body.success).toBeFalsy();
    });

    test('PUT /api/v1/auth/profile should return error json when update password is non-empty and less than 6 characters', async() => {
      // Arrange
      const user = await userModel.create({
        name: "Mock Name",
        email: "mock_email@gmail.com",
        password: "Mock Password",
        phone: "Mock Phone",
        address: "Mock Address",
        answer: "Mock Answer",
        role: 0
      });

      const updatedUser = {
        password: "12345"
      };

      const jwtToken = jwt.sign({
          _id: user._id
        }, process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m'
        });

      // Act
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', jwtToken)
        .send(updatedUser);

      // Assert
      expect(res.body).toMatchObject({ error: "Passsword is required and 6 character long" });
    });

    test('PUT /api/v1/auth/profile should return 500 and console log error if error occurs', async() => {
      // Arrange
      const user = await userModel.create({
        name: "Mock Name",
        email: "mock_email@gmail.com",
        password: "Mock Password",
        phone: "Mock Phone",
        address: "Mock Address",
        answer: "Mock Answer",
        role: 0
      });

      const updatedUser = {
        name: "Updated Name",
        phone: "Updated Phone",
        address: "Updated Address",
      };

      const jwtToken = jwt.sign({
          _id: user._id
        }, process.env.JWT_SECRET || 'mockKey',
        {
          expiresIn: '5m'
        });

      const error = new Error("An Error Occurred.");
      jest.spyOn(userModel, 'findByIdAndUpdate')
        .mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'log')
        .mockImplementation(() => {});

      // Act
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', jwtToken)
        .send(updatedUser);

      // Assert
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBeFalsy();
      expect(res.body.message).toEqual("Error While Update profile");
      expect(consoleSpy).toHaveBeenCalledWith(error);
    });
  });
});
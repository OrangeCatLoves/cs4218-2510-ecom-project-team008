import { registerController } from "./authController.js";

jest.mock("../models/userModel.js");
jest.mock("./../helpers/authHelper.js");

const mockName = "mockName";
const mockEmail = "mockEmail";
const mockPassword = "mockPassword";
const mockPhone = "mockPhone";
const mockAddress = "mockAddress";
const mockAnswer = "mockAnswer";
const mockRequest = {
  body: {
    name: mockName,
    email: mockEmail,
    password: mockPassword,
    phone: mockPhone,
    address: mockAddress,
    answer: mockAnswer,
  },
};

describe('registerController', () => {
  let res;

  beforeEach(() => {

    res = {
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return name is required error when there is no attribute name in request body', async () => {
    // Arrange
    const req = { body: { ...mockRequest.body, name: '' } };
    
    // Act
    await registerController(req, res);

    // Assert
    expect(res.send).toHaveBeenCalledWith({ error: "Name is Required" });
  });

  test('should return email is required error when there is no attribute email in request body', async () => {
    // Arrange
    const req = { body: { ...mockRequest.body, email: '' } };
    
    // Act
    await registerController(req, res);

    // Assert
    expect(res.send).toHaveBeenCalledWith({ error: "Email is Required" });
  });

  test('should return email is required error when there is no attribute password in request body', async () => {
    // Arrange
    const req = { body: { ...mockRequest.body, password: '' } };
    
    // Act
    await registerController(req, res);

    // Assert
    expect(res.send).toHaveBeenCalledWith({ error: "Password is Required" });
  });

  test('should return email is required error when there is no attribute phone in request body', async () => {
    // Arrange
    const req = { body: { ...mockRequest.body, phone: '' } };
    
    // Act
    await registerController(req, res);

    // Assert
    expect(res.send).toHaveBeenCalledWith({ error: "Phone number is Required" });
  });

  test('should return email is required error when there is no attribute address in request body', async () => {
    // Arrange
    const req = { body: { ...mockRequest.body, address: '' } };
    
    // Act
    await registerController(req, res);

    // Assert
    expect(res.send).toHaveBeenCalledWith({ error: "Address is Required" });
  });

  test('should return email is required error when there is no attribute answer in request body', async () => {
    // Arrange
    const req = { body: { ...mockRequest.body, answer: '' } };
    
    // Act
    await registerController(req, res);

    // Assert
    expect(res.send).toHaveBeenCalledWith({ error: "Answer is Required" });
  });
});
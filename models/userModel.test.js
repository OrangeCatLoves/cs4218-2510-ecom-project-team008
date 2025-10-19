import mongoose from "mongoose";
import User from "../models/userModel.js";

describe("User Model (Unit)", () => {
  afterAll(async () => {
    // Ensure mongoose does not hold open handles in the unit environment
    await mongoose.disconnect();
  });

  // schema shape
  it("exposes a schema with timestamps enabled and model name 'user'", () => {
    expect(User.modelName).toBe("users");
    expect(User.schema?.options?.timestamps).toBe(true);
  });

  it("marks email path as unique in the schema definition", () => {
    const emailPath = User.schema.path("email");
    expect(emailPath?.options?.unique).toBe(true);
  });

  // required fields (equivalence class - missing vs present)
  it("fails validation with required field errors when empty", () => {
    const doc = new User({});
    const err = doc.validateSync();
    // Ensure we have errors for all required fields
    const paths = Object.keys(err?.errors || {});
    expect(paths).toEqual(
      expect.arrayContaining([
        "name",
        "email",
        "password",
        "phone",
        "address",
        "answer",
      ])
    );
  });

  // check email format
  it("rejects invalid email format via regex 'match'", () => {
    const doc = new User({
      name: "Test",
      email: "not-an-email",
      password: "secret",
      phone: "123",
      address: "Somewhere",
      answer: "blue",
    });
    const err = doc.validateSync();
    expect(err?.errors?.email?.message).toMatch(/valid email/i);
  });

  it("lowercases and trims the email on set", () => {
    const doc = new User({
      name: "Test",
      email: "  JOHN.DOE@EXAMPLE.COM  ",
      password: "secret",
      phone: "123",
      address: "Somewhere",
      answer: "blue",
    });
    // No validation needed to observe set-casting; Mongoose applies on assignment
    expect(doc.email).toBe("john.doe@example.com");
  });

  // trimming behaviours
  it("trims leading/trailing whitespace on name, phone, and address", () => {
    const doc = new User({
      name: "  Alice  ",
      email: "alice@example.com",
      password: "secret",
      phone: "  555-0101  ",
      address: "  123 Main St  ",
      answer: "blue",
    });
    expect(doc.name).toBe("Alice");
    expect(doc.phone).toBe("555-0101");
    expect(doc.address).toBe("123 Main St");
  });

  // defaults and casting
  it("defaults role to 0 when not provided", () => {
    const doc = new User({
      name: "Bob",
      email: "bob@example.com",
      password: "secret",
      phone: "555",
      address: "Lane",
      answer: "blue",
    });
    expect(doc.role).toBe(0);
  });

  it("casts role to a Number when provided as a string", () => {
    const doc = new User({
      name: "Cast",
      email: "cast@example.com",
      password: "secret",
      phone: "555",
      address: "Lane",
      answer: "answer",
      role: "2",
    });
    expect(doc.role).toBe(2);
    expect(typeof doc.role).toBe("number");
  });

  // strict mode
  it("drops unknown fields under default strict mode", () => {
    const doc = new User({
      name: "Strict",
      email: "strict@example.com",
      password: "secret",
      phone: "555",
      address: "Lane",
      answer: "blue",
      extraneous: "nope",
    });
    // @ts-ignore – accessing unknown field intentionally
    expect(doc.extraneous).toBeUndefined();
  });
});

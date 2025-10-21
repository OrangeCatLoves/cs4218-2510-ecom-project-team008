/**
 * Integration Tests: userModel ↔ MongoDB (mongodb-memory-server)
 *
 * Scope: Real schema ↔ DB behavior (validation, defaults, indexes, CRUD, concurrency)
 * Approach: Bottom-up integration with ephemeral Mongo
 */

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import userModel from "../models/userModel.js";

let mongoServer;

describe("Integration: userModel ↔ MongoDB", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    // Ensure indexes (e.g., unique email) are built before running tests that depend on them
    await userModel.init();
  }, 60000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoServer.stop();
  }, 60000);

  afterEach(async () => {
    if (mongoose.connection.readyState !== 0) {
      const collections = mongoose.connection.collections;
      for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
      }
    }
  });

  describe("Creation + schema normalization/defaults", () => {
    it("creates a user with required fields, normalizes values, and sets defaults", async () => {
      const user = await userModel.create({
        name: "  John Doe  ",
        email: "  JoHn@ExAmPlE.CoM  ",
        password: "hashedpassword123",
        phone: "  555-1234 ",
        address: "  123 Main St  ",
        answer: "pet",
      });

      expect(user._id).toBeDefined();
      expect(user.name).toBe("John Doe"); // trimmed
      expect(user.email).toBe("john@example.com"); // trimmed + lowercased
      expect(user.phone).toBe("555-1234"); // trimmed
      expect(user.address).toBe("123 Main St"); // trimmed
      expect(user.role).toBe(0); // default
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it("supports unicode and special characters without corruption", async () => {
      const u = await userModel.create({
        name: "O'Brien & 张三",
        email: "unicode+chars@example.com",
        password: "p@ss",
        phone: "+1 (555) 123-4567",
        address: "東京都渋谷区",
        answer: "“Fluffy”",
      });

      expect(u.name).toBe("O'Brien & 张三");
      expect(u.address).toBe("東京都渋谷区");
      expect(u.phone).toBe("+1 (555) 123-4567");
    });

    it("persists plaintext password as provided (model should not auto-hash)", async () => {
      const u = await userModel.create({
        name: "Plain",
        email: "plain@example.com",
        password: "plaintext",
        phone: "555",
        address: "addr",
        answer: "a",
      });
      expect(u.password).toBe("plaintext");
    });
  });

  describe("Required fields & email format validation", () => {
    const base = {
      name: "User",
      email: "user@example.com",
      password: "x",
      phone: "1",
      address: "a",
      answer: "b",
    };

    it("rejects when required fields are missing", async () => {
      await expect(
        userModel.create({ ...base, name: undefined })
      ).rejects.toThrow();
      await expect(
        userModel.create({ ...base, email: undefined })
      ).rejects.toThrow();
      await expect(
        userModel.create({ ...base, password: undefined })
      ).rejects.toThrow();
      await expect(
        userModel.create({ ...base, phone: undefined })
      ).rejects.toThrow();
      await expect(
        userModel.create({ ...base, address: undefined })
      ).rejects.toThrow();
      await expect(
        userModel.create({ ...base, answer: undefined })
      ).rejects.toThrow();
    });

    it("accepts valid email variants", async () => {
      const valid = [
        "user@example.com",
        "test.user@example.com",
        "user+tag@example.co.uk",
        "user_name@example-domain.com",
      ];
      for (const email of valid) {
        const u = await userModel.create({ ...base, email });
        expect(u.email).toBe(email.toLowerCase());
        await userModel.deleteOne({ _id: u._id });
      }
    });

    it("rejects invalid email variants", async () => {
      const invalid = [
        "notanemail",
        "user@",
        "@example.com",
        "no-at-sign.com",
        "spaces @domain.com",
      ];
      for (const email of invalid) {
        await expect(userModel.create({ ...base, email })).rejects.toThrow();
      }
    });
  });

  describe("Unique index: email", () => {
    it("enforces unique email (index present and enforced)", async () => {
      await userModel.create({
        name: "One",
        email: "unique@example.com",
        password: "a",
        phone: "1",
        address: "x",
        answer: "y",
      });

      await expect(
        userModel.create({
          name: "Two",
          email: "unique@example.com",
          password: "b",
          phone: "2",
          address: "y",
          answer: "z",
        })
      ).rejects.toThrow(/duplicate|E11000/i);
    });

    it("enforces uniqueness case-insensitively (lowercasing schema rule)", async () => {
      await userModel.create({
        name: "One",
        email: "CaseSensitive@Example.Com",
        password: "a",
        phone: "1",
        address: "x",
        answer: "y",
      });

      await expect(
        userModel.create({
          name: "Two",
          email: "casesensitive@example.com",
          password: "b",
          phone: "2",
          address: "y",
          answer: "z",
        })
      ).rejects.toThrow(/duplicate|E11000/i);
    });

    it("handles concurrent duplicate inserts: one succeeds, one fails (race)", async () => {
      const docA = {
        name: "UserA",
        email: "race@example.com",
        password: "a",
        phone: "1",
        address: "x",
        answer: "y",
      };
      const docB = { ...docA, name: "UserB" };

      const [r1, r2] = await Promise.allSettled([
        userModel.create(docA),
        userModel.create(docB),
      ]);

      const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled");
      const rejected = [r1, r2].filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const count = await userModel.countDocuments({
        email: "race@example.com",
      });
      expect(count).toBe(1);
    });
  });

  describe("CRUD + timestamps", () => {
    it("finds by email, updates fields, preserves email, and bumps updatedAt", async () => {
      const u = await userModel.create({
        name: "John",
        email: "john@example.com",
        password: "p",
        phone: "1",
        address: "addr",
        answer: "ans",
      });

      const origUpdated = u.updatedAt;
      await new Promise((r) => setTimeout(r, 20));

      const updated = await userModel.findByIdAndUpdate(
        u._id,
        { name: "John Updated", phone: "999" },
        { new: true }
      );

      expect(updated.name).toBe("John Updated");
      expect(updated.phone).toBe("999");
      expect(updated.email).toBe("john@example.com");
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        origUpdated.getTime()
      );
    });

    it("delete removes the user permanently", async () => {
      const u = await userModel.create({
        name: "Del",
        email: "del@example.com",
        password: "p",
        phone: "1",
        address: "addr",
        answer: "ans",
      });
      await userModel.findByIdAndDelete(u._id);
      expect(await userModel.findById(u._id)).toBeNull();
    });

    it("bulk create and filter by role yields correct subsets", async () => {
      await userModel.create([
        {
          name: "Admin",
          email: "a@example.com",
          password: "x",
          phone: "1",
          address: "a",
          answer: "x",
          role: 1,
        },
        {
          name: "User1",
          email: "u1@example.com",
          password: "x",
          phone: "1",
          address: "a",
          answer: "x",
          role: 0,
        },
        {
          name: "User2",
          email: "u2@example.com",
          password: "x",
          phone: "1",
          address: "a",
          answer: "x",
          role: 0,
        },
      ]);

      const admins = await userModel.find({ role: 1 });
      const users = await userModel.find({ role: 0 });

      expect(admins).toHaveLength(1);
      expect(admins[0].name).toBe("Admin");
      expect(users).toHaveLength(2);
    });
  });

  describe("Updates with validators", () => {
    it("rejects invalid email during update when runValidators: true", async () => {
      const u = await userModel.create({
        name: "Jane",
        email: "jane@example.com",
        password: "p",
        phone: "1",
        address: "addr",
        answer: "ans",
      });

      await expect(
        userModel.findByIdAndUpdate(
          u._id,
          { email: "invalid-email" },
          { new: true, runValidators: true }
        )
      ).rejects.toThrow();
    });
  });

  describe("Edge cases", () => {
    it("handles long strings (no truncation unless schema specifies)", async () => {
      const long = "A".repeat(500);
      const u = await userModel.create({
        name: long,
        email: "long@example.com",
        password: "p",
        phone: "1",
        address: long,
        answer: "ans",
      });
      expect(u.name).toHaveLength(500);
      expect(u.address).toHaveLength(500);
    });

    it("rejects empty strings for required fields phone/address/answer", async () => {
      await expect(
        userModel.create({
          name: "Empty",
          email: "empty@example.com",
          password: "p",
          phone: "",
          address: "",
          answer: "",
        })
      ).rejects.toThrow(/required/i);
    });
  });

  describe("Index presence (sanity)", () => {
    it("has an index on email marked unique", async () => {
      const indexes = await userModel.collection.indexes();
      const emailIndex = indexes.find((i) =>
        Object.keys(i.key).includes("email")
      );
      expect(emailIndex).toBeDefined();
      expect(emailIndex.unique).toBe(true);
    });
  });
});

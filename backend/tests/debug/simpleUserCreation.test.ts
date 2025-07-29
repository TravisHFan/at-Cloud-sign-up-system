import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import User from "../../src/models/User";
import { ROLES } from "../../src/utils/roleUtils";

describe("Simple User Creation Test", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-test"
      );
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should create a user successfully", async () => {
    // Clear any existing test users
    await User.deleteMany({ email: "simpletest@test.com" });

    console.log("Creating simple test user...");
    const user = await User.create({
      username: "simpletest",
      firstName: "Simple",
      lastName: "Test",
      email: "simpletest@test.com",
      password: "Password123",
      role: ROLES.PARTICIPANT,
      phoneNumber: "1234567890",
      dateOfBirth: new Date("1990-01-01"),
      isActive: true,
      isVerified: true,
    });

    expect(user).toBeDefined();
    expect(user.email).toBe("simpletest@test.com");
    expect(user._id).toBeDefined();

    console.log("User created successfully:", {
      id: (user._id as any).toString(),
      email: user.email,
      role: user.role,
    });
  });
});

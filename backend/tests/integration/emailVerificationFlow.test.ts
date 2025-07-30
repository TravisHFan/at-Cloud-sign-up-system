import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { app } from "../../src/index";
import User from "../../src/models/User";
import { ROLES } from "../../src/utils/roleUtils";

describe("Email Verification Flow Debug", () => {
  let testUser: any;
  let verificationToken: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-test"
      );
    }
  });

  afterAll(async () => {
    // Clean up test user
    if (testUser) {
      await User.findByIdAndDelete(testUser._id);
    }
    await mongoose.connection.close();
  });

  it("should create unverified user and get verification token", async () => {
    // Clear any existing test users
    await User.deleteMany({ email: "verify.test@test.com" });

    console.log("Creating unverified test user...");
    testUser = await User.create({
      username: "verifytest",
      firstName: "Verify",
      lastName: "Test",
      email: "verify.test@test.com",
      password: "Password123",
      role: ROLES.PARTICIPANT,
      phoneNumber: "1234567890",
      dateOfBirth: new Date("1990-01-01"),
      isActive: true,
      isVerified: false, // Initially unverified
    });

    expect(testUser).toBeDefined();
    expect(testUser.isVerified).toBe(false);

    // Generate verification token
    verificationToken = (testUser as any).generateEmailVerificationToken();
    await testUser.save();

    console.log("Unverified user created with token:", {
      id: testUser._id.toString(),
      email: testUser.email,
      isVerified: testUser.isVerified,
      token: verificationToken.substring(0, 10) + "...",
    });
  });

  it("should verify email successfully (first time)", async () => {
    console.log("Testing first-time email verification...");

    const response = await request(app)
      .get(`/api/v1/auth/verify-email/${verificationToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.freshlyVerified).toBe(true);
    expect(response.body.alreadyVerified).toBeUndefined();

    console.log("First verification response:", {
      success: response.body.success,
      message: response.body.message,
      freshlyVerified: response.body.freshlyVerified,
      alreadyVerified: response.body.alreadyVerified,
    });

    // Check user is now verified in database
    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser?.isVerified).toBe(true);
  });

  it("should handle already verified email (second time)", async () => {
    console.log("Testing already-verified email verification...");

    const response = await request(app)
      .get(`/api/v1/auth/verify-email/${verificationToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.alreadyVerified).toBe(true);
    expect(response.body.freshlyVerified).toBeUndefined();

    console.log("Second verification response:", {
      success: response.body.success,
      message: response.body.message,
      freshlyVerified: response.body.freshlyVerified,
      alreadyVerified: response.body.alreadyVerified,
    });

    console.log("\n🔍 BUG ANALYSIS:");
    console.log(
      "- Frontend should only show ONE message for already verified emails"
    );
    console.log(
      "- Toast notification should be SUPPRESSED when alreadyVerified=true"
    );
    console.log("- Page content should show the verification status");
  });
});

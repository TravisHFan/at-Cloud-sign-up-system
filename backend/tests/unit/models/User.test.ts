import mongoose from "mongoose";
import User from "../../../src/models/User";
import { ROLES } from "../../../src/utils/roleUtils";

describe("User Model", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!);
  });

  describe("User Creation", () => {
    it("should create a user with valid data", async () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        password: "Password123!",
        firstName: "Test",
        lastName: "User",
        gender: "male" as const,
        role: ROLES.PARTICIPANT,
        isAtCloudLeader: false,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.username).toBe("testuser");
      expect(savedUser.email).toBe("test@example.com");
      expect(savedUser.role).toBe(ROLES.PARTICIPANT);
      expect(savedUser.password).not.toBe("Password123!"); // Should be hashed
    });

    it("should fail to create a user with invalid email", async () => {
      const userData = {
        username: "testuser2",
        email: "invalid-email",
        password: "Password123!",
        role: ROLES.PARTICIPANT,
        isAtCloudLeader: false,
        isActive: true,
        isVerified: false,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      };

      const user = new User(userData);

      await expect(user.save()).rejects.toThrow();
    });

    it("should fail to create a user with duplicate username", async () => {
      const userData1 = {
        username: "duplicateuser",
        email: "test1@example.com",
        password: "Password123!",
        role: ROLES.PARTICIPANT,
        isAtCloudLeader: false,
        isActive: true,
        isVerified: false,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      };

      const userData2 = {
        username: "duplicateuser", // Same username
        email: "test2@example.com", // Different email
        password: "Password123!",
        role: ROLES.PARTICIPANT,
        isAtCloudLeader: false,
        isActive: true,
        isVerified: false,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      };

      const user1 = new User(userData1);
      await user1.save();

      const user2 = new User(userData2);
      await expect(user2.save()).rejects.toThrow(/duplicate key|E11000/);
    });
  });

  describe("User Methods", () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = new User({
        username: "methodtest",
        email: "methodtest@example.com",
        password: "Password123!",
        role: ROLES.PARTICIPANT,
        isAtCloudLeader: false,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      });
      await testUser.save();
    });

    it("should compare password correctly", async () => {
      const isMatch = await testUser.comparePassword("Password123!");
      expect(isMatch).toBe(true);

      const isNotMatch = await testUser.comparePassword("wrongpassword");
      expect(isNotMatch).toBe(false);
    });

    it("should generate password reset token", () => {
      const token = testUser.generatePasswordResetToken();

      expect(token).toBeDefined();
      expect(testUser.passwordResetToken).toBeDefined();
      expect(testUser.passwordResetExpires).toBeDefined();
      expect(testUser.passwordResetExpires > new Date()).toBe(true);
    });

    it("should handle login attempts correctly", async () => {
      expect(testUser.loginAttempts).toBe(0);
      expect(testUser.isAccountLocked()).toBe(false);

      await testUser.incrementLoginAttempts();
      await testUser.save();

      // Refetch the user to get updated data
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.loginAttempts).toBe(1);
    });
  });
});

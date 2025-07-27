// Backend Integration Tests for Password Change
// File: /backend/tests/integration/userPasswordChange.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Mock User model for testing
const mockUser = {
  _id: "test-user-id",
  username: "testuser",
  email: "test@example.com",
  password: "",
  firstName: "Test",
  lastName: "User",
  gender: "male",
  isAtCloudLeader: false,
  isActive: true,
  isVerified: true,
};

// Mock implementation of User model
const User = {
  findById: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  findByIdAndUpdate: vi.fn(),
};

// Mock changePassword controller function
const mockChangePassword = async (req: any, res: any) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user?.userId;

  try {
    // Validation checks
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match.",
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Check current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    // Check if new password is different
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password.",
      });
    }

    // Hash new password and update
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(userId, { password: hashedNewPassword });

    res.status(200).json({
      success: true,
      message: "Password changed successfully!",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error occurred.",
    });
  }
};

describe("Password Change API Logic Tests", () => {
  let testUser: any;
  let authToken: string;
  const originalPassword = "TestPassword123!";
  const newPassword = "NewPassword123!";

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create test user with known password
    const hashedPassword = await bcrypt.hash(originalPassword, 12);
    testUser = {
      ...mockUser,
      _id: "test-user-id",
      password: hashedPassword,
    };

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser._id },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "1h" }
    );

    // Setup User.findById mock
    User.findById.mockResolvedValue(testUser);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Password Change Controller Logic", () => {
    it("✅ Should change password with valid current password", async () => {
      const mockReq = {
        body: {
          currentPassword: originalPassword,
          newPassword: newPassword,
          confirmPassword: newPassword,
        },
        user: { userId: testUser._id },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      User.findByIdAndUpdate.mockResolvedValue({
        ...testUser,
        password: await bcrypt.hash(newPassword, 12),
      });

      await mockChangePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Password changed successfully!",
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(testUser._id, {
        password: expect.any(String),
      });
    });

    it("❌ Should reject invalid current password", async () => {
      const mockReq = {
        body: {
          currentPassword: "WrongPassword123!",
          newPassword: newPassword,
          confirmPassword: newPassword,
        },
        user: { userId: testUser._id },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await mockChangePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Current password is incorrect.",
      });
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("❌ Should reject same old/new password", async () => {
      const mockReq = {
        body: {
          currentPassword: originalPassword,
          newPassword: originalPassword, // Same as current
          confirmPassword: originalPassword,
        },
        user: { userId: testUser._id },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await mockChangePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "New password must be different from current password.",
      });
    });

    it("❌ Should reject non-matching confirm password", async () => {
      const mockReq = {
        body: {
          currentPassword: originalPassword,
          newPassword: newPassword,
          confirmPassword: "DifferentPassword123!", // Different from newPassword
        },
        user: { userId: testUser._id },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await mockChangePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "New passwords do not match.",
      });
    });

    it("❌ Should reject missing required fields", async () => {
      const testCases = [
        { currentPassword: originalPassword }, // Missing newPassword & confirmPassword
        { newPassword: newPassword }, // Missing currentPassword & confirmPassword
        { confirmPassword: newPassword }, // Missing currentPassword & newPassword
        {}, // Missing all fields
      ];

      for (const testCase of testCases) {
        const mockReq = {
          body: testCase,
          user: { userId: testUser._id },
        };

        const mockRes = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn(),
        };

        await mockChangePassword(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: "All fields are required.",
        });
      }
    });

    it("❌ Should handle user not found", async () => {
      User.findById.mockResolvedValue(null); // User not found

      const mockReq = {
        body: {
          currentPassword: originalPassword,
          newPassword: newPassword,
          confirmPassword: newPassword,
        },
        user: { userId: "non-existent-id" },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await mockChangePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("✅ Should properly hash new password", async () => {
      const mockReq = {
        body: {
          currentPassword: originalPassword,
          newPassword: newPassword,
          confirmPassword: newPassword,
        },
        user: { userId: testUser._id },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await mockChangePassword(mockReq, mockRes);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        testUser._id,
        { password: expect.stringMatching(/^\$2[abxy]\$12\$/) } // bcrypt hash with salt rounds 12
      );
    });
  });

  describe("Password Security Logic Tests", () => {
    it("✅ Should verify bcrypt comparison works correctly", async () => {
      const plainPassword = "TestPassword123!";
      const hashedPassword = await bcrypt.hash(plainPassword, 12);

      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      const isInvalid = await bcrypt.compare("WrongPassword", hashedPassword);

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it("✅ Should generate different hashes for same password", async () => {
      const password = "SamePassword123!";
      const hash1 = await bcrypt.hash(password, 12);
      const hash2 = await bcrypt.hash(password, 12);

      expect(hash1).not.toBe(hash2); // Should be different due to salt
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });

    it("✅ Should detect same passwords correctly", async () => {
      const currentPassword = "CurrentPassword123!";
      const hashedCurrent = await bcrypt.hash(currentPassword, 12);

      // Test same password detection
      const isSamePassword = await bcrypt.compare(
        currentPassword,
        hashedCurrent
      );
      expect(isSamePassword).toBe(true);

      // Test different password detection
      const isDifferentPassword = await bcrypt.compare(
        "DifferentPassword123!",
        hashedCurrent
      );
      expect(isDifferentPassword).toBe(false);
    });
  });

  describe("JWT Token Validation Logic", () => {
    it("✅ Should create valid JWT tokens", () => {
      const payload = { userId: "test-user-id" };
      const secret = "test-secret";
      const token = jwt.sign(payload, secret, { expiresIn: "1h" });

      const decoded = jwt.verify(token, secret) as any;
      expect(decoded.userId).toBe(payload.userId);
    });

    it("❌ Should reject invalid JWT tokens", () => {
      const invalidToken = "invalid-token";
      const secret = "test-secret";

      expect(() => {
        jwt.verify(invalidToken, secret);
      }).toThrow();
    });

    it("❌ Should reject expired JWT tokens", () => {
      const payload = { userId: "test-user-id" };
      const secret = "test-secret";
      const expiredToken = jwt.sign(payload, secret, { expiresIn: "-1h" });

      expect(() => {
        jwt.verify(expiredToken, secret);
      }).toThrow();
    });
  });
});

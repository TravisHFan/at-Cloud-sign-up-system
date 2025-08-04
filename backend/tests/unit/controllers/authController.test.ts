import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";

// Simple mock approach that works with Vitest hoisting
vi.mock("../../../src/models", () => ({
  User: Object.assign(vi.fn(), {
    findOne: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      exec: vi.fn(),
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
    create: vi.fn(),
    findById: vi.fn(),
    find: vi.fn(),
  }),
}));

vi.mock("../../../src/middleware/auth", () => ({
  TokenService: {
    generateTokenPair: vi.fn(),
  },
}));

vi.mock("../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendVerificationEmail: vi.fn(),
  },
}));

vi.mock(
  "../../../src/services/infrastructure/autoEmailNotificationService",
  () => ({
    AutoEmailNotificationService: {
      sendAtCloudRoleChangeNotification: vi.fn(),
    },
  })
);

vi.mock("../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    sendWelcomeNotification: vi.fn(),
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("crypto", () => ({
  default: {
    randomBytes: vi.fn(),
  },
  randomBytes: vi.fn(),
}));

// Import after mocking
import { AuthController } from "../../../src/controllers/authController";
import { User } from "../../../src/models";
import { TokenService } from "../../../src/middleware/auth";
import { EmailService } from "../../../src/services/infrastructure/emailService";
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";
import bcrypt from "bcryptjs";
import crypto from "crypto";

describe("AuthController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: any;
  let mockStatus: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnThis();

    mockResponse = {
      status: mockStatus,
      json: mockJson,
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: undefined,
      headers: {},
    };

    // Reset mocks to default state before each test
    vi.mocked(User.findOne).mockReset();
    vi.mocked(TokenService.generateTokenPair).mockReset();
    vi.mocked(EmailService.sendVerificationEmail).mockReset();
    vi.mocked(UnifiedMessageController.sendWelcomeNotification).mockReset();
  });

  describe("register", () => {
    it("should exist", async () => {
      expect(AuthController.register).toBeDefined();
      expect(typeof AuthController.register).toBe("function");
    });

    it("should successfully register a new user", async () => {
      // Arrange
      const validRegistrationData = {
        username: "testuser",
        email: "test@example.com",
        password: "TestPassword123!",
        confirmPassword: "TestPassword123!",
        firstName: "Test",
        lastName: "User",
        acceptTerms: true,
        isAtCloudLeader: false,
      };

      mockRequest.body = validRegistrationData;

      // Mock User.findOne to return null (no existing user)
      vi.mocked(User.findOne).mockResolvedValue(null);

      // Mock bcrypt and crypto
      (bcrypt.hash as any).mockResolvedValue("hashedPassword123");
      (crypto.randomBytes as any).mockReturnValue(
        Buffer.from("verification123")
      );

      const mockUser = {
        _id: "user123",
        username: "testuser",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        save: vi.fn().mockResolvedValue(undefined),
        generateEmailVerificationToken: vi
          .fn()
          .mockReturnValue("verification123"),
      };

      // Mock the User constructor
      vi.mocked(User).mockImplementation(() => mockUser as any);

      vi.mocked(TokenService.generateTokenPair).mockReturnValue({
        accessToken: "access123",
        refreshToken: "refresh123",
        accessTokenExpires: new Date(),
        refreshTokenExpires: new Date(),
      });
      vi.mocked(EmailService.sendVerificationEmail).mockResolvedValue(true);
      vi.mocked(
        UnifiedMessageController.sendWelcomeNotification
      ).mockResolvedValue(undefined);

      // Act
      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("Registration successful"),
        })
      );
    });

    it("should reject registration with existing username", async () => {
      // Arrange
      mockRequest.body = {
        username: "testuser",
        email: "test@example.com",
        password: "TestPassword123!",
        confirmPassword: "TestPassword123!",
        firstName: "Test",
        lastName: "User",
        acceptTerms: true,
        isAtCloudLeader: false,
      };

      // Mock duplicate key error like MongoDB would throw
      const duplicateError = new Error("Duplicate key error");
      (duplicateError as any).code = 11000;
      (duplicateError as any).keyPattern = { username: 1 };

      const mockUser = {
        save: vi.fn().mockRejectedValue(duplicateError),
        generateEmailVerificationToken: vi
          .fn()
          .mockReturnValue("verification123"),
      };

      vi.mocked(User).mockImplementation(() => mockUser as any);

      // Act
      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("already"),
        })
      );
    });

    it("should reject registration with mismatched passwords", async () => {
      // Arrange
      mockRequest.body = {
        username: "testuser",
        email: "test@example.com",
        password: "TestPassword123!",
        confirmPassword: "DifferentPassword123!",
        firstName: "Test",
        lastName: "User",
        acceptTerms: true,
        isAtCloudLeader: false,
      };

      // Act
      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Passwords do not match",
        })
      );
    });
  });

  describe("login", () => {
    it("should exist", async () => {
      expect(AuthController.login).toBeDefined();
      expect(typeof AuthController.login).toBe("function");
    });

    it("should successfully login with valid credentials", async () => {
      // Arrange
      mockRequest.body = {
        emailOrUsername: "test@example.com",
        password: "TestPassword123!",
      };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        password: "hashedPassword123",
        isVerified: true,
        isActive: true,
        loginAttempts: 0,
        accountLockedUntil: undefined,
        lastLoginAt: new Date(),
        save: vi.fn().mockResolvedValue(undefined),
        isAccountLocked: vi.fn().mockReturnValue(false),
        resetLoginAttempts: vi.fn().mockResolvedValue(undefined),
        updateLastLogin: vi.fn().mockResolvedValue(undefined),
        comparePassword: vi.fn().mockResolvedValue(true),
        toJSON: vi.fn().mockReturnValue({
          _id: "user123",
          email: "test@example.com",
          username: "testuser",
        }),
      };

      vi.mocked(User.findOne).mockImplementation(
        () =>
          ({
            select: vi.fn().mockResolvedValue(mockUser),
          } as any)
      );
      (bcrypt.compare as any).mockResolvedValue(true);
      vi.mocked(TokenService.generateTokenPair).mockReturnValue({
        accessToken: "access123",
        refreshToken: "refresh123",
        accessTokenExpires: new Date(),
        refreshTokenExpires: new Date(),
      });

      // Act
      await AuthController.login(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Login successful!",
        })
      );
    });

    it("should reject login with invalid credentials", async () => {
      // Arrange
      mockRequest.body = {
        emailOrUsername: "test@example.com",
        password: "WrongPassword",
      };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        password: "hashedPassword123",
        isVerified: true,
        isActive: true,
        loginAttempts: 0,
        save: vi.fn().mockResolvedValue(undefined),
        isAccountLocked: vi.fn().mockReturnValue(false),
        resetLoginAttempts: vi.fn().mockResolvedValue(undefined),
        updateLastLogin: vi.fn().mockResolvedValue(undefined),
        comparePassword: vi.fn().mockResolvedValue(false),
        incrementLoginAttempts: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(User.findOne).mockImplementation(
        () =>
          ({
            select: vi.fn().mockResolvedValue(mockUser),
          } as any)
      );
      (bcrypt.compare as any).mockResolvedValue(false); // Wrong password

      // Act
      await AuthController.login(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid email/username or password",
        })
      );
    });

    it("should reject login for non-existent user", async () => {
      // Arrange
      mockRequest.body = {
        emailOrUsername: "nonexistent@example.com",
        password: "TestPassword123!",
      };

      vi.mocked(User.findOne).mockImplementation(
        () =>
          ({
            select: vi.fn().mockResolvedValue(null),
          } as any)
      );

      // Act
      await AuthController.login(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid email/username or password",
        })
      );
    });
  });

  describe("logout", () => {
    it("should exist", async () => {
      expect(AuthController.logout).toBeDefined();
      expect(typeof AuthController.logout).toBe("function");
    });
  });

  describe("verifyEmail", () => {
    it("should exist", async () => {
      expect(AuthController.verifyEmail).toBeDefined();
      expect(typeof AuthController.verifyEmail).toBe("function");
    });
  });

  describe("forgotPassword", () => {
    it("should exist", async () => {
      expect(AuthController.forgotPassword).toBeDefined();
      expect(typeof AuthController.forgotPassword).toBe("function");
    });
  });

  describe("resetPassword", () => {
    it("should exist", async () => {
      expect(AuthController.resetPassword).toBeDefined();
      expect(typeof AuthController.resetPassword).toBe("function");
    });
  });

  describe("getProfile", () => {
    it("should exist", async () => {
      expect(AuthController.getProfile).toBeDefined();
      expect(typeof AuthController.getProfile).toBe("function");
    });
  });

  describe("refreshToken", () => {
    it("should exist", async () => {
      expect(AuthController.refreshToken).toBeDefined();
      expect(typeof AuthController.refreshToken).toBe("function");
    });
  });

  describe("resendVerification", () => {
    it("should exist", async () => {
      expect(AuthController.resendVerification).toBeDefined();
      expect(typeof AuthController.resendVerification).toBe("function");
    });
  });

  describe("requestPasswordChange", () => {
    it("should exist", async () => {
      expect(AuthController.requestPasswordChange).toBeDefined();
      expect(typeof AuthController.requestPasswordChange).toBe("function");
    });
  });

  describe("completePasswordChange", () => {
    it("should exist", async () => {
      expect(AuthController.completePasswordChange).toBeDefined();
      expect(typeof AuthController.completePasswordChange).toBe("function");
    });
  });
});

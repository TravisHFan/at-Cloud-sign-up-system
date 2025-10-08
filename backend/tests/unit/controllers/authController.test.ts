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
    updateOne: vi.fn(),
  }),
}));

vi.mock("../../../src/middleware/auth", () => ({
  TokenService: {
    generateTokenPair: vi.fn(),
    verifyRefreshToken: vi.fn(),
    parseTimeToMs: vi.fn(),
  },
}));

vi.mock("../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendVerificationEmail: vi.fn(),
    sendWelcomeEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    sendPasswordResetSuccessEmail: vi.fn(),
    sendPasswordChangeRequestEmail: vi.fn(),
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
    createTargetedSystemMessage: vi.fn(),
  },
}));

vi.mock("../../../src/services", () => ({
  CachePatterns: {
    invalidateUserCache: vi.fn(),
    invalidateAllUserCaches: vi.fn(),
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
    createHash: vi.fn(),
  },
  randomBytes: vi.fn(),
  createHash: vi.fn(),
}));

// Import after mocking
import { AuthController } from "../../../src/controllers/authController";
import { User } from "../../../src/models";
import { TokenService } from "../../../src/middleware/auth";
import { EmailService } from "../../../src/services/infrastructure/emailService";
import { AutoEmailNotificationService } from "../../../src/services/infrastructure/autoEmailNotificationService";
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";
import { CachePatterns } from "../../../src/services";
import bcrypt from "bcryptjs";
import crypto from "crypto";

describe("AuthController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: any;
  let mockStatus: any;
  let mockCookie: any;
  let mockClearCookie: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnThis();
    mockCookie = vi.fn();
    mockClearCookie = vi.fn();

    mockResponse = {
      status: mockStatus,
      json: mockJson,
      cookie: mockCookie,
      clearCookie: mockClearCookie,
    };

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: undefined,
      headers: {},
      cookies: {},
    };

    // Reset mocks to default state before each test
    vi.mocked(User.findOne).mockReset();
    vi.mocked(User.findById).mockReset();
    vi.mocked(User.updateOne).mockReset();
    vi.mocked(TokenService.generateTokenPair).mockReset();
    vi.mocked(TokenService.verifyRefreshToken).mockReset();
    vi.mocked(TokenService.parseTimeToMs).mockReset();

    // Set default return value for parseTimeToMs (7 days in milliseconds)
    vi.mocked(TokenService.parseTimeToMs).mockReturnValue(
      7 * 24 * 60 * 60 * 1000
    );
    vi.mocked(EmailService.sendVerificationEmail).mockReset();
    vi.mocked(EmailService.sendWelcomeEmail).mockReset();
    vi.mocked(EmailService.sendPasswordResetEmail).mockReset();
    vi.mocked(EmailService.sendPasswordResetSuccessEmail).mockReset();
    vi.mocked(EmailService.sendPasswordChangeRequestEmail).mockReset();
    vi.mocked(
      AutoEmailNotificationService.sendAtCloudRoleChangeNotification
    ).mockReset();
    vi.mocked(UnifiedMessageController.createTargetedSystemMessage).mockReset();
    vi.mocked(CachePatterns.invalidateUserCache).mockReset();
    vi.mocked(CachePatterns.invalidateAllUserCaches).mockReset();
  });

  describe("register", () => {
    it("should exist", async () => {
      expect(AuthController.register).toBeDefined();
      expect(typeof AuthController.register).toBe("function");
    });

    describe("Successful Registration Scenarios", () => {
      it("should successfully register a new regular user", async () => {
        // Arrange
        const validRegistrationData = {
          username: "testuser",
          email: "test@example.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          firstName: "Test",
          lastName: "User",
          gender: "male" as const,
          acceptTerms: true,
          isAtCloudLeader: false,
        };

        mockRequest.body = validRegistrationData;

        // Mock User.findOne to return null (no existing user)
        vi.mocked(User.findOne).mockResolvedValue(null);

        const mockUser = {
          _id: "user123",
          username: "testuser",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          role: "Participant",
          isAtCloudLeader: false,
          isVerified: false,
          save: vi.fn().mockResolvedValue(undefined),
          generateEmailVerificationToken: vi
            .fn()
            .mockReturnValue("verification123"),
        };

        vi.mocked(User).mockImplementation(() => mockUser as any);
        vi.mocked(EmailService.sendVerificationEmail).mockResolvedValue(true);
        vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(
          undefined
        );

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
            data: expect.objectContaining({
              user: expect.objectContaining({
                id: "user123",
                username: "testuser",
                email: "test@example.com",
                isVerified: false,
              }),
            }),
          })
        );
        expect(EmailService.sendVerificationEmail).toHaveBeenCalledWith(
          "test@example.com",
          "Test",
          "verification123"
        );
        expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith(
          "user123"
        );
      });

      it("should successfully register an @Cloud co-worker with admin notifications", async () => {
        // Arrange
        const atCloudLeaderData = {
          username: "cloudleader",
          email: "leader@church.com",
          password: "SecurePass123!",
          confirmPassword: "SecurePass123!",
          firstName: "Cloud",
          lastName: "Leader",
          gender: "female" as const,
          isAtCloudLeader: true,
          roleInAtCloud: "Worship Leader",
          acceptTerms: true,
        };

        mockRequest.body = atCloudLeaderData;
        vi.mocked(User.findOne).mockResolvedValue(null);

        const mockUser = {
          _id: "leader456",
          username: "cloudleader",
          email: "leader@church.com",
          firstName: "Cloud",
          lastName: "Leader",
          isAtCloudLeader: true,
          roleInAtCloud: "Worship Leader",
          save: vi.fn().mockResolvedValue(undefined),
          generateEmailVerificationToken: vi
            .fn()
            .mockReturnValue("verification456"),
        };

        vi.mocked(User).mockImplementation(() => mockUser as any);
        vi.mocked(EmailService.sendVerificationEmail).mockResolvedValue(true);
        vi.mocked(
          AutoEmailNotificationService.sendAtCloudRoleChangeNotification
        ).mockResolvedValue({
          emailsSent: 1,
          messagesCreated: 1,
          success: true,
        });
        vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(
          undefined
        );

        // Act
        await AuthController.register(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(201);
        expect(
          AutoEmailNotificationService.sendAtCloudRoleChangeNotification
        ).toHaveBeenCalledWith({
          userData: expect.objectContaining({
            _id: "leader456",
            firstName: "Cloud",
            lastName: "Leader",
            email: "leader@church.com",
            roleInAtCloud: "Worship Leader",
          }),
          changeType: "signup",
          systemUser: expect.objectContaining({
            firstName: "System",
            lastName: "Registration",
          }),
        });
      });

      it("should set correct default avatar based on gender", async () => {
        // Test female avatar
        const femaleUserData = {
          username: "femaleuser",
          email: "female@example.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          gender: "female" as const,
          acceptTerms: true,
          isAtCloudLeader: false,
        };

        mockRequest.body = femaleUserData;
        vi.mocked(User.findOne).mockResolvedValue(null);

        const mockFemaleUser = {
          _id: "female123",
          save: vi.fn().mockResolvedValue(undefined),
          generateEmailVerificationToken: vi.fn().mockReturnValue("token"),
        };

        vi.mocked(User).mockImplementation(() => mockFemaleUser as any);
        vi.mocked(EmailService.sendVerificationEmail).mockResolvedValue(true);

        await AuthController.register(
          mockRequest as Request,
          mockResponse as Response
        );

        // Check if User constructor was called with female avatar
        expect(User).toHaveBeenCalledWith(
          expect.objectContaining({
            gender: "female",
            avatar: "/default-avatar-female.jpg",
          })
        );
      });
    });

    describe("Validation Error Scenarios", () => {
      it("should reject registration without accepting terms", async () => {
        // Arrange
        mockRequest.body = {
          username: "testuser",
          email: "test@example.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          acceptTerms: false,
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
            message: "You must accept the terms and conditions to register",
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
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
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
      });

      it("should reject @Cloud co-worker registration without roleInAtCloud", async () => {
        // Arrange
        mockRequest.body = {
          username: "cloudleader",
          email: "leader@church.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          isAtCloudLeader: true,
          // Missing roleInAtCloud
          acceptTerms: true,
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
            message: "Role in @Cloud is required for @Cloud co-workers",
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
      });
    });

    describe("Duplicate User Scenarios", () => {
      it("should reject registration with existing email", async () => {
        // Arrange
        mockRequest.body = {
          username: "newuser",
          email: "existing@example.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          acceptTerms: true,
          isAtCloudLeader: false,
        };

        const existingUser = { email: "existing@example.com" };
        vi.mocked(User.findOne).mockResolvedValue(existingUser as any);

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
            message: "Email address is already registered",
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
      });

      it("should reject registration with existing username", async () => {
        // Arrange
        mockRequest.body = {
          username: "existinguser",
          email: "new@example.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          acceptTerms: true,
          isAtCloudLeader: false,
        };

        const existingUser = {
          email: "different@example.com",
          username: "existinguser",
        };
        vi.mocked(User.findOne).mockResolvedValue(existingUser as any);

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
            message: "Username is already taken",
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
      });

      it("should handle MongoDB duplicate key error", async () => {
        // Arrange
        mockRequest.body = {
          username: "testuser",
          email: "test@example.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          acceptTerms: true,
          isAtCloudLeader: false,
        };

        vi.mocked(User.findOne).mockResolvedValue(null);

        const duplicateError = new Error("Duplicate key error");
        (duplicateError as any).code = 11000;
        (duplicateError as any).keyPattern = { username: 1 };

        const mockUser = {
          save: vi.fn().mockRejectedValue(duplicateError),
          generateEmailVerificationToken: vi.fn().mockReturnValue("token"),
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
            message: "username is already registered",
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
      });
    });

    describe("Email Service Integration", () => {
      it("should handle email service failure gracefully", async () => {
        // Arrange
        const validData = {
          username: "testuser",
          email: "test@example.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          acceptTerms: true,
          isAtCloudLeader: false,
        };

        mockRequest.body = validData;
        vi.mocked(User.findOne).mockResolvedValue(null);

        const mockUser = {
          _id: "user123",
          username: "testuser",
          email: "test@example.com",
          save: vi.fn().mockResolvedValue(undefined),
          generateEmailVerificationToken: vi.fn().mockReturnValue("token"),
        };

        vi.mocked(User).mockImplementation(() => mockUser as any);
        vi.mocked(EmailService.sendVerificationEmail).mockResolvedValue(false); // Email fails

        // Act
        await AuthController.register(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert - Registration should still succeed even if email fails
        expect(mockStatus).toHaveBeenCalledWith(201);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: expect.stringContaining("Registration successful"),
          })
        );
      });

      it("should handle admin notification failure for @Cloud co-workers gracefully", async () => {
        // Arrange
        const atCloudData = {
          username: "leader",
          email: "leader@church.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          isAtCloudLeader: true,
          roleInAtCloud: "Worship Leader",
          acceptTerms: true,
        };

        mockRequest.body = atCloudData;
        vi.mocked(User.findOne).mockResolvedValue(null);

        const mockUser = {
          _id: "leader123",
          save: vi.fn().mockResolvedValue(undefined),
          generateEmailVerificationToken: vi.fn().mockReturnValue("token"),
        };

        vi.mocked(User).mockImplementation(() => mockUser as any);
        vi.mocked(EmailService.sendVerificationEmail).mockResolvedValue(true);
        vi.mocked(
          AutoEmailNotificationService.sendAtCloudRoleChangeNotification
        ).mockRejectedValue(new Error("Notification service down"));

        // Act
        await AuthController.register(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert - Registration should still succeed
        expect(mockStatus).toHaveBeenCalledWith(201);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: expect.stringContaining("Registration successful"),
          })
        );
      });
    });

    describe("Database Error Scenarios", () => {
      it("should handle validation errors from MongoDB", async () => {
        // Arrange
        mockRequest.body = {
          username: "test",
          email: "test@example.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          acceptTerms: true,
          isAtCloudLeader: false,
        };

        vi.mocked(User.findOne).mockResolvedValue(null);

        const validationError = new Error("Validation failed");
        (validationError as any).name = "ValidationError";
        (validationError as any).errors = {
          username: { message: "Username too short" },
        };

        const mockUser = {
          save: vi.fn().mockRejectedValue(validationError),
          generateEmailVerificationToken: vi.fn().mockReturnValue("token"),
        };

        vi.mocked(User).mockImplementation(() => mockUser as any);

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
            message: "Validation failed",
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
      });

      it("should handle unexpected database errors", async () => {
        // Arrange
        mockRequest.body = {
          username: "testuser",
          email: "test@example.com",
          password: "TestPassword123!",
          confirmPassword: "TestPassword123!",
          acceptTerms: true,
          isAtCloudLeader: false,
        };

        vi.mocked(User.findOne).mockResolvedValue(null);

        const unexpectedError = new Error("Database connection failed");
        const mockUser = {
          save: vi.fn().mockRejectedValue(unexpectedError),
          generateEmailVerificationToken: vi.fn().mockReturnValue("token"),
        };

        vi.mocked(User).mockImplementation(() => mockUser as any);

        // Act
        await AuthController.register(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "Registration failed. Please try again",
          })
        );
      });
    });
  });

  describe("login", () => {
    it("should exist", async () => {
      expect(AuthController.login).toBeDefined();
      expect(typeof AuthController.login).toBe("function");
    });

    describe("Successful Login Scenarios", () => {
      it("should successfully login with valid email credentials", async () => {
        // Arrange
        mockRequest.body = {
          emailOrUsername: "test@example.com",
          password: "TestPassword123!",
          rememberMe: false,
        };

        const mockUser = {
          _id: "user123",
          email: "test@example.com",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          phone: "+1234567890",
          role: "Participant",
          isAtCloudLeader: false,
          isVerified: true,
          isActive: true,
          loginAttempts: 0,
          avatar: "/default-avatar-male.jpg",
          lastLogin: new Date(),
          isAccountLocked: vi.fn().mockReturnValue(false),
          comparePassword: vi.fn().mockResolvedValue(true),
          resetLoginAttempts: vi.fn().mockResolvedValue(undefined),
          updateLastLogin: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(User.findOne).mockImplementation(
          () =>
            ({
              select: vi.fn().mockResolvedValue(mockUser),
            } as any)
        );

        vi.mocked(TokenService.generateTokenPair).mockReturnValue({
          accessToken: "access123",
          refreshToken: "refresh123",
          accessTokenExpires: new Date(Date.now() + 3600000),
          refreshTokenExpires: new Date(Date.now() + 7 * 24 * 3600000),
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
            data: expect.objectContaining({
              user: expect.objectContaining({
                id: "user123",
                email: "test@example.com",
                username: "testuser",
              }),
              accessToken: "access123",
            }),
          })
        );
        expect(mockCookie).toHaveBeenCalledWith(
          "refreshToken",
          "refresh123",
          expect.objectContaining({
            httpOnly: true,
            secure: false, // NODE_ENV !== 'production'
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000, // 1 day (rememberMe: false)
          })
        );
        expect(mockUser.resetLoginAttempts).toHaveBeenCalled();
        expect(mockUser.updateLastLogin).toHaveBeenCalled();
      });

      it("should successfully login with valid username credentials", async () => {
        // Arrange
        mockRequest.body = {
          emailOrUsername: "testuser",
          password: "TestPassword123!",
          rememberMe: false,
        };

        const mockUser = {
          _id: "user123",
          username: "testuser",
          email: "test@example.com",
          isVerified: true,
          isActive: true,
          isAccountLocked: vi.fn().mockReturnValue(false),
          comparePassword: vi.fn().mockResolvedValue(true),
          resetLoginAttempts: vi.fn().mockResolvedValue(undefined),
          updateLastLogin: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(User.findOne).mockImplementation(
          () =>
            ({
              select: vi.fn().mockResolvedValue(mockUser),
            } as any)
        );

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
        expect(User.findOne).toHaveBeenCalledWith({
          $or: [{ email: "testuser" }, { username: "testuser" }],
        });
      });

      it("should set longer cookie expiry when rememberMe is true", async () => {
        // Arrange
        mockRequest.body = {
          emailOrUsername: "test@example.com",
          password: "TestPassword123!",
          rememberMe: true,
        };

        const mockUser = {
          _id: "user123",
          isVerified: true,
          isActive: true,
          isAccountLocked: vi.fn().mockReturnValue(false),
          comparePassword: vi.fn().mockResolvedValue(true),
          resetLoginAttempts: vi.fn().mockResolvedValue(undefined),
          updateLastLogin: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(User.findOne).mockImplementation(
          () =>
            ({
              select: vi.fn().mockResolvedValue(mockUser),
            } as any)
        );

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
        expect(mockCookie).toHaveBeenCalledWith(
          "refreshToken",
          "refresh123",
          expect.objectContaining({
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (rememberMe: true)
          })
        );
      });
    });

    describe("Authentication Failure Scenarios", () => {
      it("should reject login with missing credentials", async () => {
        // Arrange
        mockRequest.body = {
          emailOrUsername: "",
          password: "",
        };

        // Act
        await AuthController.login(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(400);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "Email/username and password are required",
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
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
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
      });

      it("should reject login with invalid password", async () => {
        // Arrange
        mockRequest.body = {
          emailOrUsername: "test@example.com",
          password: "WrongPassword",
        };

        const mockUser = {
          _id: "user123",
          email: "test@example.com",
          isVerified: true,
          isActive: true,
          isAccountLocked: vi.fn().mockReturnValue(false),
          comparePassword: vi.fn().mockResolvedValue(false),
          incrementLoginAttempts: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(User.findOne).mockImplementation(
          () =>
            ({
              select: vi.fn().mockResolvedValue(mockUser),
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
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
        expect(mockUser.incrementLoginAttempts).toHaveBeenCalled();
      });
    });

    describe("Account Status Scenarios", () => {
      it("should reject login for locked account", async () => {
        // Arrange
        mockRequest.body = {
          emailOrUsername: "test@example.com",
          password: "TestPassword123!",
        };

        const mockUser = {
          _id: "user123",
          email: "test@example.com",
          isAccountLocked: vi.fn().mockReturnValue(true),
        };

        vi.mocked(User.findOne).mockImplementation(
          () =>
            ({
              select: vi.fn().mockResolvedValue(mockUser),
            } as any)
        );

        // Act
        await AuthController.login(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(423);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message:
              "Account is temporarily locked due to too many failed login attempts. Please try again later",
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
      });

      it("should reject login for inactive account", async () => {
        // Arrange
        mockRequest.body = {
          emailOrUsername: "test@example.com",
          password: "TestPassword123!",
        };

        const mockUser = {
          _id: "user123",
          email: "test@example.com",
          isActive: false,
          isAccountLocked: vi.fn().mockReturnValue(false),
        };

        vi.mocked(User.findOne).mockImplementation(
          () =>
            ({
              select: vi.fn().mockResolvedValue(mockUser),
            } as any)
        );

        // Act
        await AuthController.login(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(403);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "Account has been deactivated. Please contact support",
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
      });

      it("should reject login for unverified email", async () => {
        // Arrange
        mockRequest.body = {
          emailOrUsername: "test@example.com",
          password: "TestPassword123!",
        };

        const mockUser = {
          _id: "user123",
          email: "test@example.com",
          isActive: true,
          isVerified: false,
          isAccountLocked: vi.fn().mockReturnValue(false),
          comparePassword: vi.fn().mockResolvedValue(true),
        };

        vi.mocked(User.findOne).mockImplementation(
          () =>
            ({
              select: vi.fn().mockResolvedValue(mockUser),
            } as any)
        );

        // Act
        await AuthController.login(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(403);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "Please verify your email address before logging in",
            meta: expect.objectContaining({
              timestamp: expect.any(String),
            }),
          })
        );
      });
    });

    describe("Database Error Scenarios", () => {
      it("should handle database errors gracefully", async () => {
        // Arrange
        mockRequest.body = {
          emailOrUsername: "test@example.com",
          password: "TestPassword123!",
        };

        vi.mocked(User.findOne).mockImplementation(
          () =>
            ({
              select: vi.fn().mockRejectedValue(new Error("Database error")),
            } as any)
        );

        // Act
        await AuthController.login(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "Login failed. Please try again",
          })
        );
      });
    });
  });

  describe("verifyEmail", () => {
    it("should exist", async () => {
      expect(AuthController.verifyEmail).toBeDefined();
      expect(typeof AuthController.verifyEmail).toBe("function");
    });

    it("should successfully verify email for unverified user", async () => {
      // Arrange
      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        firstName: "Test",
        username: "testuser",
        isVerified: false,
        emailVerificationToken: "token123",
        emailVerificationExpires: new Date(Date.now() + 3600000),
        save: vi.fn().mockResolvedValue(undefined),
      };

      mockRequest.user = mockUser as any;
      vi.mocked(EmailService.sendWelcomeEmail).mockResolvedValue(true);
      vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(undefined);

      // Act
      await AuthController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Email verified successfully! Welcome to @Cloud Ministry.",
          freshlyVerified: true,
        })
      );
      expect(mockUser.isVerified).toBe(true);
      expect(mockUser.emailVerificationToken).toBeUndefined();
      expect(mockUser.emailVerificationExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(EmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        "test@example.com",
        "Test"
      );
      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith("user123");
    });

    it("should handle already verified user", async () => {
      // Arrange
      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        isVerified: true,
      };

      mockRequest.user = mockUser as any;

      // Act
      await AuthController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Email is already verified.",
          alreadyVerified: true,
        })
      );
    });

    it("should handle invalid verification token", async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await AuthController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid verification token.",
          errorType: "invalid_token",
        })
      );
    });

    it("should handle database errors during verification", async () => {
      // Arrange
      const mockUser = {
        _id: "user123",
        isVerified: false,
        save: vi.fn().mockRejectedValue(new Error("Database error")),
      };

      mockRequest.user = mockUser as any;

      // Act
      await AuthController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Email verification failed.",
          errorType: "server_error",
        })
      );
    });
  });

  describe("forgotPassword", () => {
    it("should exist", async () => {
      expect(AuthController.forgotPassword).toBeDefined();
      expect(typeof AuthController.forgotPassword).toBe("function");
    });

    it("should send password reset email for valid user", async () => {
      // Arrange
      mockRequest.body = { email: "test@example.com" };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        firstName: "Test",
        username: "testuser",
        isActive: true,
        generatePasswordResetToken: vi.fn().mockReturnValue("resettoken123"),
        save: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(User.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(EmailService.sendPasswordResetEmail).mockResolvedValue(true);
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue({
        _id: "message123",
      } as any);

      // Act
      await AuthController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining(
            "If that email address is in our system"
          ),
        })
      );
      expect(EmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        "test@example.com",
        "Test",
        "resettoken123"
      );
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalled();
    });

    it("should return success message even for non-existent user (security)", async () => {
      // Arrange
      mockRequest.body = { email: "nonexistent@example.com" };
      vi.mocked(User.findOne).mockResolvedValue(null);

      // Act
      await AuthController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining(
            "If that email address is in our system"
          ),
        })
      );
      expect(EmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("should reject request without email", async () => {
      // Arrange
      mockRequest.body = {};

      // Act
      await AuthController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Email address is required.",
        })
      );
    });

    it("should handle email service failure gracefully", async () => {
      // Arrange
      mockRequest.body = { email: "test@example.com" };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        firstName: "Test",
        username: "testuser",
        isActive: true,
        generatePasswordResetToken: vi.fn().mockReturnValue("resettoken123"),
        save: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(User.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(EmailService.sendPasswordResetEmail).mockResolvedValue(false); // Email fails

      // Act
      await AuthController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert - Should still return success to prevent email enumeration
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining(
            "If that email address is in our system"
          ),
        })
      );
    });

    it("should handle system message creation failure gracefully", async () => {
      // Arrange
      mockRequest.body = { email: "test@example.com" };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        firstName: "Test",
        username: "testuser",
        isActive: true,
        generatePasswordResetToken: vi.fn().mockReturnValue("resettoken123"),
        save: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(User.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(EmailService.sendPasswordResetEmail).mockResolvedValue(true);
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockRejectedValue(new Error("Message service down"));

      // Act
      await AuthController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert - Should still succeed despite message failure
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it("should handle database errors", async () => {
      // Arrange
      mockRequest.body = { email: "test@example.com" };
      vi.mocked(User.findOne).mockRejectedValue(new Error("Database error"));

      // Act
      await AuthController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Password reset request failed.",
        })
      );
    });
  });

  describe("resetPassword", () => {
    it("should exist", async () => {
      expect(AuthController.resetPassword).toBeDefined();
      expect(typeof AuthController.resetPassword).toBe("function");
    });

    it("should successfully reset password with valid token", async () => {
      // Arrange
      mockRequest.body = {
        newPassword: "NewSecurePassword123!",
        confirmPassword: "NewSecurePassword123!",
      };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        firstName: "Test",
        username: "testuser",
        password: "oldHashedPassword",
        passwordResetToken: "resettoken123",
        passwordResetExpires: new Date(Date.now() + 3600000),
        save: vi.fn().mockResolvedValue(undefined),
      };

      mockRequest.user = mockUser as any;
      vi.mocked(EmailService.sendPasswordResetSuccessEmail).mockResolvedValue(
        true
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue({
        _id: "message123",
      } as any);
      vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(undefined);

      // Act
      await AuthController.resetPassword(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Password reset successfully!",
        })
      );
      expect(mockUser.password).toBe("NewSecurePassword123!");
      expect(mockUser.passwordResetToken).toBeUndefined();
      expect(mockUser.passwordResetExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith("user123");
      expect(EmailService.sendPasswordResetSuccessEmail).toHaveBeenCalledWith(
        "test@example.com",
        "Test"
      );
    });

    it("should reject reset with missing passwords", async () => {
      // Arrange
      mockRequest.body = {};

      // Act
      await AuthController.resetPassword(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "New password and confirmation are required.",
        })
      );
    });

    it("should reject reset with mismatched passwords", async () => {
      // Arrange
      mockRequest.body = {
        newPassword: "Password123!",
        confirmPassword: "DifferentPassword123!",
      };

      // Act
      await AuthController.resetPassword(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Passwords do not match.",
        })
      );
    });

    it("should reject reset with invalid token", async () => {
      // Arrange
      mockRequest.body = {
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };
      mockRequest.user = undefined;

      // Act
      await AuthController.resetPassword(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid or expired reset token.",
        })
      );
    });
  });

  describe("logout", () => {
    it("should exist", async () => {
      expect(AuthController.logout).toBeDefined();
      expect(typeof AuthController.logout).toBe("function");
    });

    it("should successfully logout user", async () => {
      // Act
      await AuthController.logout(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockClearCookie).toHaveBeenCalledWith("refreshToken");
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Logged out successfully!",
        })
      );
    });

    it("should handle logout errors gracefully", async () => {
      // Arrange
      mockClearCookie.mockImplementation(() => {
        throw new Error("Cookie clear failed");
      });

      // Act
      await AuthController.logout(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Logout failed.",
        })
      );
    });
  });

  describe("refreshToken", () => {
    it("should exist", async () => {
      expect(AuthController.refreshToken).toBeDefined();
      expect(typeof AuthController.refreshToken).toBe("function");
    });

    it("should successfully refresh valid token", async () => {
      // Arrange
      mockRequest.cookies = { refreshToken: "validRefreshToken" };

      const mockDecodedToken = { userId: "user123" };
      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        isActive: true,
      };

      vi.mocked(TokenService.verifyRefreshToken).mockReturnValue(
        mockDecodedToken
      );
      vi.mocked(User.findById).mockResolvedValue(mockUser as any);
      vi.mocked(TokenService.generateTokenPair).mockReturnValue({
        accessToken: "newAccessToken",
        refreshToken: "newRefreshToken",
        accessTokenExpires: new Date(),
        refreshTokenExpires: new Date(),
      });

      // Act
      await AuthController.refreshToken(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            accessToken: "newAccessToken",
            refreshToken: "newRefreshToken",
          }),
          message: "Token refreshed successfully.",
        })
      );
      expect(mockCookie).toHaveBeenCalledWith(
        "refreshToken",
        "newRefreshToken",
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
      );
    });

    it("should reject request without refresh token", async () => {
      // Arrange
      mockRequest.cookies = {};

      // Act
      await AuthController.refreshToken(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Refresh token not provided.",
        })
      );
    });

    it("should reject invalid refresh token", async () => {
      // Arrange
      mockRequest.cookies = { refreshToken: "invalidToken" };
      vi.mocked(TokenService.verifyRefreshToken).mockReturnValue(null as any);

      // Act
      await AuthController.refreshToken(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid refresh token.",
        })
      );
    });

    it("should reject token for non-existent user", async () => {
      // Arrange
      mockRequest.cookies = { refreshToken: "validRefreshToken" };
      const mockDecodedToken = { userId: "user123" };

      vi.mocked(TokenService.verifyRefreshToken).mockReturnValue(
        mockDecodedToken
      );
      vi.mocked(User.findById).mockResolvedValue(null);

      // Act
      await AuthController.refreshToken(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User not found or inactive.",
        })
      );
    });

    it("should reject token for inactive user", async () => {
      // Arrange
      mockRequest.cookies = { refreshToken: "validRefreshToken" };
      const mockDecodedToken = { userId: "user123" };
      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        isActive: false,
      };

      vi.mocked(TokenService.verifyRefreshToken).mockReturnValue(
        mockDecodedToken
      );
      vi.mocked(User.findById).mockResolvedValue(mockUser as any);

      // Act
      await AuthController.refreshToken(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User not found or inactive.",
        })
      );
    });

    it("should handle token verification errors", async () => {
      // Arrange
      mockRequest.cookies = { refreshToken: "validRefreshToken" };
      vi.mocked(TokenService.verifyRefreshToken).mockImplementation(() => {
        throw new Error("Token verification failed");
      });

      // Act
      await AuthController.refreshToken(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Token refresh failed.",
        })
      );
    });
  });

  describe("resendVerification", () => {
    it("should exist", async () => {
      expect(AuthController.resendVerification).toBeDefined();
      expect(typeof AuthController.resendVerification).toBe("function");
    });

    it("should successfully resend verification email", async () => {
      // Arrange
      mockRequest.body = { email: "test@example.com" };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        firstName: "Test",
        username: "testuser",
        isActive: true,
        isVerified: false,
        generateEmailVerificationToken: vi.fn().mockReturnValue("newToken123"),
        save: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(User.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(EmailService.sendVerificationEmail).mockResolvedValue(true);

      // Act
      await AuthController.resendVerification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Verification email sent successfully.",
        })
      );
      expect(User.findOne).toHaveBeenCalledWith({
        email: "test@example.com",
        isActive: true,
        isVerified: false,
      });
      expect(EmailService.sendVerificationEmail).toHaveBeenCalledWith(
        "test@example.com",
        "Test",
        "newToken123"
      );
    });

    it("should reject request without email", async () => {
      // Arrange
      mockRequest.body = {};

      // Act
      await AuthController.resendVerification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Email address is required.",
        })
      );
    });

    it("should reject for non-existent or already verified user", async () => {
      // Arrange
      mockRequest.body = { email: "verified@example.com" };
      vi.mocked(User.findOne).mockResolvedValue(null);

      // Act
      await AuthController.resendVerification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User not found or already verified.",
        })
      );
    });

    it("should handle email service failure", async () => {
      // Arrange
      mockRequest.body = { email: "test@example.com" };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        firstName: "Test",
        username: "testuser",
        isActive: true,
        isVerified: false,
        generateEmailVerificationToken: vi.fn().mockReturnValue("newToken123"),
        save: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(User.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(EmailService.sendVerificationEmail).mockResolvedValue(false);

      // Act
      await AuthController.resendVerification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Failed to send verification email.",
        })
      );
    });
  });

  describe("getProfile", () => {
    it("should exist", async () => {
      expect(AuthController.getProfile).toBeDefined();
      expect(typeof AuthController.getProfile).toBe("function");
    });

    it("should successfully return user profile", async () => {
      // Arrange
      const mockUser = {
        _id: "user123",
        username: "testuser",
        email: "test@example.com",
        phone: "+1234567890",
        firstName: "Test",
        lastName: "User",
        gender: "male",
        avatar: "/default-avatar-male.jpg",
        role: "Participant",
        isAtCloudLeader: false,
        roleInAtCloud: undefined,
        occupation: "Developer",
        company: "Tech Corp",
        weeklyChurch: "Local Church",
        homeAddress: "123 Main St",
        churchAddress: "456 Church Ave",
        lastLogin: new Date(),
        createdAt: new Date(),
        isVerified: true,
        isActive: true,
      };

      mockRequest.user = mockUser as any;

      // Act
      await AuthController.getProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: "user123",
              username: "testuser",
              email: "test@example.com",
              phone: "+1234567890",
              firstName: "Test",
              lastName: "User",
              gender: "male",
              avatar: "/default-avatar-male.jpg",
              role: "Participant",
              isAtCloudLeader: false,
              occupation: "Developer",
              company: "Tech Corp",
              weeklyChurch: "Local Church",
              homeAddress: "123 Main St",
              churchAddress: "456 Church Ave",
              isVerified: true,
              isActive: true,
            }),
          }),
        })
      );
    });

    it("should reject request without authentication", async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await AuthController.getProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Authentication required.",
        })
      );
    });

    it("should handle profile retrieval errors", async () => {
      // Arrange - Simulate error during response building
      const mockUser = {
        _id: "user123",
        get username() {
          throw new Error("Database error");
        },
      };

      mockRequest.user = mockUser as any;

      // Act
      await AuthController.getProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Failed to retrieve profile.",
        })
      );
    });
  });

  describe("requestPasswordChange", () => {
    it("should exist", async () => {
      expect(AuthController.requestPasswordChange).toBeDefined();
      expect(typeof AuthController.requestPasswordChange).toBe("function");
    });

    it("should successfully initiate password change request", async () => {
      // Arrange
      mockRequest.body = {
        currentPassword: "CurrentPassword123!",
        newPassword: "NewPassword123!",
      };
      mockRequest.user = { _id: "user123" } as any;

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        firstName: "Test",
        username: "testuser",
        password: "hashedCurrentPassword",
        save: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(User.findById).mockImplementation(
        () =>
          ({
            select: vi.fn().mockResolvedValue(mockUser),
          } as any)
      );

      // Mock bcrypt compare for current password verification
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      // Mock crypto for token generation
      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue("hashedtoken123"),
      };
      vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);
      vi.mocked(crypto.randomBytes).mockReturnValue("randomtoken123" as any);

      // Mock bcrypt hash for new password
      vi.mocked(bcrypt.hash).mockResolvedValue("hashedNewPassword" as never);

      vi.mocked(EmailService.sendPasswordChangeRequestEmail).mockResolvedValue(
        true
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue({
        _id: "message123",
      } as any);

      // Act
      await AuthController.requestPasswordChange(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining(
            "Password change request sent. Please check your email to confirm."
          ),
        })
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "CurrentPassword123!",
        "hashedCurrentPassword"
      );
      expect(EmailService.sendPasswordChangeRequestEmail).toHaveBeenCalled();
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalled();
    });

    it("should reject request with missing fields", async () => {
      // Arrange
      mockRequest.body = { currentPassword: "password123" };
      mockRequest.user = { _id: "user123" } as any;

      // Act
      await AuthController.requestPasswordChange(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Current password and new password are required.",
        })
      );
    });

    it("should reject request with weak new password", async () => {
      // Arrange
      mockRequest.body = {
        currentPassword: "CurrentPassword123!",
        newPassword: "weak",
      };
      mockRequest.user = { _id: "user123" } as any;

      // Act
      await AuthController.requestPasswordChange(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "New password must be at least 8 characters long.",
        })
      );
    });

    it("should reject request with incorrect current password", async () => {
      // Arrange
      mockRequest.body = {
        currentPassword: "WrongPassword123!",
        newPassword: "NewPassword123!",
      };
      mockRequest.user = { _id: "user123" } as any;

      const mockUser = {
        _id: "user123",
        password: "hashedCurrentPassword",
      };

      vi.mocked(User.findById).mockImplementation(
        () =>
          ({
            select: vi.fn().mockResolvedValue(mockUser),
          } as any)
      );

      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      // Act
      await AuthController.requestPasswordChange(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Current password is incorrect.",
        })
      );
    });

    it("should handle user not found error", async () => {
      // Arrange
      mockRequest.body = {
        currentPassword: "CurrentPassword123!",
        newPassword: "NewPassword123!",
      };
      mockRequest.user = { _id: "user123" } as any;

      vi.mocked(User.findById).mockImplementation(
        () =>
          ({
            select: vi.fn().mockResolvedValue(null),
          } as any)
      );

      // Act
      await AuthController.requestPasswordChange(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User not found.",
        })
      );
    });
  });

  describe("completePasswordChange", () => {
    it("should exist", async () => {
      expect(AuthController.completePasswordChange).toBeDefined();
      expect(typeof AuthController.completePasswordChange).toBe("function");
    });

    it("should successfully complete password change with valid token", async () => {
      // Arrange
      mockRequest.params = { token: "validtoken123" };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        firstName: "Test",
        username: "testuser",
        passwordChangeToken: "hashedtoken123",
        passwordChangeExpires: new Date(Date.now() + 600000), // 10 minutes in future
        pendingPassword: "hashedNewPassword",
      };

      // Mock crypto hash for token verification
      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue("hashedtoken123"),
      };
      vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);

      vi.mocked(User.findOne).mockImplementation(
        () =>
          ({
            select: vi.fn().mockResolvedValue(mockUser),
          } as any)
      );
      vi.mocked(User.updateOne).mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
        matchedCount: 1,
        upsertedCount: 0,
      } as any);

      const updatedUser = { ...mockUser, password: "hashedNewPassword" };
      vi.mocked(User.findById).mockResolvedValue(updatedUser as any);

      vi.mocked(EmailService.sendPasswordResetSuccessEmail).mockResolvedValue(
        true
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue({
        _id: "message123",
      } as any);
      vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(undefined);

      // Act
      await AuthController.completePasswordChange(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Password changed successfully!",
        })
      );
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: "user123" },
        expect.objectContaining({
          $set: expect.objectContaining({
            password: "hashedNewPassword",
            passwordChangedAt: expect.any(Date),
          }),
          $unset: expect.objectContaining({
            passwordChangeToken: 1,
            passwordChangeExpires: 1,
            pendingPassword: 1,
          }),
        })
      );
      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith("user123");
    });

    it("should reject request without token", async () => {
      // Arrange
      mockRequest.params = {};

      // Act
      await AuthController.completePasswordChange(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Password change token is required.",
        })
      );
    });

    it("should reject expired or invalid token", async () => {
      // Arrange
      mockRequest.params = { token: "expiredtoken123" };

      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue("hashedexpiredtoken123"),
      };
      vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);

      vi.mocked(User.findOne).mockImplementation(
        () =>
          ({
            select: vi.fn().mockResolvedValue(null),
          } as any)
      );

      // Act
      await AuthController.completePasswordChange(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Password change token is invalid or has expired.",
        })
      );
    });

    it("should reject when no pending password found", async () => {
      // Arrange
      mockRequest.params = { token: "validtoken123" };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        passwordChangeToken: "hashedtoken123",
        passwordChangeExpires: new Date(Date.now() + 600000),
        pendingPassword: undefined, // No pending password
      };

      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue("hashedtoken123"),
      };
      vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);

      vi.mocked(User.findOne).mockImplementation(
        () =>
          ({
            select: vi.fn().mockResolvedValue(mockUser),
          } as any)
      );

      // Act
      await AuthController.completePasswordChange(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "No pending password change found.",
        })
      );
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      mockRequest.params = { token: "validtoken123" };

      vi.mocked(User.findOne).mockImplementation(
        () =>
          ({
            select: vi.fn().mockRejectedValue(new Error("Database error")),
          } as any)
      );

      // Act
      await AuthController.completePasswordChange(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Password change completion failed.",
        })
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../../../src/models";
import {
  TokenService,
  authenticate,
  authorize,
  authorizeRoles,
  authorizeMinimumRole,
} from "../../../src/middleware/auth";
import { ROLES, RoleUtils } from "../../../src/utils/roleUtils";

// Mock JWT module
vi.mock("jsonwebtoken");

// Mock User model
vi.mock("../../../src/models", () => ({
  User: {
    findById: vi.fn(),
  },
}));

// Mock role utils
vi.mock("../../../src/utils/roleUtils", () => ({
  ROLES: {
    SUPER_ADMIN: "Super Admin",
    ADMINISTRATOR: "Administrator",
    LEADER: "Leader",
    PARTICIPANT: "Participant",
  },
  RoleUtils: {
    hasAnyRole: vi.fn(),
    hasMinimumRole: vi.fn(),
  },
  hasPermission: vi.fn(),
  Permission: {},
}));

// Test helpers
const createMockRequest = (authHeader?: string): Partial<Request> => ({
  headers: authHeader ? { authorization: authHeader } : {},
  user: undefined,
  userId: undefined,
  userRole: undefined,
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

const createMockNext = (): NextFunction => vi.fn() as any;

const mockUser = {
  _id: "user123",
  email: "test@example.com",
  username: "testuser",
  role: "Participant",
  isActive: true,
  isVerified: true,
  firstName: "Test",
  lastName: "User",
};

describe("Auth Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default environment variables
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.JWT_ACCESS_EXPIRE = "2h";
    process.env.JWT_REFRESH_EXPIRE = "7d";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("TokenService", () => {
    describe("generateAccessToken", () => {
      it("should generate access token with correct payload", () => {
        const payload = {
          userId: "user123",
          email: "test@example.com",
          role: "Participant",
        };

        const mockToken = "mock-access-token";
        (jwt.sign as any).mockReturnValue(mockToken);

        const result = TokenService.generateAccessToken(payload);

        expect(jwt.sign).toHaveBeenCalledWith(payload, "test-access-secret", {
          expiresIn: "2h",
          issuer: "atcloud-system",
          audience: "atcloud-users",
        });
        expect(result).toBe(mockToken);
      });

      it("should use default secret if env var not set", () => {
        delete process.env.JWT_ACCESS_SECRET;
        const payload = {
          userId: "user123",
          email: "test@example.com",
          role: "Participant",
        };

        TokenService.generateAccessToken(payload);

        expect(jwt.sign).toHaveBeenCalledWith(
          payload,
          "your-access-secret-key",
          expect.any(Object)
        );
      });
    });

    describe("generateRefreshToken", () => {
      it("should generate refresh token with correct payload", () => {
        const payload = { userId: "user123" };
        const mockToken = "mock-refresh-token";
        (jwt.sign as any).mockReturnValue(mockToken);

        const result = TokenService.generateRefreshToken(payload);

        expect(jwt.sign).toHaveBeenCalledWith(payload, "test-refresh-secret", {
          expiresIn: "7d",
          issuer: "atcloud-system",
          audience: "atcloud-users",
        });
        expect(result).toBe(mockToken);
      });
    });

    describe("verifyAccessToken", () => {
      it("should verify valid access token", () => {
        const token = "valid-token";
        const mockPayload = { userId: "user123", email: "test@example.com" };
        (jwt.verify as any).mockReturnValue(mockPayload);

        const result = TokenService.verifyAccessToken(token);

        expect(jwt.verify).toHaveBeenCalledWith(token, "test-access-secret", {
          issuer: "atcloud-system",
          audience: "atcloud-users",
        });
        expect(result).toEqual(mockPayload);
      });

      it("should throw error for invalid token", () => {
        const token = "invalid-token";
        (jwt.verify as any).mockImplementation(() => {
          throw new Error("Invalid token");
        });

        expect(() => TokenService.verifyAccessToken(token)).toThrow(
          "Invalid access token"
        );
      });
    });

    describe("verifyRefreshToken", () => {
      it("should verify valid refresh token", () => {
        const token = "valid-refresh-token";
        const mockPayload = { userId: "user123" };
        (jwt.verify as any).mockReturnValue(mockPayload);

        const result = TokenService.verifyRefreshToken(token);

        expect(jwt.verify).toHaveBeenCalledWith(token, "test-refresh-secret", {
          issuer: "atcloud-system",
          audience: "atcloud-users",
        });
        expect(result).toEqual(mockPayload);
      });

      it("should throw error for invalid refresh token", () => {
        const token = "invalid-refresh-token";
        (jwt.verify as any).mockImplementation(() => {
          throw new Error("Invalid token");
        });

        expect(() => TokenService.verifyRefreshToken(token)).toThrow(
          "Invalid refresh token"
        );
      });
    });

    describe("generateTokenPair", () => {
      it("should generate both access and refresh tokens", () => {
        const mockAccessToken = "mock-access-token";
        const mockRefreshToken = "mock-refresh-token";

        (jwt.sign as any)
          .mockReturnValueOnce(mockAccessToken)
          .mockReturnValueOnce(mockRefreshToken);

        const result = TokenService.generateTokenPair(mockUser as any);

        expect(result).toEqual({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
          accessTokenExpires: expect.any(Date),
          refreshTokenExpires: expect.any(Date),
        });

        // Verify access token generation
        expect(jwt.sign).toHaveBeenCalledWith(
          {
            userId: "user123",
            email: "test@example.com",
            role: "Participant",
          },
          "test-access-secret",
          expect.any(Object)
        );

        // Verify refresh token generation
        expect(jwt.sign).toHaveBeenCalledWith(
          { userId: "user123" },
          "test-refresh-secret",
          expect.any(Object)
        );
      });
    });

    describe("decodeToken", () => {
      it("should decode token without verification", () => {
        const token = "some-token";
        const mockPayload = { userId: "user123", exp: Date.now() };
        (jwt.decode as any).mockReturnValue(mockPayload);

        const result = TokenService.decodeToken(token);

        expect(jwt.decode).toHaveBeenCalledWith(token);
        expect(result).toEqual(mockPayload);
      });
    });
  });

  describe("authenticate middleware", () => {
    it("should authenticate valid user successfully", async () => {
      const req = createMockRequest("Bearer valid-token") as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      const mockDecoded = { userId: "user123", email: "test@example.com" };
      (jwt.verify as any).mockReturnValue(mockDecoded);

      const mockUserQuery = {
        select: vi.fn().mockResolvedValue(mockUser),
      };
      (User.findById as any).mockReturnValue(mockUserQuery);

      await authenticate(req, res, next);

      expect(User.findById).toHaveBeenCalledWith("user123");
      expect(mockUserQuery.select).toHaveBeenCalledWith("+password");
      expect(req.user).toEqual(mockUser);
      expect(req.userId).toBe("user123");
      expect(req.userRole).toBe("Participant");
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 when no authorization header provided", async () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Access denied. No token provided or invalid format.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when authorization header does not start with Bearer", async () => {
      const req = createMockRequest("Basic invalid-format") as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Access denied. No token provided or invalid format.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when token is empty", async () => {
      const req = createMockRequest("Bearer ") as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Access denied. Token is missing.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when user not found", async () => {
      const req = createMockRequest("Bearer valid-token") as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      const mockDecoded = { userId: "user123" };
      (jwt.verify as any).mockReturnValue(mockDecoded);

      const mockUserQuery = {
        select: vi.fn().mockResolvedValue(null),
      };
      (User.findById as any).mockReturnValue(mockUserQuery);

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid token. User not found or inactive.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when user is inactive", async () => {
      const req = createMockRequest("Bearer valid-token") as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      const mockDecoded = { userId: "user123" };
      (jwt.verify as any).mockReturnValue(mockDecoded);

      const inactiveUser = { ...mockUser, isActive: false };
      const mockUserQuery = {
        select: vi.fn().mockResolvedValue(inactiveUser),
      };
      (User.findById as any).mockReturnValue(mockUserQuery);

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid token. User not found or inactive.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 when user is not verified", async () => {
      const req = createMockRequest("Bearer valid-token") as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      const mockDecoded = { userId: "user123" };
      (jwt.verify as any).mockReturnValue(mockDecoded);

      const unverifiedUser = { ...mockUser, isVerified: false };
      const mockUserQuery = {
        select: vi.fn().mockResolvedValue(unverifiedUser),
      };
      (User.findById as any).mockReturnValue(mockUserQuery);

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Account not verified. Please verify your email address.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for JsonWebTokenError", async () => {
      const req = createMockRequest("Bearer invalid-token") as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      const error = new Error("Invalid token");
      error.name = "JsonWebTokenError";

      // Mock TokenService.verifyAccessToken to throw the error
      vi.spyOn(TokenService, "verifyAccessToken").mockImplementation(() => {
        throw error;
      });

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid token format.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for TokenExpiredError", async () => {
      const req = createMockRequest("Bearer expired-token") as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      const error = new Error("Token expired");
      error.name = "TokenExpiredError";

      // Mock TokenService.verifyAccessToken to throw the error
      vi.spyOn(TokenService, "verifyAccessToken").mockImplementation(() => {
        throw error;
      });

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Token has expired.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for other authentication errors", async () => {
      const req = createMockRequest("Bearer some-token") as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      vi.spyOn(TokenService, "verifyAccessToken").mockImplementation(() => {
        throw new Error("Some other error");
      });

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication failed.",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("authorize middleware", () => {
    it("should allow access for user with correct role", () => {
      const authorizeMiddleware = authorize("Administrator", "Leader");
      const req = { user: { role: "Administrator" } } as unknown as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      authorizeMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 when user not authenticated", () => {
      const authorizeMiddleware = authorize("Administrator");
      const req = {} as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      authorizeMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 when user role not authorized", () => {
      const authorizeMiddleware = authorize("Administrator");
      const req = { user: { role: "Participant" } } as unknown as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      authorizeMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions.",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("authorizeRoles middleware", () => {
    it("should allow access when user has one of the required roles", () => {
      // Mock RoleUtils.hasAnyRole to return true
      vi.mocked(RoleUtils.hasAnyRole).mockReturnValue(true);

      const authorizeMiddleware = authorizeRoles(
        ROLES.ADMINISTRATOR,
        ROLES.LEADER
      );
      const req = { user: { role: "Administrator" } } as unknown as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      authorizeMiddleware(req, res, next);

      expect(RoleUtils.hasAnyRole).toHaveBeenCalledWith("Administrator", [
        ROLES.ADMINISTRATOR,
        ROLES.LEADER,
      ]);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 when user not authenticated", () => {
      const authorizeMiddleware = authorizeRoles(
        ROLES.ADMINISTRATOR,
        ROLES.LEADER
      );
      const req = {} as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      authorizeMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 when user does not have required role", () => {
      // Mock RoleUtils.hasAnyRole to return false
      vi.mocked(RoleUtils.hasAnyRole).mockReturnValue(false);

      const authorizeMiddleware = authorizeRoles(
        ROLES.ADMINISTRATOR,
        ROLES.LEADER
      );
      const req = { user: { role: "Participant" } } as unknown as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      authorizeMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: `Access denied. Required roles: ${ROLES.ADMINISTRATOR} or ${ROLES.LEADER}`,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("authorizeMinimumRole middleware", () => {
    it("should allow access when user has minimum role or higher", () => {
      // Mock RoleUtils.hasMinimumRole to return true
      vi.mocked(RoleUtils.hasMinimumRole).mockReturnValue(true);

      const authorizeMiddleware = authorizeMinimumRole(ROLES.LEADER);
      const req = { user: { role: "Administrator" } } as unknown as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      authorizeMiddleware(req, res, next);

      expect(RoleUtils.hasMinimumRole).toHaveBeenCalledWith(
        "Administrator",
        ROLES.LEADER
      );
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 when user not authenticated", () => {
      const authorizeMiddleware = authorizeMinimumRole(ROLES.LEADER);
      const req = {} as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      authorizeMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 when user does not have minimum role", () => {
      // Mock RoleUtils.hasMinimumRole to return false
      vi.mocked(RoleUtils.hasMinimumRole).mockReturnValue(false);

      const authorizeMiddleware = authorizeMinimumRole(ROLES.LEADER);
      const req = { user: { role: "Participant" } } as unknown as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      authorizeMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: `Access denied. Minimum required role: ${ROLES.LEADER}`,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Method Existence Tests", () => {
    it("should have TokenService class", () => {
      expect(TokenService).toBeDefined();
    });

    it("should have authenticate middleware", () => {
      expect(authenticate).toBeDefined();
      expect(typeof authenticate).toBe("function");
    });

    it("should have authorize middleware", () => {
      expect(authorize).toBeDefined();
      expect(typeof authorize).toBe("function");
    });

    it("should have authorizeRoles middleware", () => {
      expect(authorizeRoles).toBeDefined();
      expect(typeof authorizeRoles).toBe("function");
    });

    it("should have authorizeMinimumRole middleware", () => {
      expect(authorizeMinimumRole).toBeDefined();
      expect(typeof authorizeMinimumRole).toBe("function");
    });
  });
});

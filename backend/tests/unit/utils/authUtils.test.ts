import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import {
  AuthUtils,
  requireAuth,
  requirePermission,
} from "../../../src/utils/authUtils";
import { PERMISSIONS } from "../../../src/utils/roleUtils";
import { createErrorResponse } from "../../../src/types/api";

// Mock the createErrorResponse function
vi.mock("../../../src/types/api", () => ({
  createErrorResponse: vi.fn((message, statusCode) => ({
    success: false,
    message,
  })),
}));

// Mock the roleUtils module
vi.mock("../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    VIEW_SYSTEM_ANALYTICS: "view_system_analytics",
    MANAGE_USERS: "manage_users",
    CREATE_EVENT: "create_event",
  },
}));

// Import the mocked function for use in tests
import { hasPermission } from "../../../src/utils/roleUtils";
const mockHasPermission = vi.mocked(hasPermission);

describe("AuthUtils", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn() as unknown as NextFunction;

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe("validateAuth", () => {
    it("should return valid result when user is authenticated", () => {
      // Arrange
      const mockUser = {
        id: "65f1e2d3c4b5a6f7e8d9c1b0",
        email: "test@example.com",
        role: "Administrator",
      } as any;
      (mockRequest as any).user = mockUser;

      // Act
      const result = AuthUtils.validateAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should return invalid result and send 401 when user is not present", () => {
      // Arrange
      (mockRequest as any).user = undefined;

      // Act
      const result = AuthUtils.validateAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.user).toBeNull();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(createErrorResponse).toHaveBeenCalledWith(
        "Authentication required",
        401
      );
    });

    it("should return invalid result when user has no id", () => {
      // Arrange
      (mockRequest as any).user = {
        email: "test@example.com",
        role: "Administrator",
      } as any; // Missing id

      // Act
      const result = AuthUtils.validateAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.user).toBeNull();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("should return invalid result when user id is empty string", () => {
      // Arrange
      (mockRequest as any).user = {
        id: "",
        email: "test@example.com",
        role: "Administrator",
      } as any;

      // Act
      const result = AuthUtils.validateAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.user).toBeNull();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe("validateAuthAndPermission", () => {
    const mockUser = {
      id: "65f1e2d3c4b5a6f7e8d9c1b0",
      email: "test@example.com",
      role: "Administrator",
    } as any;

    beforeEach(() => {
      // Reset hasPermission mock
      mockHasPermission.mockReset();
    });

    it("should return valid result when user is authenticated and has permission", () => {
      // Arrange
      (mockRequest as any).user = mockUser;
      mockHasPermission.mockReturnValue(true);

      // Act
      const result = AuthUtils.validateAuthAndPermission(
        mockRequest as Request,
        mockResponse as Response,
        PERMISSIONS.VIEW_SYSTEM_ANALYTICS
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(hasPermission).toHaveBeenCalledWith(
        mockUser.role,
        PERMISSIONS.VIEW_SYSTEM_ANALYTICS
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should return invalid result when user is not authenticated", () => {
      // Arrange
      (mockRequest as any).user = undefined;

      // Act
      const result = AuthUtils.validateAuthAndPermission(
        mockRequest as Request,
        mockResponse as Response,
        PERMISSIONS.VIEW_SYSTEM_ANALYTICS
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("should return invalid result and send 403 when user lacks permission", () => {
      // Arrange
      (mockRequest as any).user = mockUser;
      mockHasPermission.mockReturnValue(false);

      // Act
      const result = AuthUtils.validateAuthAndPermission(
        mockRequest as Request,
        mockResponse as Response,
        PERMISSIONS.MANAGE_USERS
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.user).toEqual(mockUser);
      expect(hasPermission).toHaveBeenCalledWith(
        mockUser.role,
        PERMISSIONS.MANAGE_USERS
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(createErrorResponse).toHaveBeenCalledWith(
        "Insufficient permissions",
        403
      );
    });

    it("should handle different permission types", () => {
      // Arrange
      (mockRequest as any).user = mockUser;
      mockHasPermission.mockReturnValue(true);

      // Act
      const result = AuthUtils.validateAuthAndPermission(
        mockRequest as Request,
        mockResponse as Response,
        PERMISSIONS.CREATE_EVENT
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(hasPermission).toHaveBeenCalledWith(
        mockUser.role,
        PERMISSIONS.CREATE_EVENT
      );
    });
  });

  describe("validateObjectId", () => {
    // Mock mongoose dynamically in each test
    const mockMongoose = {
      Types: {
        ObjectId: {
          isValid: vi.fn(),
        },
      },
    };

    beforeEach(() => {
      // Mock the require call for mongoose in the function
      vi.doMock("mongoose", () => mockMongoose);
      mockMongoose.Types.ObjectId.isValid.mockReset();
    });

    it("should return valid result for valid ObjectId", () => {
      // Arrange
      const validId = "65f1e2d3c4b5a6f7e8d9c1b0";
      mockMongoose.Types.ObjectId.isValid.mockReturnValue(true);

      // Act
      const result = AuthUtils.validateObjectId(validId);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return invalid result for invalid ObjectId", () => {
      // Arrange
      const invalidId = "invalid-id";
      mockMongoose.Types.ObjectId.isValid.mockReturnValue(false);

      // Act
      const result = AuthUtils.validateObjectId(invalidId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid ID format");
    });

    it("should use custom field name in error message", () => {
      // Arrange
      const invalidId = "invalid-id";
      const fieldName = "User ID";
      mockMongoose.Types.ObjectId.isValid.mockReturnValue(false);

      // Act
      const result = AuthUtils.validateObjectId(invalidId, fieldName);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid User ID format");
    });

    it("should handle empty string ObjectId", () => {
      // Arrange
      const emptyId = "";
      mockMongoose.Types.ObjectId.isValid.mockReturnValue(false);

      // Act
      const result = AuthUtils.validateObjectId(emptyId);

      // Assert
      expect(result.isValid).toBe(false);
    });
  });

  describe("canAccessResource", () => {
    const superAdminUser = {
      id: "65f1e2d3c4b5a6f7e8d9c1b0",
      role: "Super Admin",
    } as any;

    const adminUser = {
      id: "65f1e2d3c4b5a6f7e8d9c1b1",
      role: "Administrator",
    } as any;

    const leaderUser = {
      id: "65f1e2d3c4b5a6f7e8d9c1b2",
      role: "Leader",
    } as any;

    const participantUser = {
      id: "65f1e2d3c4b5a6f7e8d9c1b3",
      role: "Participant",
    } as any;

    describe("Super Admin access", () => {
      it("should allow Super Admin to access any resource", () => {
        expect(
          AuthUtils.canAccessResource(superAdminUser, "any-resource-id", false)
        ).toBe(true);
        expect(
          AuthUtils.canAccessResource(superAdminUser, "any-resource-id", true)
        ).toBe(true);
      });
    });

    describe("Administrator access", () => {
      it("should allow Administrator to access any resource", () => {
        expect(
          AuthUtils.canAccessResource(adminUser, "any-resource-id", false)
        ).toBe(true);
        expect(
          AuthUtils.canAccessResource(adminUser, "any-resource-id", true)
        ).toBe(true);
      });
    });

    describe("Leader access", () => {
      it("should allow Leader to access their own resources", () => {
        expect(
          AuthUtils.canAccessResource(leaderUser, leaderUser.id, false)
        ).toBe(true);
      });

      it("should deny Leader access to other users' resources", () => {
        expect(
          AuthUtils.canAccessResource(leaderUser, "other-user-id", false)
        ).toBe(false);
      });

      it("should deny Leader access to resources requiring admin privileges", () => {
        expect(
          AuthUtils.canAccessResource(leaderUser, leaderUser.id, true)
        ).toBe(false);
      });
    });

    describe("Participant access", () => {
      it("should allow Participant to access their own resources", () => {
        expect(
          AuthUtils.canAccessResource(
            participantUser,
            participantUser.id,
            false
          )
        ).toBe(true);
      });

      it("should deny Participant access to other users' resources", () => {
        expect(
          AuthUtils.canAccessResource(participantUser, "other-user-id", false)
        ).toBe(false);
      });

      it("should deny Participant access to resources requiring admin privileges", () => {
        expect(
          AuthUtils.canAccessResource(participantUser, participantUser.id, true)
        ).toBe(false);
      });
    });

    describe("Edge cases", () => {
      it("should handle when requiresAdmin defaults to false", () => {
        expect(AuthUtils.canAccessResource(leaderUser, leaderUser.id)).toBe(
          true
        );
        expect(AuthUtils.canAccessResource(leaderUser, "other-user-id")).toBe(
          false
        );
      });

      it("should handle empty resource owner ID", () => {
        expect(AuthUtils.canAccessResource(participantUser, "", false)).toBe(
          false
        );
      });
    });
  });

  describe("requireAuth middleware", () => {
    it("should call next() when authentication is valid", () => {
      // Arrange
      const middleware = requireAuth();
      const mockUser = {
        id: "65f1e2d3c4b5a6f7e8d9c1b0",
        role: "Administrator",
      } as any;
      (mockRequest as any).user = mockUser;

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should not call next() when authentication is invalid", () => {
      // Arrange
      const middleware = requireAuth();
      (mockRequest as any).user = undefined;

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe("requirePermission middleware", () => {
    const mockUser = {
      id: "65f1e2d3c4b5a6f7e8d9c1b0",
      role: "Administrator",
    } as any;

    beforeEach(() => {
      mockHasPermission.mockReset();
    });

    it("should call next() when user has required permission", () => {
      // Arrange
      const middleware = requirePermission(PERMISSIONS.VIEW_SYSTEM_ANALYTICS);
      (mockRequest as any).user = mockUser;
      mockHasPermission.mockReturnValue(true);

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockHasPermission).toHaveBeenCalledWith(
        mockUser.role,
        PERMISSIONS.VIEW_SYSTEM_ANALYTICS
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should not call next() when user lacks permission", () => {
      // Arrange
      const middleware = requirePermission(PERMISSIONS.MANAGE_USERS);
      (mockRequest as any).user = mockUser;
      mockHasPermission.mockReturnValue(false);

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockHasPermission).toHaveBeenCalledWith(
        mockUser.role,
        PERMISSIONS.MANAGE_USERS
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it("should not call next() when user is not authenticated", () => {
      // Arrange
      const middleware = requirePermission(PERMISSIONS.VIEW_SYSTEM_ANALYTICS);
      (mockRequest as any).user = undefined;

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complex authentication flow", () => {
      // Arrange
      const mockUser = {
        id: "65f1e2d3c4b5a6f7e8d9c1b0",
        role: "Leader",
      } as any;
      (mockRequest as any).user = mockUser;
      mockHasPermission.mockReturnValue(true);

      // Act - Test authentication validation
      const authResult = AuthUtils.validateAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      // Act - Test permission validation
      const permissionResult = AuthUtils.validateAuthAndPermission(
        mockRequest as Request,
        mockResponse as Response,
        PERMISSIONS.CREATE_EVENT
      );

      // Act - Test resource access
      const resourceAccess = AuthUtils.canAccessResource(
        mockUser,
        mockUser.id,
        false
      );

      // Assert
      expect(authResult.isValid).toBe(true);
      expect(permissionResult.isValid).toBe(true);
      expect(resourceAccess).toBe(true);
    });

    it("should handle authentication failure cascade", () => {
      // Arrange
      (mockRequest as any).user = undefined;

      // Act - Test authentication validation
      const authResult = AuthUtils.validateAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      // Act - Test permission validation (should also fail due to auth)
      const permissionResult = AuthUtils.validateAuthAndPermission(
        mockRequest as Request,
        mockResponse as Response,
        PERMISSIONS.CREATE_EVENT
      );

      // Assert
      expect(authResult.isValid).toBe(false);
      expect(permissionResult.isValid).toBe(false);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });
});

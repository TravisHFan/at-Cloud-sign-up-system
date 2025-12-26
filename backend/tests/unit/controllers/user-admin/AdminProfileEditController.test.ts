import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import AdminProfileEditController from "../../../../src/controllers/user-admin/AdminProfileEditController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  User: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/models/AuditLog", () => ({
  default: {
    create: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  ROLES: {
    SUPER_ADMIN: "Super Admin",
    ADMINISTRATOR: "Administrator",
    LEADER: "Leader",
    STAFF: "Staff",
    PARTICIPANT: "Participant",
  },
}));

vi.mock("../../../../src/utils/avatarCleanup", () => ({
  cleanupOldAvatar: vi.fn(),
}));

vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitUserUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    invalidateUserCache: vi.fn(),
  },
}));

import { User } from "../../../../src/models";
import AuditLog from "../../../../src/models/AuditLog";
import { cleanupOldAvatar } from "../../../../src/utils/avatarCleanup";
import { socketService } from "../../../../src/services/infrastructure/SocketService";
import { CachePatterns } from "../../../../src/services";

interface MockRequest {
  params: Record<string, string>;
  body: Record<string, unknown>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
  ip?: string;
  get?: (header: string) => string;
}

describe("AdminProfileEditController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };

    mockReq = {
      params: { id: "targetUser123" },
      body: {},
      user: {
        _id: "admin123",
        id: "admin123",
        role: "Super Admin",
        email: "admin@test.com",
      },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("Mozilla/5.0"),
    };

    vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("adminEditProfile", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("Authorization", () => {
      it("should return 403 if user is not Super Admin or Administrator", async () => {
        mockReq.user = {
          _id: "user123",
          id: "user123",
          role: "Leader",
          email: "leader@test.com",
        };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "Only Super Admin and Administrator can edit other users' profiles.",
        });
      });

      it("should allow Super Admin", async () => {
        mockReq.user!.role = "Super Admin";
        vi.mocked(User.findById).mockResolvedValue(null);

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).not.toHaveBeenCalledWith(403);
      });

      it("should allow Administrator", async () => {
        mockReq.user!.role = "Administrator";
        vi.mocked(User.findById).mockResolvedValue(null);

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).not.toHaveBeenCalledWith(403);
      });
    });

    describe("Validation", () => {
      it("should return 404 if target user not found", async () => {
        vi.mocked(User.findById).mockResolvedValue(null);

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User not found.",
        });
      });

      it("should return 400 if isAtCloudLeader is true but no roleInAtCloud", async () => {
        vi.mocked(User.findById).mockResolvedValue({
          _id: "targetUser123",
          email: "target@test.com",
          avatar: null,
          phone: null,
          isAtCloudLeader: false,
          roleInAtCloud: null,
        });
        mockReq.body = {
          isAtCloudLeader: true,
          // roleInAtCloud is missing
        };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Role in @Cloud is required for @Cloud co-workers.",
        });
      });
    });

    describe("Successful Update", () => {
      const mockTargetUser = {
        _id: "targetUser123",
        email: "target@test.com",
        username: "targetuser",
        firstName: "Target",
        lastName: "User",
        role: "Participant",
        avatar: "/old-avatar.jpg",
        phone: "123456789",
        isAtCloudLeader: false,
        roleInAtCloud: null,
        isActive: true,
      };

      beforeEach(() => {
        vi.mocked(User.findById).mockResolvedValue(mockTargetUser);
        vi.mocked(cleanupOldAvatar).mockResolvedValue(true);
        vi.mocked(AuditLog.create).mockResolvedValue({} as any);
      });

      it("should update avatar successfully", async () => {
        const updatedUser = {
          ...mockTargetUser,
          avatar: "/new-avatar.jpg",
        };
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser);
        mockReq.body = { avatar: "/new-avatar.jpg" };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
          "targetUser123",
          { $set: { avatar: "/new-avatar.jpg" } },
          { new: true, runValidators: true }
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Profile updated successfully by admin.",
          })
        );
      });

      it("should update phone successfully", async () => {
        const updatedUser = {
          ...mockTargetUser,
          phone: "987654321",
        };
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser);
        mockReq.body = { phone: "987654321" };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
          "targetUser123",
          { $set: { phone: "987654321" } },
          { new: true, runValidators: true }
        );
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should update isAtCloudLeader with roleInAtCloud", async () => {
        const updatedUser = {
          ...mockTargetUser,
          isAtCloudLeader: true,
          roleInAtCloud: "Developer",
        };
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser);
        mockReq.body = {
          isAtCloudLeader: true,
          roleInAtCloud: "Developer",
        };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
          "targetUser123",
          { $set: { isAtCloudLeader: true, roleInAtCloud: "Developer" } },
          { new: true, runValidators: true }
        );
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should unset roleInAtCloud when isAtCloudLeader is set to false", async () => {
        const targetUserWithRole = {
          ...mockTargetUser,
          isAtCloudLeader: true,
          roleInAtCloud: "Developer",
        };
        vi.mocked(User.findById).mockResolvedValue(targetUserWithRole);

        const updatedUser = {
          ...targetUserWithRole,
          isAtCloudLeader: false,
          roleInAtCloud: null,
        };
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser);
        mockReq.body = { isAtCloudLeader: false };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
          "targetUser123",
          { $set: { isAtCloudLeader: false }, $unset: { roleInAtCloud: "" } },
          { new: true, runValidators: true }
        );
      });

      it("should cleanup old avatar when new avatar is provided", async () => {
        const updatedUser = {
          ...mockTargetUser,
          avatar: "/new-avatar.jpg",
        };
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser);
        mockReq.body = { avatar: "/new-avatar.jpg" };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        // Wait for async cleanup - use vi.waitFor for proper async handling
        await vi.waitFor(
          () => {
            expect(cleanupOldAvatar).toHaveBeenCalledWith(
              "targetUser123",
              "/old-avatar.jpg"
            );
          },
          { timeout: 100 }
        );
      });

      it("should create audit log for changes", async () => {
        const updatedUser = {
          ...mockTargetUser,
          phone: "987654321",
        };
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser);
        mockReq.body = { phone: "987654321" };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(AuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            action: "admin_profile_edit",
            actor: expect.objectContaining({
              id: "admin123",
              role: "Super Admin",
              email: "admin@test.com",
            }),
            targetModel: "User",
            targetId: "targetUser123",
            details: expect.objectContaining({
              changes: expect.objectContaining({
                phone: { old: "123456789", new: "987654321" },
              }),
            }),
          })
        );
      });

      it("should emit socket update after profile edit", async () => {
        const updatedUser = {
          ...mockTargetUser,
          phone: "987654321",
        };
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser);
        mockReq.body = { phone: "987654321" };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(socketService.emitUserUpdate).toHaveBeenCalledWith(
          "targetUser123",
          expect.objectContaining({
            type: "profile_edited",
            user: expect.objectContaining({
              id: "targetUser123",
              username: "targetuser",
              email: "target@test.com",
            }),
          })
        );
      });

      it("should invalidate user cache", async () => {
        const updatedUser = {
          ...mockTargetUser,
          phone: "987654321",
        };
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser);
        mockReq.body = { phone: "987654321" };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith(
          "targetUser123"
        );
      });

      it("should return updated user data", async () => {
        const updatedUser = {
          ...mockTargetUser,
          _id: "targetUser123",
          avatar: "/new-avatar.jpg",
          phone: "987654321",
          isAtCloudLeader: true,
          roleInAtCloud: "Developer",
        };
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser);
        mockReq.body = {
          avatar: "/new-avatar.jpg",
          phone: "987654321",
          isAtCloudLeader: true,
          roleInAtCloud: "Developer",
        };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Profile updated successfully by admin.",
          data: {
            id: "targetUser123",
            avatar: "/new-avatar.jpg",
            phone: "987654321",
            isAtCloudLeader: true,
            roleInAtCloud: "Developer",
          },
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 404 if update fails", async () => {
        vi.mocked(User.findById).mockResolvedValue({
          _id: "targetUser123",
          email: "target@test.com",
          avatar: null,
          phone: null,
        });
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(null);
        mockReq.body = { phone: "987654321" };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to update user.",
        });
      });

      it("should return 500 on database error", async () => {
        vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: "Failed to update user profile",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should not fail if audit log creation fails", async () => {
        vi.mocked(User.findById).mockResolvedValue({
          _id: "targetUser123",
          email: "target@test.com",
          username: "targetuser",
          firstName: "Target",
          lastName: "User",
          role: "Participant",
          avatar: null,
          phone: "123456789",
          isActive: true,
        });
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue({
          _id: "targetUser123",
          email: "target@test.com",
          username: "targetuser",
          firstName: "Target",
          lastName: "User",
          role: "Participant",
          avatar: null,
          phone: "987654321",
          isActive: true,
        });
        vi.mocked(AuditLog.create).mockRejectedValue(new Error("Audit failed"));
        mockReq.body = { phone: "987654321" };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to create audit log for admin profile edit:",
          expect.any(Error)
        );
      });

      it("should handle avatar cleanup failure gracefully", async () => {
        vi.mocked(User.findById).mockResolvedValue({
          _id: "targetUser123",
          email: "target@test.com",
          username: "targetuser",
          firstName: "Target",
          lastName: "User",
          role: "Participant",
          avatar: "/old-avatar.jpg",
          phone: null,
          isActive: true,
        });
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue({
          _id: "targetUser123",
          email: "target@test.com",
          username: "targetuser",
          firstName: "Target",
          lastName: "User",
          role: "Participant",
          avatar: "/new-avatar.jpg",
          phone: null,
          isActive: true,
        });
        vi.mocked(cleanupOldAvatar).mockRejectedValue(
          new Error("Cleanup failed")
        );
        mockReq.body = { avatar: "/new-avatar.jpg" };

        await AdminProfileEditController.adminEditProfile(
          mockReq as unknown as Request,
          mockRes as Response
        );

        // Wait for async cleanup failure - use vi.waitFor for proper async handling
        await vi.waitFor(
          () => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
              "Failed to cleanup old avatar during admin edit:",
              expect.any(Error)
            );
          },
          { timeout: 100 }
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });
  });
});

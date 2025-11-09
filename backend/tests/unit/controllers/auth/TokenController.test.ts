import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import TokenController from "../../../../src/controllers/auth/TokenController";
import { User } from "../../../../src/models";
import { TokenService } from "../../../../src/middleware/auth";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  User: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/middleware/auth", () => ({
  TokenService: {
    verifyRefreshToken: vi.fn(),
    generateTokenPair: vi.fn(),
    parseTimeToMs: vi.fn(),
  },
}));

describe("TokenController", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let cookieMock: ReturnType<typeof vi.fn>;

  const userId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    cookieMock = vi.fn();

    mockReq = {
      cookies: {},
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
      cookie: cookieMock as any,
    };

    // Mock console.error
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Default environment
    process.env.NODE_ENV = "test";
    process.env.JWT_REFRESH_EXPIRE = "7d";
  });

  describe("refreshToken", () => {
    describe("validation", () => {
      it("should return 401 if refresh token not provided", async () => {
        mockReq.cookies = {};

        await TokenController.refreshToken(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Refresh token not provided.",
        });
      });

      it("should return 401 if refresh token is invalid", async () => {
        mockReq.cookies = { refreshToken: "invalid-token" };
        vi.mocked(TokenService.verifyRefreshToken).mockReturnValue(null as any);

        await TokenController.refreshToken(
          mockReq as Request,
          mockRes as Response
        );

        expect(TokenService.verifyRefreshToken).toHaveBeenCalledWith(
          "invalid-token"
        );
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid refresh token.",
        });
      });

      it("should return 401 if decoded token has no userId", async () => {
        mockReq.cookies = { refreshToken: "valid-token" };
        vi.mocked(TokenService.verifyRefreshToken).mockReturnValue({} as any);

        await TokenController.refreshToken(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid refresh token.",
        });
      });

      it("should return 401 if user not found", async () => {
        mockReq.cookies = { refreshToken: "valid-token" };
        vi.mocked(TokenService.verifyRefreshToken).mockReturnValue({
          userId: userId.toString(),
        } as any);
        vi.mocked(User.findById).mockResolvedValue(null);

        await TokenController.refreshToken(
          mockReq as Request,
          mockRes as Response
        );

        expect(User.findById).toHaveBeenCalledWith(userId.toString());
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User not found or inactive.",
        });
      });

      it("should return 401 if user is inactive", async () => {
        mockReq.cookies = { refreshToken: "valid-token" };
        vi.mocked(TokenService.verifyRefreshToken).mockReturnValue({
          userId: userId.toString(),
        } as any);

        const mockUser = {
          _id: userId,
          email: "test@example.com",
          isActive: false,
        };

        vi.mocked(User.findById).mockResolvedValue(mockUser as any);

        await TokenController.refreshToken(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User not found or inactive.",
        });
      });
    });

    describe("token generation", () => {
      it("should generate new token pair for valid refresh token", async () => {
        mockReq.cookies = { refreshToken: "valid-refresh-token" };

        vi.mocked(TokenService.verifyRefreshToken).mockReturnValue({
          userId: userId.toString(),
        } as any);

        const mockUser = {
          _id: userId,
          email: "test@example.com",
          isActive: true,
          role: "Member",
        };

        vi.mocked(User.findById).mockResolvedValue(mockUser as any);

        const newTokens = {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          accessTokenExpires: new Date(),
          refreshTokenExpires: new Date(),
        };

        vi.mocked(TokenService.generateTokenPair).mockReturnValue(newTokens);
        vi.mocked(TokenService.parseTimeToMs).mockReturnValue(604800000); // 7 days

        await TokenController.refreshToken(
          mockReq as Request,
          mockRes as Response
        );

        expect(TokenService.generateTokenPair).toHaveBeenCalledWith(mockUser);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
          },
          message: "Token refreshed successfully.",
        });
      });

      it("should set refresh token cookie with correct options", async () => {
        mockReq.cookies = { refreshToken: "valid-refresh-token" };

        vi.mocked(TokenService.verifyRefreshToken).mockReturnValue({
          userId: userId.toString(),
        } as any);

        const mockUser = {
          _id: userId,
          email: "test@example.com",
          isActive: true,
        };

        vi.mocked(User.findById).mockResolvedValue(mockUser as any);

        const newTokens = {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          accessTokenExpires: new Date(),
          refreshTokenExpires: new Date(),
        };

        vi.mocked(TokenService.generateTokenPair).mockReturnValue(newTokens);
        vi.mocked(TokenService.parseTimeToMs).mockReturnValue(604800000);

        await TokenController.refreshToken(
          mockReq as Request,
          mockRes as Response
        );

        expect(cookieMock).toHaveBeenCalledWith(
          "refreshToken",
          "new-refresh-token",
          {
            httpOnly: true,
            secure: false, // NODE_ENV = test
            sameSite: "strict",
            maxAge: 604800000,
          }
        );
      });

      it("should use secure cookie in production", async () => {
        process.env.NODE_ENV = "production";

        mockReq.cookies = { refreshToken: "valid-refresh-token" };

        vi.mocked(TokenService.verifyRefreshToken).mockReturnValue({
          userId: userId.toString(),
        } as any);

        const mockUser = {
          _id: userId,
          email: "test@example.com",
          isActive: true,
        };

        vi.mocked(User.findById).mockResolvedValue(mockUser as any);

        const newTokens = {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          accessTokenExpires: new Date(),
          refreshTokenExpires: new Date(),
        };

        vi.mocked(TokenService.generateTokenPair).mockReturnValue(newTokens);
        vi.mocked(TokenService.parseTimeToMs).mockReturnValue(604800000);

        await TokenController.refreshToken(
          mockReq as Request,
          mockRes as Response
        );

        expect(cookieMock).toHaveBeenCalledWith(
          "refreshToken",
          "new-refresh-token",
          expect.objectContaining({
            secure: true,
          })
        );
      });
    });

    describe("error handling", () => {
      it("should handle token verification errors", async () => {
        mockReq.cookies = { refreshToken: "valid-refresh-token" };

        vi.mocked(TokenService.verifyRefreshToken).mockImplementation(() => {
          throw new Error("Verification failed");
        });

        await TokenController.refreshToken(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Token refresh failed.",
        });
      });

      it("should handle database errors", async () => {
        mockReq.cookies = { refreshToken: "valid-refresh-token" };

        vi.mocked(TokenService.verifyRefreshToken).mockReturnValue({
          userId: userId.toString(),
        } as any);

        vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

        await TokenController.refreshToken(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Token refresh failed.",
        });
      });
    });
  });
});

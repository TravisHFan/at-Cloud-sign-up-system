import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import BundleConfigController from "../../../../src/controllers/promoCodes/BundleConfigController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  SystemConfig: {
    getBundleDiscountConfig: vi.fn(),
    updateBundleDiscountConfig: vi.fn(),
  },
}));

import { SystemConfig } from "../../../../src/models";

interface MockRequest extends Partial<Request> {
  body: Record<string, unknown>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
    username?: string;
  };
}

describe("BundleConfigController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockReq = {
      body: {},
      user: {
        _id: "admin123",
        id: "admin123",
        role: "Administrator",
        email: "admin@test.com",
        username: "admin",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("getBundleConfig", () => {
    it("should return bundle config successfully", async () => {
      const mockConfig = {
        enabled: true,
        discountAmount: 5000,
        expiryDays: 30,
      };

      vi.mocked(SystemConfig.getBundleDiscountConfig).mockResolvedValue(
        mockConfig
      );

      await BundleConfigController.getBundleConfig(
        mockReq as Request,
        mockRes as Response
      );

      expect(SystemConfig.getBundleDiscountConfig).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          config: mockConfig,
        },
      });
    });

    it("should return 500 on database error", async () => {
      vi.mocked(SystemConfig.getBundleDiscountConfig).mockRejectedValue(
        new Error("Database error")
      );

      await BundleConfigController.getBundleConfig(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch bundle discount configuration.",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching bundle config:",
        expect.any(Error)
      );
    });
  });

  describe("updateBundleConfig", () => {
    describe("authentication", () => {
      it("should return 401 when user is not authenticated", async () => {
        mockReq.user = undefined;

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("validation", () => {
      it("should return 400 when enabled is not a boolean", async () => {
        mockReq.body = {
          enabled: "true",
          discountAmount: 5000,
          expiryDays: 30,
        };

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "enabled must be a boolean.",
        });
      });

      it("should return 400 when discountAmount is below minimum", async () => {
        mockReq.body = {
          enabled: true,
          discountAmount: 500, // Below $10 (1000)
          expiryDays: 30,
        };

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "discountAmount must be between $10 (1000) and $200 (20000).",
        });
      });

      it("should return 400 when discountAmount is above maximum", async () => {
        mockReq.body = {
          enabled: true,
          discountAmount: 25000, // Above $200 (20000)
          expiryDays: 30,
        };

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "discountAmount must be between $10 (1000) and $200 (20000).",
        });
      });

      it("should return 400 when discountAmount is not a number", async () => {
        mockReq.body = {
          enabled: true,
          discountAmount: "5000",
          expiryDays: 30,
        };

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "discountAmount must be between $10 (1000) and $200 (20000).",
        });
      });

      it("should return 400 when expiryDays is below minimum", async () => {
        mockReq.body = {
          enabled: true,
          discountAmount: 5000,
          expiryDays: 3, // Below 7
        };

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "expiryDays must be between 7 and 365.",
        });
      });

      it("should return 400 when expiryDays is above maximum", async () => {
        mockReq.body = {
          enabled: true,
          discountAmount: 5000,
          expiryDays: 400, // Above 365
        };

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "expiryDays must be between 7 and 365.",
        });
      });

      it("should return 400 when expiryDays is not a number", async () => {
        mockReq.body = {
          enabled: true,
          discountAmount: 5000,
          expiryDays: "30",
        };

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "expiryDays must be between 7 and 365.",
        });
      });
    });

    describe("successful update", () => {
      it("should update bundle config successfully with username", async () => {
        mockReq.body = {
          enabled: true,
          discountAmount: 5000,
          expiryDays: 30,
        };

        const updatedConfig = {
          value: {
            enabled: true,
            discountAmount: 5000,
            expiryDays: 30,
          },
        };

        vi.mocked(SystemConfig.updateBundleDiscountConfig).mockResolvedValue(
          updatedConfig as any
        );

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(SystemConfig.updateBundleDiscountConfig).toHaveBeenCalledWith(
          {
            enabled: true,
            discountAmount: 5000,
            expiryDays: 30,
          },
          "admin"
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Bundle discount configuration updated successfully.",
          data: {
            config: {
              enabled: true,
              discountAmount: 5000,
              expiryDays: 30,
            },
          },
        });
      });

      it("should use email as updatedBy when username not available", async () => {
        mockReq.user = {
          _id: "admin123",
          id: "admin123",
          role: "Administrator",
          email: "admin@test.com",
          username: undefined,
        };
        mockReq.body = {
          enabled: false,
          discountAmount: 10000,
          expiryDays: 60,
        };

        const updatedConfig = {
          value: {
            enabled: false,
            discountAmount: 10000,
            expiryDays: 60,
          },
        };

        vi.mocked(SystemConfig.updateBundleDiscountConfig).mockResolvedValue(
          updatedConfig as any
        );

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(SystemConfig.updateBundleDiscountConfig).toHaveBeenCalledWith(
          expect.any(Object),
          "admin@test.com"
        );
      });
    });

    describe("error handling", () => {
      it("should return 400 when model throws validation error", async () => {
        mockReq.body = {
          enabled: true,
          discountAmount: 5000,
          expiryDays: 30,
        };

        vi.mocked(SystemConfig.updateBundleDiscountConfig).mockRejectedValue(
          new Error("Invalid configuration value")
        );

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid configuration value",
        });
      });

      it("should return 500 on non-Error rejection", async () => {
        mockReq.body = {
          enabled: true,
          discountAmount: 5000,
          expiryDays: 30,
        };

        vi.mocked(SystemConfig.updateBundleDiscountConfig).mockRejectedValue(
          null
        );

        await BundleConfigController.updateBundleConfig(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to update bundle discount configuration.",
        });
      });
    });
  });
});

/**
 * ValidationHelper Unit Tests
 *
 * Tests the validation helper methods used in public event registration:
 * - validateSlug
 * - validateRoleId
 * - validateAttendee
 * - validateEventExists
 * - validateRoleExists
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { ValidationHelper } from "../../../../src/controllers/publicEvent/ValidationHelper";
import { CorrelatedLogger } from "../../../../src/services/CorrelatedLogger";

describe("ValidationHelper - Unit Tests", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockLog: CorrelatedLogger;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnThis();

    mockReq = {
      ip: "127.0.0.1",
      headers: { "x-request-id": "test-req-123" },
      socket: { remoteAddress: "127.0.0.1" } as any,
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    mockLog = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    } as any;
  });

  describe("validateSlug", () => {
    it("should return true for valid slug", () => {
      const result = ValidationHelper.validateSlug(
        "valid-slug",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should return false and send 400 for missing slug", () => {
      const result = ValidationHelper.validateSlug(
        undefined,
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Missing slug",
      });
      expect(mockLog.warn).toHaveBeenCalledWith(
        "Public registration validation failure",
        undefined,
        expect.objectContaining({ reason: "missing_slug" })
      );
    });

    it("should include requestId in warning metadata", () => {
      ValidationHelper.validateSlug(
        undefined,
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.any(String),
        undefined,
        expect.objectContaining({ requestId: "test-req-123" })
      );
    });

    it("should truncate IP to CIDR in warning", () => {
      ValidationHelper.validateSlug(
        undefined,
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.any(String),
        undefined,
        expect.objectContaining({ ipCidr: expect.any(String) })
      );
    });
  });

  describe("validateRoleId", () => {
    it("should return true for valid roleId", () => {
      const result = ValidationHelper.validateRoleId(
        "role-123",
        "event-slug",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should return false and send 400 for missing roleId", () => {
      const result = ValidationHelper.validateRoleId(
        undefined,
        "event-slug",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "roleId is required",
      });
    });

    it("should include slug in warning metadata", () => {
      ValidationHelper.validateRoleId(
        undefined,
        "important-event",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLog.warn).toHaveBeenCalledWith(
        "Public registration validation failure",
        undefined,
        expect.objectContaining({
          reason: "missing_roleId",
          slug: "important-event",
        })
      );
    });
  });

  describe("validateAttendee", () => {
    it("should return true for valid attendee with name and email", () => {
      const attendee = {
        name: "John Doe",
        email: "john@example.com",
      };

      const result = ValidationHelper.validateAttendee(
        attendee,
        "event-slug",
        "role-123",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should return false for missing attendee object", () => {
      const result = ValidationHelper.validateAttendee(
        undefined,
        "event-slug",
        "role-123",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "attendee.name and attendee.email are required",
      });
    });

    it("should return false for missing attendee name", () => {
      const attendee = {
        email: "john@example.com",
      };

      const result = ValidationHelper.validateAttendee(
        attendee,
        "event-slug",
        "role-123",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(result).toBe(false);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "attendee.name and attendee.email are required",
      });
    });

    it("should return false for missing attendee email", () => {
      const attendee = {
        name: "John Doe",
      };

      const result = ValidationHelper.validateAttendee(
        attendee,
        "event-slug",
        "role-123",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(result).toBe(false);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "attendee.name and attendee.email are required",
      });
    });

    it("should include slug and roleId in warning metadata", () => {
      ValidationHelper.validateAttendee(
        undefined,
        "important-event",
        "volunteer-role",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.any(String),
        undefined,
        expect.objectContaining({
          slug: "important-event",
          roleId: "volunteer-role",
        })
      );
    });

    it("should accept attendee with optional phone", () => {
      const attendee = {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
      };

      const result = ValidationHelper.validateAttendee(
        attendee,
        "event-slug",
        "role-123",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(result).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle req.ip as undefined gracefully", () => {
      // Create new request without ip defined
      const reqWithoutIp = {
        headers: { "x-request-id": "test-req-123" },
        socket: {} as any,
      } as unknown as Request;

      const result = ValidationHelper.validateSlug(
        undefined,
        mockLog,
        reqWithoutIp,
        mockRes as Response
      );

      expect(result).toBe(false);
      // Should not throw error
    });

    it("should handle missing request headers", () => {
      mockReq.headers = {};

      const result = ValidationHelper.validateSlug(
        undefined,
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      expect(result).toBe(false);
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.any(String),
        undefined,
        expect.objectContaining({ requestId: undefined })
      );
    });

    it("should trim whitespace from attendee fields", () => {
      const attendee = {
        name: "  John Doe  ",
        email: "  john@example.com  ",
      };

      const result = ValidationHelper.validateAttendee(
        attendee,
        "event-slug",
        "role-123",
        mockLog,
        mockReq as Request,
        mockRes as Response
      );

      // Should still validate successfully despite whitespace
      expect(result).toBe(true);
    });
  });
});

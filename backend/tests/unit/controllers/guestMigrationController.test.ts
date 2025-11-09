import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { GuestMigrationController } from "../../../src/controllers/guestMigrationController";
import GuestMigrationService from "../../../src/services/GuestMigrationService";
import GuestRegistration from "../../../src/models/GuestRegistration";

// Mock dependencies
vi.mock("../../../src/services/GuestMigrationService");
vi.mock("../../../src/models/GuestRegistration");

describe("GuestMigrationController", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      query: {},
      body: {},
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  describe("getEligibleByEmail", () => {
    describe("validation", () => {
      it("should return 400 when email query parameter is missing", async () => {
        mockReq.query = {};

        await GuestMigrationController.getEligibleByEmail(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required query parameter: email",
        });
      });

      it("should return 400 when email is empty string", async () => {
        mockReq.query = { email: "" };

        await GuestMigrationController.getEligibleByEmail(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required query parameter: email",
        });
      });

      it("should return 400 when email is whitespace only", async () => {
        mockReq.query = { email: "   " };

        await GuestMigrationController.getEligibleByEmail(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required query parameter: email",
        });
      });
    });

    describe("email normalization", () => {
      it("should trim and lowercase the email before calling service", async () => {
        mockReq.query = { email: "  Test@Example.COM  " };

        const mockEligible: any[] = [{ eventId: "event1", roleName: "Guest" }];
        vi.mocked(
          GuestMigrationService.detectGuestRegistrationsByEmail
        ).mockResolvedValue(mockEligible as any);

        await GuestMigrationController.getEligibleByEmail(
          mockReq as Request,
          mockRes as Response
        );

        expect(
          GuestMigrationService.detectGuestRegistrationsByEmail
        ).toHaveBeenCalledWith("test@example.com");
      });
    });

    describe("success response", () => {
      it("should return 200 with eligible guest registrations", async () => {
        mockReq.query = { email: "guest@example.com" };

        const mockEligible: any[] = [
          {
            eventId: "event1",
            eventTitle: "Community Meeting",
            roleName: "Volunteer",
            registrationDate: new Date("2025-01-15"),
          },
          {
            eventId: "event2",
            eventTitle: "Workshop",
            roleName: "Attendee",
            registrationDate: new Date("2025-01-20"),
          },
        ];

        vi.mocked(
          GuestMigrationService.detectGuestRegistrationsByEmail
        ).mockResolvedValue(mockEligible as any);

        await GuestMigrationController.getEligibleByEmail(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockEligible,
        });
      });

      it("should return 200 with empty array when no eligible guests found", async () => {
        mockReq.query = { email: "noguest@example.com" };

        vi.mocked(
          GuestMigrationService.detectGuestRegistrationsByEmail
        ).mockResolvedValue([]);

        await GuestMigrationController.getEligibleByEmail(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: [],
        });
      });
    });

    describe("error handling", () => {
      it("should return 500 when service throws an error", async () => {
        mockReq.query = { email: "test@example.com" };

        vi.mocked(
          GuestMigrationService.detectGuestRegistrationsByEmail
        ).mockRejectedValue(new Error("Database connection failed"));

        await GuestMigrationController.getEligibleByEmail(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Database connection failed",
        });
      });

      it("should return 500 with generic message when error is not Error instance", async () => {
        mockReq.query = { email: "test@example.com" };

        vi.mocked(
          GuestMigrationService.detectGuestRegistrationsByEmail
        ).mockRejectedValue("Unknown error");

        await GuestMigrationController.getEligibleByEmail(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch eligible guests",
        });
      });
    });
  });

  describe("validate", () => {
    describe("validation", () => {
      it("should return 400 when userId is missing", async () => {
        mockReq.body = { email: "test@example.com" };

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required fields: userId, email",
        });
      });

      it("should return 400 when email is missing", async () => {
        mockReq.body = { userId: "user123" };

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required fields: userId, email",
        });
      });

      it("should return 400 when both userId and email are missing", async () => {
        mockReq.body = {};

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required fields: userId, email",
        });
      });

      it("should return 400 when body is undefined", async () => {
        mockReq.body = undefined;

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required fields: userId, email",
        });
      });
    });

    describe("email normalization", () => {
      it("should lowercase email before calling service", async () => {
        mockReq.body = { userId: "user123", email: "Test@Example.COM" };

        const mockResult = {
          ok: true as const,
          count: 3,
        };

        vi.mocked(
          GuestMigrationService.validateMigrationEligibility
        ).mockResolvedValue(mockResult);

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(
          GuestMigrationService.validateMigrationEligibility
        ).toHaveBeenCalledWith("user123", "test@example.com");
      });
    });

    describe("validation success", () => {
      it("should return 200 when migration is eligible", async () => {
        mockReq.body = { userId: "user123", email: "guest@example.com" };

        const mockResult = {
          ok: true as const,
          count: 5,
        };

        vi.mocked(
          GuestMigrationService.validateMigrationEligibility
        ).mockResolvedValue(mockResult);

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
        });
      });

      it("should return 200 with zero eligible count", async () => {
        mockReq.body = { userId: "user123", email: "noguest@example.com" };

        const mockResult = {
          ok: true as const,
          count: 0,
        };

        vi.mocked(
          GuestMigrationService.validateMigrationEligibility
        ).mockResolvedValue(mockResult);

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
        });
      });
    });

    describe("validation failure", () => {
      it("should return 400 when migration is not eligible with reason", async () => {
        mockReq.body = { userId: "user123", email: "guest@example.com" };

        const mockResult: any = {
          ok: false,
          reason: "User already has registrations for these events",
        };

        vi.mocked(
          GuestMigrationService.validateMigrationEligibility
        ).mockResolvedValue(mockResult);

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User already has registrations for these events",
        });
      });

      it("should return 400 when email is already migrated", async () => {
        mockReq.body = { userId: "user123", email: "migrated@example.com" };

        const mockResult: any = {
          ok: false,
          reason: "All guest registrations for this email have been migrated",
        };

        vi.mocked(
          GuestMigrationService.validateMigrationEligibility
        ).mockResolvedValue(mockResult);

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "All guest registrations for this email have been migrated",
        });
      });
    });

    describe("error handling", () => {
      it("should return 500 when service throws an error", async () => {
        mockReq.body = { userId: "user123", email: "test@example.com" };

        vi.mocked(
          GuestMigrationService.validateMigrationEligibility
        ).mockRejectedValue(new Error("Service unavailable"));

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Service unavailable",
        });
      });

      it("should return 500 with generic message when error is not Error instance", async () => {
        mockReq.body = { userId: "user123", email: "test@example.com" };

        vi.mocked(
          GuestMigrationService.validateMigrationEligibility
        ).mockRejectedValue({ code: "UNKNOWN" });

        await GuestMigrationController.validate(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to validate migration eligibility",
        });
      });
    });
  });

  describe("perform", () => {
    describe("validation", () => {
      it("should return 400 when userId is missing", async () => {
        mockReq.body = { email: "test@example.com" };

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required fields: userId, email",
        });
      });

      it("should return 400 when email is missing", async () => {
        mockReq.body = { userId: "user123" };

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required fields: userId, email",
        });
      });

      it("should return 400 when both fields are missing", async () => {
        mockReq.body = {};

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required fields: userId, email",
        });
      });

      it("should return 400 when body is undefined", async () => {
        mockReq.body = undefined;

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing required fields: userId, email",
        });
      });
    });

    describe("email normalization", () => {
      it("should lowercase email before calling service", async () => {
        mockReq.body = { userId: "user123", email: "Guest@Example.COM" };

        const mockResult: any = {
          ok: true,
          modified: 3,
        };

        vi.mocked(
          GuestMigrationService.performGuestToUserMigration
        ).mockResolvedValue(mockResult);
        vi.mocked(GuestRegistration.countDocuments).mockResolvedValue(0);

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(
          GuestMigrationService.performGuestToUserMigration
        ).toHaveBeenCalledWith("user123", "guest@example.com");
        expect(GuestRegistration.countDocuments).toHaveBeenCalledWith({
          email: "guest@example.com",
          migrationStatus: "pending",
        });
      });
    });

    describe("successful migration", () => {
      it("should return 200 with modified count and remaining pending count", async () => {
        mockReq.body = { userId: "user123", email: "guest@example.com" };

        const mockResult: any = {
          ok: true,
          modified: 5,
        };

        vi.mocked(
          GuestMigrationService.performGuestToUserMigration
        ).mockResolvedValue(mockResult);
        vi.mocked(GuestRegistration.countDocuments).mockResolvedValue(2);

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            modified: 5,
            remainingPending: 2,
          },
        });
      });

      it("should return 200 with zero remaining when all guests migrated", async () => {
        mockReq.body = { userId: "user123", email: "guest@example.com" };

        const mockResult: any = {
          ok: true,
          modified: 3,
        };

        vi.mocked(
          GuestMigrationService.performGuestToUserMigration
        ).mockResolvedValue(mockResult);
        vi.mocked(GuestRegistration.countDocuments).mockResolvedValue(0);

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            modified: 3,
            remainingPending: 0,
          },
        });
      });

      it("should return 200 with zero modified when no eligible guests found", async () => {
        mockReq.body = { userId: "user123", email: "noguest@example.com" };

        const mockResult: any = {
          ok: true,
          modified: 0,
        };

        vi.mocked(
          GuestMigrationService.performGuestToUserMigration
        ).mockResolvedValue(mockResult);
        vi.mocked(GuestRegistration.countDocuments).mockResolvedValue(0);

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            modified: 0,
            remainingPending: 0,
          },
        });
      });
    });

    describe("migration failure", () => {
      it("should return 400 when migration service returns not ok", async () => {
        mockReq.body = { userId: "user123", email: "guest@example.com" };

        const mockResult: any = {
          ok: false,
          error: "User already has conflicting registrations",
        };

        vi.mocked(
          GuestMigrationService.performGuestToUserMigration
        ).mockResolvedValue(mockResult);

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User already has conflicting registrations",
        });
      });

      it("should return 400 with validation error message", async () => {
        mockReq.body = { userId: "user123", email: "invalid@example.com" };

        const mockResult: any = {
          ok: false,
          error: "No pending guest registrations found for this email",
        };

        vi.mocked(
          GuestMigrationService.performGuestToUserMigration
        ).mockResolvedValue(mockResult);

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "No pending guest registrations found for this email",
        });
      });
    });

    describe("error handling", () => {
      it("should return 500 when service throws an error", async () => {
        mockReq.body = { userId: "user123", email: "test@example.com" };

        vi.mocked(
          GuestMigrationService.performGuestToUserMigration
        ).mockRejectedValue(new Error("Database transaction failed"));

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Database transaction failed",
        });
      });

      it("should return 500 with generic message when error is not Error instance", async () => {
        mockReq.body = { userId: "user123", email: "test@example.com" };

        vi.mocked(
          GuestMigrationService.performGuestToUserMigration
        ).mockRejectedValue(null);

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to perform migration",
        });
      });

      it("should return 500 when countDocuments fails after successful migration", async () => {
        mockReq.body = { userId: "user123", email: "test@example.com" };

        const mockResult: any = {
          ok: true,
          modified: 3,
        };

        vi.mocked(
          GuestMigrationService.performGuestToUserMigration
        ).mockResolvedValue(mockResult);
        vi.mocked(GuestRegistration.countDocuments).mockRejectedValue(
          new Error("Count query failed")
        );

        await GuestMigrationController.perform(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Count query failed",
        });
      });
    });
  });
});

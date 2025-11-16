/**
 * Unit tests for PublicEventController
 *
 * This controller handles public-facing event registration endpoints, supporting both
 * authenticated users and guest registrations. Tests verify validation, registration
 * flow, idempotency, capacity limits, notification triggers, and error handling.
 *
 * Coverage:
 * - Validation phase (slug, roleId, attendee, consent, role, role public)
 * - Event lookup (publicSlug, publish status, event status)
 * - Registration execution with lock (user vs guest, duplicate detection)
 * - Limit enforcement (user role limit, guest role limit)
 * - Capacity full handling
 * - Response payload structure (registrationId, type, duplicate flag)
 * - Notification triggers (confirmation email, audit log - fire-and-forget)
 * - Real-time cache updates (on non-duplicate success)
 * - Mongoose validation error handling (phone, email, fullName)
 * - Capacity error handling
 * - Generic error handling with Prometheus metrics
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { PublicEventController } from "../../../src/controllers/publicEventController";
import Event from "../../../src/models/Event";
import { ValidationHelper } from "../../../src/controllers/publicEvent/ValidationHelper";
import { RegistrationHelper } from "../../../src/controllers/publicEvent/RegistrationHelper";
import { NotificationHelper } from "../../../src/controllers/publicEvent/NotificationHelper";
import { CacheHelper } from "../../../src/controllers/publicEvent/CacheHelper";
import { CorrelatedLogger } from "../../../src/services/CorrelatedLogger";
import * as PrometheusMetricsService from "../../../src/services/PrometheusMetricsService";
import * as privacyUtils from "../../../src/utils/privacy";

// Mock all dependencies
vi.mock("../../../src/models/Event");
vi.mock("../../../src/controllers/publicEvent/ValidationHelper");
vi.mock("../../../src/controllers/publicEvent/RegistrationHelper");
vi.mock("../../../src/controllers/publicEvent/NotificationHelper");
vi.mock("../../../src/controllers/publicEvent/CacheHelper");
vi.mock("../../../src/services/CorrelatedLogger");
vi.mock("../../../src/services/PrometheusMetricsService");
vi.mock("../../../src/utils/privacy");

describe("PublicEventController", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockLog: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let mockRegistrationAttemptCounter: { inc: ReturnType<typeof vi.fn> };
  let mockRegistrationFailureCounter: { inc: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Prometheus counters
    mockRegistrationAttemptCounter = { inc: vi.fn() };
    mockRegistrationFailureCounter = { inc: vi.fn() };
    vi.mocked(PrometheusMetricsService).registrationAttemptCounter =
      mockRegistrationAttemptCounter as any;
    vi.mocked(PrometheusMetricsService).registrationFailureCounter =
      mockRegistrationFailureCounter as any;

    // Mock privacy utils
    vi.mocked(privacyUtils.truncateIpToCidr).mockReturnValue("192.168.1.0/24");

    // Mock logger
    mockLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    vi.mocked(CorrelatedLogger.fromRequest).mockReturnValue(mockLog as any);

    // Mock request & response
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      params: { slug: "test-event" },
      body: {
        roleId: "role123",
        attendee: {
          name: "John Doe",
          email: "john@example.com",
          phone: "1234567890",
        },
        consent: { termsAccepted: true },
      },
      headers: { "x-request-id": "req-123" },
      ip: "192.168.1.100",
      socket: {} as any,
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  describe("register", () => {
    // ─────────────────────────────────────────────────────────────────────
    // Validation Phase
    // ─────────────────────────────────────────────────────────────────────

    it("should return early if slug validation fails", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(false);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(ValidationHelper.validateSlug).toHaveBeenCalledWith(
        "test-event",
        mockLog,
        mockReq,
        mockRes
      );
      expect(Event.findOne).not.toHaveBeenCalled();
    });

    it("should return early if roleId validation fails", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(false);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(ValidationHelper.validateRoleId).toHaveBeenCalledWith(
        "role123",
        "test-event",
        mockLog,
        mockReq,
        mockRes
      );
      expect(Event.findOne).not.toHaveBeenCalled();
    });

    it("should return early if attendee validation fails", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(false);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(ValidationHelper.validateAttendee).toHaveBeenCalledWith(
        mockReq.body.attendee,
        "test-event",
        "role123",
        mockLog,
        mockReq,
        mockRes
      );
      expect(Event.findOne).not.toHaveBeenCalled();
    });

    it("should return early if consent validation fails", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(false);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(ValidationHelper.validateConsent).toHaveBeenCalledWith(
        mockReq.body.consent,
        "test-event",
        "role123",
        mockLog,
        mockReq,
        mockRes
      );
      expect(Event.findOne).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────
    // Event Lookup & Status Validation
    // ─────────────────────────────────────────────────────────────────────

    it("should return 404 if event not found by slug", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);
      vi.mocked(Event.findOne).mockResolvedValue(null);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(Event.findOne).toHaveBeenCalledWith({
        publicSlug: "test-event",
        publish: true,
      });
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Public event not found",
      });
      expect(mockRegistrationFailureCounter.inc).toHaveBeenCalledWith({
        reason: "not_found",
      });
    });

    it("should return 400 if event status is not 'upcoming'", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "past",
        roles: [],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Registration closed for this event",
      });
      expect(mockRegistrationFailureCounter.inc).toHaveBeenCalledWith({
        reason: "closed",
      });
    });

    it("should return early if role validation fails", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker" }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(false);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(ValidationHelper.validateRole).toHaveBeenCalledWith(
        { id: "role123", name: "Speaker" },
        "role123",
        "test-event",
        mockLog,
        mockReq,
        mockRes
      );
      expect(
        RegistrationHelper.executeRegistrationWithLock
      ).not.toHaveBeenCalled();
    });

    it("should return early if role public validation fails", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: false }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(false);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(ValidationHelper.validateRolePublic).toHaveBeenCalledWith(
        { id: "role123", name: "Speaker", openToPublic: false },
        "role123",
        "test-event",
        mockLog,
        mockReq,
        mockRes
      );
      expect(
        RegistrationHelper.executeRegistrationWithLock
      ).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────
    // Registration Execution & Response
    // ─────────────────────────────────────────────────────────────────────

    it("should successfully register a new user and return response", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const registrationResult = {
        registrationId: "reg123",
        registrationType: "user",
        duplicate: false,
        capacityBefore: 10,
        capacityAfter: 9,
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockResolvedValue(registrationResult as any);

      vi.mocked(NotificationHelper.sendConfirmationEmail).mockResolvedValue(
        undefined as any
      );
      vi.mocked(NotificationHelper.createAuditLog).mockResolvedValue(
        undefined as any
      );
      vi.mocked(CacheHelper.emitRegistrationUpdate).mockResolvedValue(
        undefined
      );

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(
        RegistrationHelper.executeRegistrationWithLock
      ).toHaveBeenCalledWith(
        mockEvent,
        "role123",
        { id: "role123", name: "Speaker", openToPublic: true },
        mockReq.body.attendee
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          status: "ok",
          registrationId: "reg123",
          type: "user",
          duplicate: false,
          message: "Registered successfully",
        },
      });
      expect(mockRegistrationAttemptCounter.inc).toHaveBeenCalled();

      // Verify fire-and-forget notifications called
      expect(NotificationHelper.sendConfirmationEmail).toHaveBeenCalledWith(
        mockEvent,
        "role123",
        mockReq.body.attendee,
        false
      );
      expect(NotificationHelper.createAuditLog).toHaveBeenCalledWith(
        mockEvent,
        "role123",
        mockReq.body.attendee,
        "user",
        false,
        10,
        9,
        "req-123",
        "192.168.1.0/24",
        mockLog,
        null
      );

      // Verify cache update (only on non-duplicate)
      expect(CacheHelper.emitRegistrationUpdate).toHaveBeenCalledWith(
        mockEvent,
        "role123",
        "user",
        "reg123",
        "John Doe",
        mockLog
      );
    });

    it("should successfully register a duplicate and return duplicate flag", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const registrationResult = {
        registrationId: "reg123",
        registrationType: "user",
        duplicate: true,
        capacityBefore: 10,
        capacityAfter: 10,
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockResolvedValue(registrationResult as any);

      vi.mocked(NotificationHelper.sendConfirmationEmail).mockResolvedValue(
        undefined as any
      );
      vi.mocked(NotificationHelper.createAuditLog).mockResolvedValue(
        undefined as any
      );

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          status: "ok",
          registrationId: "reg123",
          type: "user",
          duplicate: true,
          message: "Already registered",
        },
      });

      // Notification should still fire for duplicates
      expect(NotificationHelper.sendConfirmationEmail).toHaveBeenCalledWith(
        mockEvent,
        "role123",
        mockReq.body.attendee,
        true
      );

      // Cache update should NOT fire for duplicates
      expect(CacheHelper.emitRegistrationUpdate).not.toHaveBeenCalled();
    });

    it("should successfully register a guest registration", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Attendee", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const registrationResult = {
        registrationId: "guest-reg123",
        registrationType: "guest",
        duplicate: false,
        capacityBefore: 50,
        capacityAfter: 49,
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockResolvedValue(registrationResult as any);

      vi.mocked(NotificationHelper.sendConfirmationEmail).mockResolvedValue(
        undefined as any
      );
      vi.mocked(NotificationHelper.createAuditLog).mockResolvedValue(
        undefined as any
      );
      vi.mocked(CacheHelper.emitRegistrationUpdate).mockResolvedValue(
        undefined
      );

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          status: "ok",
          registrationId: "guest-reg123",
          type: "guest",
          duplicate: false,
          message: "Registered successfully",
        },
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Limit Enforcement
    // ─────────────────────────────────────────────────────────────────────

    it("should return 400 if user role limit reached", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const registrationResult = {
        limitReached: true,
        limitReachedFor: "user",
        userLimit: 3,
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockResolvedValue(registrationResult as any);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You have reached the 3-role limit for this event.",
      });
      expect(mockRegistrationFailureCounter.inc).toHaveBeenCalledWith({
        reason: "limit_reached",
      });
    });

    it("should return 400 if guest role limit reached", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Attendee", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const registrationResult = {
        limitReached: true,
        limitReachedFor: "guest",
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockResolvedValue(registrationResult as any);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This guest has reached the 1-role limit for this event.",
      });
      expect(mockRegistrationFailureCounter.inc).toHaveBeenCalledWith({
        reason: "limit_reached",
      });
    });

    it("should return 400 if capacity full (no registrationId)", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Attendee", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const registrationResult = {
        registrationId: null,
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockResolvedValue(registrationResult as any);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Unable to register (possibly full capacity)",
      });
      expect(mockRegistrationFailureCounter.inc).toHaveBeenCalledWith({
        reason: "capacity_full",
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Error Handling
    // ─────────────────────────────────────────────────────────────────────

    it("should handle Mongoose validation error for phone (minlength)", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const validationError = {
        name: "ValidationError",
        errors: {
          phone: {
            path: "phone",
            kind: "minlength",
            message: "Phone number too short",
          },
        },
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockRejectedValue(validationError);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLog.warn).toHaveBeenCalledWith(
        "Validation error during registration",
        undefined,
        {
          error: "Phone number must be at least 10 digits",
          field: "phone",
        }
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Phone number must be at least 10 digits",
        field: "phone",
      });
      expect(mockRegistrationFailureCounter.inc).toHaveBeenCalledWith({
        reason: "validation_error",
      });
    });

    it("should handle Mongoose validation error for phone (required)", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const validationError = {
        name: "ValidationError",
        errors: {
          phone: {
            path: "phone",
            kind: "required",
            message: "Phone is required",
          },
        },
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockRejectedValue(validationError);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Phone number is required",
        field: "phone",
      });
    });

    it("should handle Mongoose validation error for email", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const validationError = {
        name: "ValidationError",
        errors: {
          email: {
            path: "email",
            message: "Invalid email format",
          },
        },
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockRejectedValue(validationError);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid email format",
        field: "email",
      });
    });

    it("should handle Mongoose validation error for fullName", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const validationError = {
        name: "ValidationError",
        errors: {
          fullName: {
            path: "fullName",
            message: "Name must be at least 2 characters",
          },
        },
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockRejectedValue(validationError);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Name must be at least 2 characters",
        field: "fullName",
      });
    });

    it("should handle Mongoose validation error with generic message", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const validationError = {
        name: "ValidationError",
        errors: {
          unknownField: {
            path: "unknownField",
            message: "Unknown field error",
          },
        },
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockRejectedValue(validationError);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Unknown field error",
        field: "unknownField",
      });
    });

    it("should handle capacity full error thrown by RegistrationHelper", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockRejectedValue(new Error("Role at full capacity"));

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role is at full capacity",
      });
      expect(mockRegistrationFailureCounter.inc).toHaveBeenCalledWith({
        reason: "capacity_full",
      });
    });

    it("should handle generic error with 500 status", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const genericError = new Error("Database connection lost");
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockRejectedValue(genericError);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLog.error).toHaveBeenCalledWith(
        "register failed",
        genericError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to register",
      });
      expect(mockRegistrationFailureCounter.inc).toHaveBeenCalledWith({
        reason: "other",
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Edge Cases
    // ─────────────────────────────────────────────────────────────────────

    it("should handle missing IP address gracefully", async () => {
      const reqWithoutIp = {
        ...mockReq,
        ip: undefined,
        socket: {} as any, // Empty socket object without remoteAddress
      };

      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const registrationResult = {
        registrationId: "reg123",
        registrationType: "user",
        duplicate: false,
        capacityBefore: 10,
        capacityAfter: 9,
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockResolvedValue(registrationResult as any);

      vi.mocked(NotificationHelper.sendConfirmationEmail).mockResolvedValue(
        undefined as any
      );
      vi.mocked(NotificationHelper.createAuditLog).mockResolvedValue(
        undefined as any
      );
      vi.mocked(CacheHelper.emitRegistrationUpdate).mockResolvedValue(
        undefined
      );

      await PublicEventController.register(
        reqWithoutIp as Request,
        mockRes as Response
      );

      // Should still succeed
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(NotificationHelper.createAuditLog).toHaveBeenCalledWith(
        mockEvent,
        "role123",
        mockReq.body.attendee,
        "user",
        false,
        10,
        9,
        "req-123",
        "192.168.1.0/24", // truncateIpToCidr still called with empty string
        mockLog,
        null
      );
    });

    it("should handle missing x-request-id header gracefully", async () => {
      const reqWithoutRequestId = {
        ...mockReq,
        headers: {},
      };

      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const registrationResult = {
        registrationId: "reg123",
        registrationType: "user",
        duplicate: false,
        capacityBefore: 10,
        capacityAfter: 9,
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockResolvedValue(registrationResult as any);

      vi.mocked(NotificationHelper.sendConfirmationEmail).mockResolvedValue(
        undefined as any
      );
      vi.mocked(NotificationHelper.createAuditLog).mockResolvedValue(
        undefined as any
      );
      vi.mocked(CacheHelper.emitRegistrationUpdate).mockResolvedValue(
        undefined
      );

      await PublicEventController.register(
        reqWithoutRequestId as Request,
        mockRes as Response
      );

      // Should still succeed
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(NotificationHelper.createAuditLog).toHaveBeenCalledWith(
        mockEvent,
        "role123",
        mockReq.body.attendee,
        "user",
        false,
        10,
        9,
        undefined, // requestId should be undefined
        "192.168.1.0/24",
        mockLog,
        null
      );
    });

    it("should handle notification failures silently (fire-and-forget)", async () => {
      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const registrationResult = {
        registrationId: "reg123",
        registrationType: "user",
        duplicate: false,
        capacityBefore: 10,
        capacityAfter: 9,
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockResolvedValue(registrationResult as any);

      // Notifications fail but should not break the flow
      vi.mocked(NotificationHelper.sendConfirmationEmail).mockRejectedValue(
        new Error("Email service unavailable")
      );
      vi.mocked(NotificationHelper.createAuditLog).mockRejectedValue(
        new Error("Audit log service unavailable")
      );
      vi.mocked(CacheHelper.emitRegistrationUpdate).mockResolvedValue(
        undefined
      );

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      // Should still return success
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          status: "ok",
          registrationId: "reg123",
          type: "user",
          duplicate: false,
          message: "Registered successfully",
        },
      });
    });

    it("should handle Prometheus counter failures silently", async () => {
      // Mock Prometheus counters to throw errors
      mockRegistrationAttemptCounter.inc.mockImplementation(() => {
        throw new Error("Prometheus service down");
      });
      mockRegistrationFailureCounter.inc.mockImplementation(() => {
        throw new Error("Prometheus service down");
      });

      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(false);

      await PublicEventController.register(
        mockReq as Request,
        mockRes as Response
      );

      // Should still execute validation (even though counter failed)
      expect(ValidationHelper.validateSlug).toHaveBeenCalled();
    });

    it("should handle undefined attendee name gracefully in cache helper", async () => {
      const reqWithoutAttendeeName = {
        ...mockReq,
        body: {
          roleId: "role123",
          attendee: { email: "john@example.com", phone: "1234567890" },
          consent: { termsAccepted: true },
        },
      };

      vi.mocked(ValidationHelper.validateSlug).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRoleId).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateAttendee).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateConsent).mockReturnValue(true);

      const mockEvent = {
        _id: "event123",
        publicSlug: "test-event",
        status: "upcoming",
        roles: [{ id: "role123", name: "Speaker", openToPublic: true }],
      };
      vi.mocked(Event.findOne).mockResolvedValue(mockEvent as any);
      vi.mocked(ValidationHelper.validateRole).mockReturnValue(true);
      vi.mocked(ValidationHelper.validateRolePublic).mockReturnValue(true);

      const registrationResult = {
        registrationId: "reg123",
        registrationType: "user",
        duplicate: false,
        capacityBefore: 10,
        capacityAfter: 9,
      };
      vi.mocked(
        RegistrationHelper.executeRegistrationWithLock
      ).mockResolvedValue(registrationResult as any);

      vi.mocked(NotificationHelper.sendConfirmationEmail).mockResolvedValue(
        undefined as any
      );
      vi.mocked(NotificationHelper.createAuditLog).mockResolvedValue(
        undefined as any
      );
      vi.mocked(CacheHelper.emitRegistrationUpdate).mockResolvedValue(
        undefined
      );

      await PublicEventController.register(
        reqWithoutAttendeeName as Request,
        mockRes as Response
      );

      expect(CacheHelper.emitRegistrationUpdate).toHaveBeenCalledWith(
        mockEvent,
        "role123",
        "user",
        "reg123",
        undefined, // name is undefined
        mockLog
      );
    });
  });
});

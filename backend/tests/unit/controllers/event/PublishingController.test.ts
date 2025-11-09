import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { PublishingController } from "../../../../src/controllers/event/PublishingController";
import { Event } from "../../../../src/models";
import AuditLog from "../../../../src/models/AuditLog";
import { generateUniquePublicSlug } from "../../../../src/utils/publicSlug";
import { serializePublicEvent } from "../../../../src/utils/publicEventSerializer";
import { validateEventForPublish } from "../../../../src/utils/validatePublish";
import { bumpPublicEventsListVersion } from "../../../../src/services/PublicEventsListCache";
import { ShortLinkService } from "../../../../src/services/ShortLinkService";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/models/AuditLog");
vi.mock("../../../../src/utils/publicSlug");
vi.mock("../../../../src/utils/publicEventSerializer");
vi.mock("../../../../src/utils/validatePublish");
vi.mock("../../../../src/services/PublicEventsListCache");
vi.mock("../../../../src/services/ShortLinkService");
vi.mock("../../../../src/services/LoggerService", () => ({
  Logger: {
    getInstance: vi.fn().mockReturnValue({
      child: vi.fn().mockReturnValue({
        error: vi.fn(),
        warn: vi.fn(),
      }),
    }),
  },
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));
vi.mock("../../../../src/services/PrometheusMetricsService", () => ({
  shortLinkExpireCounter: {
    inc: vi.fn(),
  },
}));

describe("PublishingController", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  const eventId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      params: { id: eventId.toString() },
      user: {
        _id: userId,
        role: "Super Admin",
      },
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  describe("publishEvent", () => {
    describe("validation", () => {
      it("should return 400 for invalid event ID", async () => {
        mockReq.params.id = "invalid-id";

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event id",
        });
      });

      it("should return 400 for missing event ID", async () => {
        mockReq.params.id = "";

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event id",
        });
      });

      it("should return 404 if event not found", async () => {
        vi.mocked(Event.findById).mockResolvedValue(null);

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event not found",
        });
      });

      it("should return 422 when missing required fields for publish", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          format: "In-Person",
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: false,
          errors: [
            {
              code: "MISSING_REQUIRED_FIELDS",
              field: "__aggregate__",
              message: "Missing required fields for publish",
            },
            {
              code: "MISSING",
              field: "location",
              message: "Location is required",
            },
            { code: "MISSING", field: "date", message: "Date is required" },
          ],
        });

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(422);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          code: "MISSING_REQUIRED_FIELDS",
          format: "In-Person",
          missing: ["location", "date"],
          message: "Missing required fields for publish",
          errors: expect.any(Array),
        });
      });

      it("should return 400 for other validation errors", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: false,
          errors: [
            {
              code: "INVALID_FIELD",
              field: "capacity",
              message: "Invalid capacity",
            },
          ],
        });

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Publish validation failed",
          errors: expect.any(Array),
        });
      });
    });

    describe("slug generation", () => {
      it("should generate new publicSlug if missing", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: undefined,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });
        vi.mocked(generateUniquePublicSlug).mockResolvedValue(
          "test-event-abc123"
        );
        vi.mocked(serializePublicEvent).mockResolvedValue({
          id: eventId.toString(),
        } as any);

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(generateUniquePublicSlug).toHaveBeenCalledWith("Test Event");
        expect(mockEvent.publicSlug).toBe("test-event-abc123");
      });

      it("should preserve existing publicSlug", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "existing-slug-xyz",
          publish: true,
          publishedAt: new Date("2024-01-01"),
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });
        vi.mocked(serializePublicEvent).mockResolvedValue({
          id: eventId.toString(),
        } as any);

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(generateUniquePublicSlug).not.toHaveBeenCalled();
        expect(mockEvent.publicSlug).toBe("existing-slug-xyz");
      });
    });

    describe("publish state management", () => {
      it("should set publish=true on first publish", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          publish: false,
          publishedAt: undefined,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });
        vi.mocked(serializePublicEvent).mockResolvedValue({
          id: eventId.toString(),
        } as any);

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockEvent.publish).toBe(true);
        expect(mockEvent.publishedAt).toBeInstanceOf(Date);
        expect(mockEvent.save).toHaveBeenCalled();
      });

      it("should preserve original publishedAt on republish", async () => {
        const originalPublishDate = new Date("2024-01-01");
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          publish: false,
          publishedAt: originalPublishDate,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });
        vi.mocked(serializePublicEvent).mockResolvedValue({
          id: eventId.toString(),
        } as any);

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockEvent.publish).toBe(true);
        expect(mockEvent.publishedAt).toBe(originalPublishDate);
      });

      it("should be idempotent when already published", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          publish: true,
          publishedAt: new Date("2024-01-01"),
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });
        vi.mocked(serializePublicEvent).mockResolvedValue({
          id: eventId.toString(),
        } as any);

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(mockEvent.save).toHaveBeenCalled();
      });
    });

    describe("cache and audit", () => {
      it("should bump public events list cache version", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });
        vi.mocked(serializePublicEvent).mockResolvedValue({
          id: eventId.toString(),
        } as any);

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(bumpPublicEventsListVersion).toHaveBeenCalled();
      });

      it("should create audit log on publish", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });
        vi.mocked(serializePublicEvent).mockResolvedValue({
          id: eventId.toString(),
        } as any);

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(AuditLog.create).toHaveBeenCalledWith({
          action: "EventPublished",
          actorId: userId,
          eventId: eventId,
          metadata: {
            publicSlug: "test-slug",
            eventId: eventId.toString(),
          },
        });
      });

      it("should continue if cache bump fails", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });
        vi.mocked(serializePublicEvent).mockResolvedValue({
          id: eventId.toString(),
        } as any);
        vi.mocked(bumpPublicEventsListVersion).mockImplementation(() => {
          throw new Error("Cache error");
        });

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should continue if audit log fails", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });
        vi.mocked(serializePublicEvent).mockResolvedValue({
          id: eventId.toString(),
        } as any);
        vi.mocked(AuditLog.create).mockRejectedValue(new Error("Audit error"));

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("response", () => {
      it("should return serialized public event payload", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          save: vi.fn().mockResolvedValue({}),
        };

        const serializedPayload = {
          id: eventId.toString(),
          title: "Test Event",
          publicSlug: "test-slug",
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });
        vi.mocked(serializePublicEvent).mockResolvedValue(
          serializedPayload as any
        );

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(serializePublicEvent).toHaveBeenCalledWith(mockEvent);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: serializedPayload,
        });
      });
    });

    describe("error handling", () => {
      it("should handle database errors", async () => {
        vi.mocked(Event.findById).mockRejectedValue(
          new Error("Database error")
        );

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to publish event",
        });
      });

      it("should handle save errors", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          save: vi.fn().mockRejectedValue(new Error("Save failed")),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(validateEventForPublish).mockReturnValue({
          valid: true,
          errors: [],
        });

        await PublishingController.publishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to publish event",
        });
      });
    });
  });

  describe("unpublishEvent", () => {
    describe("validation", () => {
      it("should return 400 for invalid event ID", async () => {
        mockReq.params.id = "invalid-id";

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event id",
        });
      });

      it("should return 404 if event not found", async () => {
        vi.mocked(Event.findById).mockResolvedValue(null);

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event not found",
        });
      });

      it("should be idempotent when already unpublished", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publish: false,
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Already unpublished",
        });
      });
    });

    describe("unpublish state management", () => {
      it("should set publish=false", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          publish: true,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(ShortLinkService.expireAllForEvent).mockResolvedValue(0);

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockEvent.publish).toBe(false);
        expect(mockEvent.save).toHaveBeenCalled();
      });

      it("should preserve publicSlug for future republish", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "stable-slug",
          publish: true,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(ShortLinkService.expireAllForEvent).mockResolvedValue(0);

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockEvent.publicSlug).toBe("stable-slug");
      });
    });

    describe("short link expiration", () => {
      it("should expire all short links for event", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publish: true,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(ShortLinkService.expireAllForEvent).mockResolvedValue(5);

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(ShortLinkService.expireAllForEvent).toHaveBeenCalledWith(
          eventId.toString()
        );
      });

      it("should continue if short link expiration fails", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publish: true,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(ShortLinkService.expireAllForEvent).mockRejectedValue(
          new Error("Expiration failed")
        );

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("cache and audit", () => {
      it("should bump public events list cache version", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publish: true,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(ShortLinkService.expireAllForEvent).mockResolvedValue(0);

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(bumpPublicEventsListVersion).toHaveBeenCalled();
      });

      it("should create audit log on unpublish", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publicSlug: "test-slug",
          publish: true,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(ShortLinkService.expireAllForEvent).mockResolvedValue(0);

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(AuditLog.create).toHaveBeenCalledWith({
          action: "EventUnpublished",
          actorId: userId,
          eventId: eventId,
          metadata: { publicSlug: "test-slug" },
        });
      });

      it("should continue if audit log fails", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publish: true,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(ShortLinkService.expireAllForEvent).mockResolvedValue(0);
        vi.mocked(AuditLog.create).mockRejectedValue(new Error("Audit error"));

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("error handling", () => {
      it("should handle database errors", async () => {
        vi.mocked(Event.findById).mockRejectedValue(
          new Error("Database error")
        );

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to unpublish event",
        });
      });

      it("should handle save errors", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          publish: true,
          save: vi.fn().mockRejectedValue(new Error("Save failed")),
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);

        await PublishingController.unpublishEvent(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to unpublish event",
        });
      });
    });
  });
});

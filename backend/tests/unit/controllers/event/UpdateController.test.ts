import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { UpdateController } from "../../../../src/controllers/event/UpdateController";
import { Event, Program } from "../../../../src/models";
import { CachePatterns } from "../../../../src/services";
import AuditLog from "../../../../src/models/AuditLog";

// Mock all dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
  },
  Registration: {},
  User: {},
  Program: {
    updateOne: vi.fn(),
  },
  Purchase: {},
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
  },
}));

vi.mock("../../../../src/models/AuditLog", () => ({
  default: {
    create: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  PERMISSIONS: {
    EDIT_ANY_EVENT: "edit_any_event",
    EDIT_OWN_EVENT: "edit_own_event",
  },
  ROLES: {
    SUPER_ADMIN: "super-admin",
    ADMIN: "admin",
    LEADER: "leader",
    MEMBER: "member",
    GUEST: "guest",
  },
  hasPermission: vi.fn(),
}));

vi.mock("../../../../src/utils/event/eventPermissions", () => ({
  isEventOrganizer: vi.fn(),
}));

vi.mock("../../../../src/services/event/FieldNormalizationService", () => ({
  FieldNormalizationService: {
    extractSuppressionFlags: vi.fn(() => ({ suppressNotifications: false })),
    prepareUpdateData: vi.fn((body) => body),
    normalizeAndValidate: vi.fn(async (updateData) => updateData || {}),
  },
}));

vi.mock("../../../../src/services/event/RoleUpdateService", () => ({
  RoleUpdateService: {
    processRoleUpdate: vi.fn(async () => ({
      success: true,
      mergedRoles: [],
    })),
  },
}));

vi.mock("../../../../src/services/event/OrganizerManagementService", () => ({
  OrganizerManagementService: vi.fn(() => ({
    trackOldOrganizers: vi.fn(() => []),
    normalizeOrganizerDetails: vi.fn((details) => details),
  })),
}));

vi.mock("../../../../src/services/event/ProgramLinkageService", () => ({
  ProgramLinkageService: {
    extractPreviousLabels: vi.fn(() => []),
    processAndValidate: vi.fn(async () => ({
      success: true,
      programIds: [],
    })),
    toObjectIdArray: vi.fn((ids) => ids),
  },
}));

vi.mock("../../../../src/services/event/AutoUnpublishService", () => ({
  AutoUnpublishService: {
    checkAndApplyAutoUnpublish: vi.fn(async () => ({
      autoUnpublished: false,
      missingFields: [],
    })),
    sendAutoUnpublishNotifications: vi.fn(),
  },
}));

vi.mock(
  "../../../../src/services/event/CoOrganizerNotificationService",
  () => ({
    CoOrganizerNotificationService: {
      sendNewCoOrganizerNotifications: vi.fn(),
    },
  })
);

vi.mock(
  "../../../../src/services/event/ParticipantNotificationService",
  () => ({
    ParticipantNotificationService: {
      sendEventUpdateNotifications: vi.fn(),
    },
  })
);

vi.mock("../../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventWithRegistrations: vi.fn(async (id) => ({
      _id: id,
      title: "Updated Event",
    })),
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      error: vi.fn(),
    })),
  },
}));

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    toIdString: vi.fn((id) => id.toString()),
  },
}));

describe("UpdateController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let mockEvent: any;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock })) as any;

    req = {
      params: { id: "507f1f77bcf86cd799439011" },
      user: {
        _id: "user-id-123",
        role: "admin",
        email: "admin@example.com",
      } as any,
      body: {
        title: "Updated Event",
        description: "Updated description",
      },
      ip: "127.0.0.1",
      get: vi.fn(() => "test-user-agent") as any,
    };

    res = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    mockEvent = {
      _id: "507f1f77bcf86cd799439011",
      title: "Original Event",
      description: "Original description",
      type: "workshop",
      date: new Date("2025-12-01"),
      location: "Test Location",
      status: "draft",
      roles: [],
      organizerDetails: [],
      programLabels: [],
      save: vi.fn().mockResolvedValue(true),
    };
  });

  describe("updateEvent", () => {
    describe("validation", () => {
      it("should return 400 for invalid event ID", async () => {
        req.params = { id: "invalid-id" };

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event ID.",
        });
      });

      it("should return 401 if user is not authenticated", async () => {
        req.user = undefined;

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });

      it("should return 404 if event not found", async () => {
        vi.mocked(Event.findById).mockResolvedValue(null);

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(Event.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event not found.",
        });
      });
    });

    describe("permissions", () => {
      beforeEach(() => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
      });

      it("should return 403 if user lacks edit permissions", async () => {
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        const { isEventOrganizer } = await import(
          "../../../../src/utils/event/eventPermissions"
        );

        vi.mocked(hasPermission).mockReturnValue(false);
        vi.mocked(isEventOrganizer).mockReturnValue(false);

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "Insufficient permissions to edit this event. You must be the event creator or a co-organizer.",
        });
      });

      it("should allow update with EDIT_ANY_EVENT permission", async () => {
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );

        vi.mocked(hasPermission).mockImplementation((role, permission) => {
          return permission === "edit_any_event";
        });

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(mockEvent.save).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow update with EDIT_OWN_EVENT permission if user is organizer", async () => {
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        const { isEventOrganizer } = await import(
          "../../../../src/utils/event/eventPermissions"
        );

        vi.mocked(hasPermission).mockImplementation((role, permission) => {
          return permission === "edit_own_event";
        });
        vi.mocked(isEventOrganizer).mockReturnValue(true);

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(mockEvent.save).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("field normalization", () => {
      beforeEach(async () => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should extract suppression flags and prepare update data", async () => {
        const { FieldNormalizationService } = await import(
          "../../../../src/services/event/FieldNormalizationService"
        );

        req.body = {
          title: "New Title",
          suppressNotifications: true,
        };

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(
          FieldNormalizationService.extractSuppressionFlags
        ).toHaveBeenCalledWith(req.body);
        expect(
          FieldNormalizationService.prepareUpdateData
        ).toHaveBeenCalledWith(req.body);
      });

      it("should normalize and validate fields", async () => {
        const { FieldNormalizationService } = await import(
          "../../../../src/services/event/FieldNormalizationService"
        );

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(
          FieldNormalizationService.normalizeAndValidate
        ).toHaveBeenCalled();
      });

      it("should return early if validation fails", async () => {
        const { FieldNormalizationService } = await import(
          "../../../../src/services/event/FieldNormalizationService"
        );

        vi.mocked(
          FieldNormalizationService.normalizeAndValidate
        ).mockResolvedValue(undefined);

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(mockEvent.save).not.toHaveBeenCalled();
      });
    });

    describe("role management", () => {
      beforeEach(async () => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should process role updates when roles are provided", async () => {
        const { RoleUpdateService } = await import(
          "../../../../src/services/event/RoleUpdateService"
        );

        req.body = {
          roles: [{ name: "Speaker", requirements: [] }],
          forceDeleteRegistrations: false,
        };

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(RoleUpdateService.processRoleUpdate).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011",
          [],
          [{ name: "Speaker", requirements: [] }],
          false
        );
      });

      it("should return error if role update fails", async () => {
        const { RoleUpdateService } = await import(
          "../../../../src/services/event/RoleUpdateService"
        );

        req.body = { roles: [{ name: "Invalid" }] };

        vi.mocked(RoleUpdateService.processRoleUpdate).mockResolvedValue({
          success: false,
          error: {
            status: 400,
            message: "Role update failed",
            errors: ["Invalid role"],
          },
        });

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Role update failed",
          errors: ["Invalid role"],
        });
      });

      it("should handle forceDeleteRegistrations flag", async () => {
        const { RoleUpdateService } = await import(
          "../../../../src/services/event/RoleUpdateService"
        );

        req.body = {
          roles: [],
          forceDeleteRegistrations: true,
        };

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(RoleUpdateService.processRoleUpdate).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Array),
          expect.any(Array),
          true
        );
      });
    });

    describe("organizer management", () => {
      beforeEach(async () => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should track old organizers", async () => {
        const { OrganizerManagementService } = await import(
          "../../../../src/services/event/OrganizerManagementService"
        );

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(OrganizerManagementService).toHaveBeenCalled();
      });

      it("should normalize organizer details when provided", async () => {
        req.body = {
          organizerDetails: [{ userId: "org-1", name: "Organizer 1" }],
        };

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(mockEvent.save).toHaveBeenCalled();
      });
    });

    describe("program linkage", () => {
      beforeEach(async () => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should process and validate program labels", async () => {
        const { ProgramLinkageService } = await import(
          "../../../../src/services/event/ProgramLinkageService"
        );

        req.body = {
          programLabels: ["program-1", "program-2"],
        };

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(ProgramLinkageService.processAndValidate).toHaveBeenCalledWith(
          ["program-1", "program-2"],
          req.user?._id,
          req.user?.role
        );
      });

      it("should return error if program validation fails", async () => {
        const { ProgramLinkageService } = await import(
          "../../../../src/services/event/ProgramLinkageService"
        );

        req.body = { programLabels: ["invalid-program"] };

        vi.mocked(ProgramLinkageService.processAndValidate).mockResolvedValue({
          success: false,
          error: {
            status: 403,
            message: "Program access denied",
            data: {},
          },
        });

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Program access denied",
          data: {},
        });
      });

      it("should sync program events after successful update", async () => {
        const { ProgramLinkageService } = await import(
          "../../../../src/services/event/ProgramLinkageService"
        );

        vi.mocked(ProgramLinkageService.extractPreviousLabels).mockReturnValue([
          "old-program",
        ]);
        vi.mocked(ProgramLinkageService.processAndValidate).mockResolvedValue({
          success: true,
          programIds: ["new-program"],
        });

        req.body = { programLabels: ["new-program"] };

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(Program.updateOne).toHaveBeenCalled();
      });
    });

    describe("auto-unpublish", () => {
      beforeEach(async () => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should check and apply auto-unpublish", async () => {
        const { AutoUnpublishService } = await import(
          "../../../../src/services/event/AutoUnpublishService"
        );

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(
          AutoUnpublishService.checkAndApplyAutoUnpublish
        ).toHaveBeenCalledWith(mockEvent);
      });

      it("should send notifications if auto-unpublished", async () => {
        const { AutoUnpublishService } = await import(
          "../../../../src/services/event/AutoUnpublishService"
        );

        vi.mocked(
          AutoUnpublishService.checkAndApplyAutoUnpublish
        ).mockResolvedValue({
          autoUnpublished: true,
          missingFields: ["description", "location"],
        });

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(
          AutoUnpublishService.sendAutoUnpublishNotifications
        ).toHaveBeenCalledWith(mockEvent, ["description", "location"], req);

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: expect.stringContaining("automatically unpublished"),
          })
        );
      });
    });

    describe("audit logging", () => {
      beforeEach(async () => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should create audit log when event is cancelled", async () => {
        req.body = { status: "cancelled" };
        mockEvent.status = "cancelled";

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(AuditLog.create).toHaveBeenCalledWith({
          action: "event_cancelled",
          actor: {
            id: "user-id-123",
            role: "admin",
            email: "admin@example.com",
          },
          targetModel: "Event",
          targetId: "507f1f77bcf86cd799439011",
          details: expect.objectContaining({
            targetEvent: expect.objectContaining({
              title: "Original Event",
            }),
          }),
          ipAddress: "127.0.0.1",
          userAgent: "test-user-agent",
        });
      });

      it("should still succeed if audit log creation fails", async () => {
        req.body = { status: "cancelled" };
        mockEvent.status = "cancelled";

        vi.mocked(AuditLog.create).mockRejectedValue(
          new Error("Audit log failed")
        );

        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to create audit log for event cancellation:",
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });

    describe("notifications", () => {
      beforeEach(async () => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should send co-organizer notifications", async () => {
        const { CoOrganizerNotificationService } = await import(
          "../../../../src/services/event/CoOrganizerNotificationService"
        );

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(
          CoOrganizerNotificationService.sendNewCoOrganizerNotifications
        ).toHaveBeenCalled();
      });

      it("should send participant notifications", async () => {
        const { ParticipantNotificationService } = await import(
          "../../../../src/services/event/ParticipantNotificationService"
        );

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(
          ParticipantNotificationService.sendEventUpdateNotifications
        ).toHaveBeenCalledWith("507f1f77bcf86cd799439011", mockEvent, req);
      });

      it("should suppress notifications when flag is set", async () => {
        const { FieldNormalizationService } = await import(
          "../../../../src/services/event/FieldNormalizationService"
        );
        const { CoOrganizerNotificationService } = await import(
          "../../../../src/services/event/CoOrganizerNotificationService"
        );

        vi.mocked(
          FieldNormalizationService.extractSuppressionFlags
        ).mockReturnValue({
          suppressNotifications: true,
        });

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(
          CoOrganizerNotificationService.sendNewCoOrganizerNotifications
        ).not.toHaveBeenCalled();
      });
    });

    describe("cache invalidation", () => {
      beforeEach(async () => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should invalidate event and analytics caches", async () => {
        await UpdateController.updateEvent(req as Request, res as Response);

        expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011"
        );
        expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
      });
    });

    describe("response building", () => {
      beforeEach(async () => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should build event response with registrations", async () => {
        const { ResponseBuilderService } = await import(
          "../../../../src/services/ResponseBuilderService"
        );

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(
          ResponseBuilderService.buildEventWithRegistrations
        ).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
      });

      it("should return success response with event data", async () => {
        await UpdateController.updateEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Event updated successfully!",
          data: {
            event: expect.objectContaining({
              _id: "507f1f77bcf86cd799439011",
              title: "Updated Event",
            }),
          },
        });
      });
    });

    describe("error handling", () => {
      beforeEach(async () => {
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        const { hasPermission } = await import(
          "../../../../src/utils/roleUtils"
        );
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should handle validation errors", async () => {
        mockEvent.save.mockRejectedValue({
          name: "ValidationError",
          errors: {
            title: { message: "Title is required" },
          },
        });

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining("Validation failed"),
        });
      });

      it("should handle generic errors", async () => {
        mockEvent.save.mockRejectedValue(new Error("Database error"));

        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        await UpdateController.updateEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to update event.",
        });

        consoleErrorSpy.mockRestore();
      });
    });
  });
});

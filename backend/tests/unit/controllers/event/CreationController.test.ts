import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { CreationController } from "../../../../src/controllers/event/CreationController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: vi.fn(),
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    CREATE_EVENT: "create_event",
  },
  ROLES: {
    SUPER_ADMIN: "super-admin",
    ADMIN: "admin",
    LEADER: "leader",
    MEMBER: "member",
    PARTICIPANT: "participant",
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock(
  "../../../../src/services/event/EventFieldNormalizationService",
  () => ({
    EventFieldNormalizationService: {
      normalizeAndValidate: vi.fn(),
    },
  }),
);

vi.mock("../../../../src/services/event/EventConflictDetectionService", () => ({
  EventConflictDetectionService: {
    checkConflicts: vi.fn(),
  },
}));

vi.mock("../../../../src/services/event/RoleLimitService", () => ({
  RoleLimitService: {
    validateRoleLimits: vi.fn(),
  },
}));

vi.mock("../../../../src/services/event/EventFactoryService", () => ({
  EventFactoryService: {
    createEventDocument: vi.fn(),
    createRecurringSeries: vi.fn(),
  },
}));

vi.mock("../../../../src/services/event/PostCreationService", () => ({
  PostCreationService: {
    handlePostCreation: vi.fn(),
  },
}));

vi.mock("../../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventResponse: vi.fn(),
  },
}));

import { hasPermission } from "../../../../src/utils/roleUtils";

describe("CreationController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock })) as ReturnType<typeof vi.fn>;

    req = {
      body: {},
      user: {
        _id: "user-id-123",
        role: "admin",
      },
    } as unknown as Partial<Request>;

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Partial<Response>;
  });

  describe("createEvent - authentication and authorization", () => {
    it("should return 401 if user is not authenticated", async () => {
      req.user = undefined;

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should return 403 if user lacks CREATE_EVENT permission", async () => {
      vi.mocked(hasPermission).mockReturnValue(false);

      await CreationController.createEvent(req as Request, res as Response);

      expect(hasPermission).toHaveBeenCalledWith("admin", "create_event");
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to create events.",
      });
    });

    it("should proceed with validation when user has CREATE_EVENT permission", async () => {
      vi.mocked(hasPermission).mockReturnValue(true);

      const { EventFieldNormalizationService } =
        await import("../../../../src/services/event/EventFieldNormalizationService");
      vi.mocked(
        EventFieldNormalizationService.normalizeAndValidate,
      ).mockReturnValue({
        valid: false,
        error: { status: 400, message: "Invalid event data" },
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).not.toHaveBeenCalledWith(401);
      expect(statusMock).not.toHaveBeenCalledWith(403);
    });
  });

  describe("createEvent - field normalization errors", () => {
    beforeEach(() => {
      vi.mocked(hasPermission).mockReturnValue(true);
    });

    it("should return 400 for invalid event data", async () => {
      const { EventFieldNormalizationService } =
        await import("../../../../src/services/event/EventFieldNormalizationService");
      vi.mocked(
        EventFieldNormalizationService.normalizeAndValidate,
      ).mockReturnValue({
        valid: false,
        error: { status: 400, message: "Invalid event data" },
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid event data",
      });
    });

    it("should include error data when provided", async () => {
      const { EventFieldNormalizationService } =
        await import("../../../../src/services/event/EventFieldNormalizationService");
      vi.mocked(
        EventFieldNormalizationService.normalizeAndValidate,
      ).mockReturnValue({
        valid: false,
        error: {
          status: 400,
          message: "Missing required fields",
          data: { missingFields: ["title", "date"] },
        },
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Missing required fields",
        data: { missingFields: ["title", "date"] },
      });
    });
  });

  describe("createEvent - conflict detection", () => {
    beforeEach(async () => {
      vi.mocked(hasPermission).mockReturnValue(true);

      const { EventFieldNormalizationService } =
        await import("../../../../src/services/event/EventFieldNormalizationService");
      vi.mocked(
        EventFieldNormalizationService.normalizeAndValidate,
      ).mockReturnValue({
        valid: true,
      });
    });

    it("should return 409 when event time conflicts with existing event", async () => {
      const { EventConflictDetectionService } =
        await import("../../../../src/services/event/EventConflictDetectionService");
      vi.mocked(EventConflictDetectionService.checkConflicts).mockResolvedValue(
        {
          hasConflict: true,
          conflicts: [{ title: "Existing Event", date: "2025-01-01" }],
        },
      );

      req.body = {
        title: "New Event",
        date: "2025-01-01",
        time: "10:00",
        endDate: "2025-01-01",
        endTime: "12:00",
        roles: [],
      };

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "Event time overlaps with existing event(s). Please choose a different time.",
        data: { conflicts: [{ title: "Existing Event", date: "2025-01-01" }] },
      });
    });

    it("should proceed without conflict when no overlapping events", async () => {
      const { EventConflictDetectionService } =
        await import("../../../../src/services/event/EventConflictDetectionService");
      vi.mocked(EventConflictDetectionService.checkConflicts).mockResolvedValue(
        {
          hasConflict: false,
          conflicts: [],
        },
      );

      req.body = {
        title: "New Event",
        date: "2025-01-01",
        time: "10:00",
        endDate: "2025-01-01",
        endTime: "12:00",
        roles: [],
      };

      await CreationController.createEvent(req as Request, res as Response);

      expect(EventConflictDetectionService.checkConflicts).toHaveBeenCalled();
    });
  });

  describe("createEvent - pricing validation", () => {
    beforeEach(async () => {
      vi.mocked(hasPermission).mockReturnValue(true);

      const { EventFieldNormalizationService } =
        await import("../../../../src/services/event/EventFieldNormalizationService");
      vi.mocked(
        EventFieldNormalizationService.normalizeAndValidate,
      ).mockReturnValue({
        valid: true,
      });

      const { EventConflictDetectionService } =
        await import("../../../../src/services/event/EventConflictDetectionService");
      vi.mocked(EventConflictDetectionService.checkConflicts).mockResolvedValue(
        {
          hasConflict: false,
          conflicts: [],
        },
      );
    });

    it("should return 400 for invalid pricing configuration", async () => {
      // Mock validatePricing to return invalid
      vi.doMock("../../../../src/utils/event/eventValidation", () => ({
        validatePricing: vi.fn().mockReturnValue({
          valid: false,
          error: "Price must be at least $1.00",
        }),
      }));

      // Need to re-import after mock change
      vi.resetModules();
      const { CreationController: ReloadedController } =
        await import("../../../../src/controllers/event/CreationController");

      req.body = {
        title: "Test Event",
        date: "2025-01-01",
        time: "10:00",
        endDate: "2025-01-01",
        endTime: "12:00",
        roles: [],
        pricing: { isFree: false, price: 0 },
      };

      // Reset mocks for the reloaded module
      vi.mocked(hasPermission).mockReturnValue(true);

      await ReloadedController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("createEvent - role preparation errors", () => {
    beforeEach(async () => {
      vi.mocked(hasPermission).mockReturnValue(true);

      const { EventFieldNormalizationService } =
        await import("../../../../src/services/event/EventFieldNormalizationService");
      vi.mocked(
        EventFieldNormalizationService.normalizeAndValidate,
      ).mockReturnValue({
        valid: true,
      });

      const { EventConflictDetectionService } =
        await import("../../../../src/services/event/EventConflictDetectionService");
      vi.mocked(EventConflictDetectionService.checkConflicts).mockResolvedValue(
        {
          hasConflict: false,
          conflicts: [],
        },
      );
    });

    it("should return error when role preparation fails", async () => {
      vi.doMock(
        "../../../../src/services/event/EventRolePreparationService",
        () => ({
          EventRolePreparationService: {
            prepareRoles: vi.fn().mockReturnValue({
              valid: false,
              error: {
                status: 400,
                message: "Invalid role configuration",
                errors: ["Role name is required"],
              },
            }),
          },
        }),
      );

      vi.resetModules();
      const { CreationController: ReloadedController } =
        await import("../../../../src/controllers/event/CreationController");

      req.body = {
        title: "Test Event",
        date: "2025-01-01",
        time: "10:00",
        endDate: "2025-01-01",
        endTime: "12:00",
        roles: [{ name: "", maxParticipants: 10 }],
      };

      vi.mocked(hasPermission).mockReturnValue(true);

      await ReloadedController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("createEvent - program linkage errors", () => {
    beforeEach(async () => {
      vi.mocked(hasPermission).mockReturnValue(true);

      const { EventFieldNormalizationService } =
        await import("../../../../src/services/event/EventFieldNormalizationService");
      vi.mocked(
        EventFieldNormalizationService.normalizeAndValidate,
      ).mockReturnValue({
        valid: true,
      });

      const { EventConflictDetectionService } =
        await import("../../../../src/services/event/EventConflictDetectionService");
      vi.mocked(EventConflictDetectionService.checkConflicts).mockResolvedValue(
        {
          hasConflict: false,
          conflicts: [],
        },
      );
    });

    it("should return error when program linkage fails", async () => {
      vi.doMock(
        "../../../../src/services/event/EventRolePreparationService",
        () => ({
          EventRolePreparationService: {
            prepareRoles: vi.fn().mockReturnValue({
              valid: true,
              roles: [{ name: "Attendee", maxParticipants: 10 }],
              totalSlots: 10,
            }),
          },
        }),
      );

      vi.doMock(
        "../../../../src/services/event/EventOrganizerDataService",
        () => ({
          EventOrganizerDataService: {
            processOrganizerDetails: vi.fn().mockReturnValue([]),
          },
        }),
      );

      vi.doMock("../../../../src/utils/event/eventValidation", () => ({
        validatePricing: vi.fn().mockReturnValue({ valid: true }),
      }));

      vi.doMock(
        "../../../../src/services/event/EventProgramLinkageService",
        () => ({
          EventProgramLinkageService: {
            validateAndLinkPrograms: vi.fn().mockResolvedValue({
              valid: false,
              error: {
                status: 403,
                message: "Insufficient permissions for program",
                data: { programId: "program-123" },
              },
            }),
          },
        }),
      );

      vi.resetModules();
      const { CreationController: ReloadedController } =
        await import("../../../../src/controllers/event/CreationController");

      req.body = {
        title: "Test Event",
        date: "2025-01-01",
        time: "10:00",
        endDate: "2025-01-01",
        endTime: "12:00",
        roles: [{ name: "Attendee", maxParticipants: 10 }],
        programLabels: ["program-123"],
      };

      vi.mocked(hasPermission).mockReturnValue(true);

      await ReloadedController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });

  describe("createEvent - co-organizer access validation", () => {
    beforeEach(async () => {
      vi.mocked(hasPermission).mockReturnValue(true);

      const { EventFieldNormalizationService } =
        await import("../../../../src/services/event/EventFieldNormalizationService");
      vi.mocked(
        EventFieldNormalizationService.normalizeAndValidate,
      ).mockReturnValue({
        valid: true,
      });

      const { EventConflictDetectionService } =
        await import("../../../../src/services/event/EventConflictDetectionService");
      vi.mocked(EventConflictDetectionService.checkConflicts).mockResolvedValue(
        {
          hasConflict: false,
          conflicts: [],
        },
      );
    });

    it("should return error when co-organizer lacks program access", async () => {
      vi.doMock(
        "../../../../src/services/event/EventRolePreparationService",
        () => ({
          EventRolePreparationService: {
            prepareRoles: vi.fn().mockReturnValue({
              valid: true,
              roles: [{ name: "Attendee", maxParticipants: 10 }],
              totalSlots: 10,
            }),
          },
        }),
      );

      vi.doMock(
        "../../../../src/services/event/EventOrganizerDataService",
        () => ({
          EventOrganizerDataService: {
            processOrganizerDetails: vi
              .fn()
              .mockReturnValue([
                { userId: "co-org-123", name: "Co Organizer" },
              ]),
          },
        }),
      );

      vi.doMock("../../../../src/utils/event/eventValidation", () => ({
        validatePricing: vi.fn().mockReturnValue({ valid: true }),
      }));

      vi.doMock(
        "../../../../src/services/event/EventProgramLinkageService",
        () => ({
          EventProgramLinkageService: {
            validateAndLinkPrograms: vi.fn().mockResolvedValue({
              valid: true,
              validatedProgramLabels: ["program-123"],
              linkedPrograms: [{ _id: "program-123" }],
            }),
            linkEventToPrograms: vi.fn().mockResolvedValue(undefined),
          },
        }),
      );

      vi.doMock(
        "../../../../src/services/event/CoOrganizerProgramAccessService",
        () => ({
          CoOrganizerProgramAccessService: {
            validateCoOrganizerAccess: vi.fn().mockResolvedValue({
              valid: false,
              error: {
                status: 403,
                message: "Co-organizer lacks access to paid program",
                data: { coOrganizer: "Co Organizer", program: "Test Program" },
              },
            }),
          },
        }),
      );

      vi.resetModules();
      const { CreationController: ReloadedController } =
        await import("../../../../src/controllers/event/CreationController");

      req.body = {
        title: "Test Event",
        date: "2025-01-01",
        time: "10:00",
        endDate: "2025-01-01",
        endTime: "12:00",
        roles: [{ name: "Attendee", maxParticipants: 10 }],
        programLabels: ["program-123"],
        organizerDetails: [{ userId: "co-org-123", name: "Co Organizer" }],
      };

      vi.mocked(hasPermission).mockReturnValue(true);

      await ReloadedController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });

  describe("createEvent - error handling", () => {
    beforeEach(() => {
      vi.mocked(hasPermission).mockReturnValue(true);
    });

    it("should handle internal server errors", async () => {
      const { EventFieldNormalizationService } =
        await import("../../../../src/services/event/EventFieldNormalizationService");
      vi.mocked(
        EventFieldNormalizationService.normalizeAndValidate,
      ).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to create event.",
      });
    });

    it("should handle mongoose validation errors", async () => {
      const { EventFieldNormalizationService } =
        await import("../../../../src/services/event/EventFieldNormalizationService");

      const validationError = {
        name: "ValidationError",
        errors: {
          title: { message: "Title is required" },
          date: { message: "Date is required" },
        },
      };

      vi.mocked(
        EventFieldNormalizationService.normalizeAndValidate,
      ).mockImplementation(() => {
        throw validationError;
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Validation failed.",
        errors: ["Title is required", "Date is required"],
      });
    });
  });
});

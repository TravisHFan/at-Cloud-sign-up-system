/**
 * Tests for CreationController - Error paths for pricing, role preparation,
 * program linkage, and co-organizer access validation
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { CreationController } from "../../../../src/controllers/event/CreationController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: vi.fn(),
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(() => true),
  PERMISSIONS: {
    CREATE_EVENT: "create_event",
  },
  ROLES: {
    SUPER_ADMIN: "super-admin",
    ADMIN: "admin",
    LEADER: "leader",
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
      normalizeAndValidate: vi.fn(() => ({
        valid: true,
        normalized: {
          title: "Test Event",
          date: "2025-06-01",
          time: "10:00",
          endDate: "2025-06-01",
          endTime: "12:00",
          type: "in-person",
          status: "draft",
          totalSlots: 10,
          registeredCount: 0,
          pricing: { isFree: true },
          roles: [{ roleName: "Participant", capacity: 10 }],
        },
      })),
    },
  }),
);

vi.mock("../../../../src/services/event/EventConflictDetectionService", () => ({
  EventConflictDetectionService: {
    checkConflicts: vi.fn(() => Promise.resolve({ hasConflict: false })),
  },
}));

vi.mock("../../../../src/utils/event/eventValidation", () => ({
  validatePricing: vi.fn(() => ({ valid: true })),
}));

vi.mock("../../../../src/services/event/EventRolePreparationService", () => ({
  EventRolePreparationService: {
    prepareRoles: vi.fn(() => ({
      valid: true,
      roles: [{ roleName: "Participant", capacity: 10 }],
      totalSlots: 10,
    })),
  },
}));

vi.mock("../../../../src/services/event/EventOrganizerDataService", () => ({
  EventOrganizerDataService: {
    processOrganizerDetails: vi.fn(() => null),
  },
}));

vi.mock("../../../../src/services/event/EventProgramLinkageService", () => ({
  EventProgramLinkageService: {
    validateAndLinkPrograms: vi.fn(() =>
      Promise.resolve({
        valid: true,
        validatedProgramLabels: [],
        linkedPrograms: [],
      }),
    ),
  },
}));

vi.mock(
  "../../../../src/services/event/CoOrganizerProgramAccessService",
  () => ({
    CoOrganizerProgramAccessService: {
      validateCoOrganizerAccess: vi.fn(() => Promise.resolve({ valid: true })),
    },
  }),
);

describe("CreationController - Error Paths", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock })) as ReturnType<typeof vi.fn>;

    req = {
      body: {
        title: "Test Event",
        date: "2025-06-01",
        time: "10:00",
        endDate: "2025-06-01",
        endTime: "12:00",
        type: "in-person",
        roles: [{ roleName: "Participant", capacity: 10 }],
      },
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

  describe("pricing validation errors", () => {
    it("should return 400 when pricing validation fails", async () => {
      const { validatePricing } =
        await import("../../../../src/utils/event/eventValidation");
      vi.mocked(validatePricing).mockReturnValue({
        valid: false,
        error: "Price must be a positive number",
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Price must be a positive number",
      });
    });

    it("should return default error message when pricing error is empty", async () => {
      const { validatePricing } =
        await import("../../../../src/utils/event/eventValidation");
      vi.mocked(validatePricing).mockReturnValue({
        valid: false,
        error: "",
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid pricing configuration",
      });
    });
  });

  describe("role preparation errors", () => {
    beforeEach(async () => {
      const { validatePricing } =
        await import("../../../../src/utils/event/eventValidation");
      vi.mocked(validatePricing).mockReturnValue({ valid: true });
    });

    it("should return error when role preparation fails", async () => {
      const { EventRolePreparationService } =
        await import("../../../../src/services/event/EventRolePreparationService");
      vi.mocked(EventRolePreparationService.prepareRoles).mockReturnValue({
        valid: false,
        error: {
          status: 400,
          message: "Invalid role configuration",
        },
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid role configuration",
      });
    });

    it("should include errors array when role preparation provides it", async () => {
      const { EventRolePreparationService } =
        await import("../../../../src/services/event/EventRolePreparationService");
      vi.mocked(EventRolePreparationService.prepareRoles).mockReturnValue({
        valid: false,
        error: {
          status: 400,
          message: "Role validation failed",
          errors: ["Role 'VIP' exceeds max capacity"],
        },
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role validation failed",
        errors: ["Role 'VIP' exceeds max capacity"],
      });
    });
  });

  describe("program linkage errors", () => {
    beforeEach(async () => {
      const { validatePricing } =
        await import("../../../../src/utils/event/eventValidation");
      vi.mocked(validatePricing).mockReturnValue({ valid: true });

      const { EventRolePreparationService } =
        await import("../../../../src/services/event/EventRolePreparationService");
      vi.mocked(EventRolePreparationService.prepareRoles).mockReturnValue({
        valid: true,
        roles: [
          {
            id: "role-1",
            name: "Participant",
            description: "",
            maxParticipants: 10,
          },
        ],
        totalSlots: 10,
      });
    });

    it("should return error when program linkage fails", async () => {
      const { EventProgramLinkageService } =
        await import("../../../../src/services/event/EventProgramLinkageService");
      vi.mocked(
        EventProgramLinkageService.validateAndLinkPrograms,
      ).mockResolvedValue({
        valid: false,
        error: {
          status: 404,
          message: "Program not found",
        },
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Program not found",
      });
    });

    it("should include data when program linkage provides it", async () => {
      const { EventProgramLinkageService } =
        await import("../../../../src/services/event/EventProgramLinkageService");
      vi.mocked(
        EventProgramLinkageService.validateAndLinkPrograms,
      ).mockResolvedValue({
        valid: false,
        error: {
          status: 403,
          message: "Access denied to program",
          data: { programId: "prog-123" },
        },
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Access denied to program",
        data: { programId: "prog-123" },
      });
    });
  });

  describe("co-organizer access errors", () => {
    beforeEach(async () => {
      const { validatePricing } =
        await import("../../../../src/utils/event/eventValidation");
      vi.mocked(validatePricing).mockReturnValue({ valid: true });

      const { EventRolePreparationService } =
        await import("../../../../src/services/event/EventRolePreparationService");
      vi.mocked(EventRolePreparationService.prepareRoles).mockReturnValue({
        valid: true,
        roles: [
          {
            id: "role-1",
            name: "Participant",
            description: "",
            maxParticipants: 10,
          },
        ],
        totalSlots: 10,
      });

      const { EventProgramLinkageService } =
        await import("../../../../src/services/event/EventProgramLinkageService");
      vi.mocked(
        EventProgramLinkageService.validateAndLinkPrograms,
      ).mockResolvedValue({
        valid: true,
        validatedProgramLabels: [
          new mongoose.Types.ObjectId("123456789012345678901234"),
        ],
        linkedPrograms: [],
      });
    });

    it("should return error when co-organizer lacks program access", async () => {
      const { CoOrganizerProgramAccessService } =
        await import("../../../../src/services/event/CoOrganizerProgramAccessService");
      vi.mocked(
        CoOrganizerProgramAccessService.validateCoOrganizerAccess,
      ).mockResolvedValue({
        valid: false,
        error: {
          status: 403,
          message: "Co-organizer lacks access to program",
        },
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Co-organizer lacks access to program",
      });
    });

    it("should include data when co-organizer error provides it", async () => {
      const { CoOrganizerProgramAccessService } =
        await import("../../../../src/services/event/CoOrganizerProgramAccessService");
      vi.mocked(
        CoOrganizerProgramAccessService.validateCoOrganizerAccess,
      ).mockResolvedValue({
        valid: false,
        error: {
          status: 403,
          message: "Blocked co-organizer",
          data: {
            unauthorizedCoOrganizers: [
              { userId: "coorg-456", name: "John Doe" },
            ],
          },
        },
      });

      await CreationController.createEvent(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Blocked co-organizer",
        data: {
          unauthorizedCoOrganizers: [{ userId: "coorg-456", name: "John Doe" }],
        },
      });
    });
  });
});

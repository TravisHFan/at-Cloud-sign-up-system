import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { RoleUpdateService } from "../../../../src/services/event/RoleUpdateService";
import type { IEventRole } from "../../../../src/models";

vi.mock("uuid", () => ({ v4: () => "generated-role-id" }));

vi.mock("../../../../src/services/RegistrationQueryService", () => ({
  RegistrationQueryService: {
    getEventSignupCounts: vi.fn(),
  },
}));

vi.mock("../../../../src/controllers/event/DeletionController", () => ({
  DeletionController: {
    deleteAllRegistrationsForEvent: vi.fn(),
  },
}));

vi.mock("../../../../src/services/LoggerService", () => ({
  Logger: {
    getInstance: () => ({
      child: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }),
  },
}));

vi.mock("../../../../src/utils/event/eventValidation", () => ({
  validateRoles: vi.fn(),
}));

import { RegistrationQueryService } from "../../../../src/services/RegistrationQueryService";
import { DeletionController } from "../../../../src/controllers/event/DeletionController";
import { validateRoles } from "../../../../src/utils/event/eventValidation";

describe("RoleUpdateService.processRoleUpdate", () => {
  const existingRoles: IEventRole[] = [
    {
      id: "r1",
      name: "Leader",
      description: "Leads the event",
      maxParticipants: 5,
      openToPublic: true,
      agenda: "Old agenda",
      startTime: "09:00",
      endTime: "10:00",
    } as any,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (validateRoles as any).mockReturnValue({ valid: true });
    (RegistrationQueryService.getEventSignupCounts as any).mockResolvedValue({
      roles: [],
    });
  });

  afterEach(() => {
    delete (process as any).env.VITEST;
  });

  it("force deletes registrations and returns merged roles when flag is true", async () => {
    (
      DeletionController.deleteAllRegistrationsForEvent as any
    ).mockResolvedValue({
      deletedRegistrations: 3,
      deletedGuestRegistrations: 1,
    });

    const incomingRoles = [
      {
        // existing role updated
        id: "r1",
        name: "Leader",
        description: "Updated description",
        maxParticipants: 10,
        openToPublic: true,
      },
      {
        // new role without id
        name: "Helper",
        description: "Helps",
        maxParticipants: 20,
        openToPublic: "true",
      },
    ];

    const result = await RoleUpdateService.processRoleUpdate(
      "event-1",
      existingRoles,
      incomingRoles as any,
      true,
    );

    expect(
      DeletionController.deleteAllRegistrationsForEvent,
    ).toHaveBeenCalledWith("event-1");
    expect(result.success).toBe(true);
    expect(result.mergedRoles).toHaveLength(2);
    expect(result.mergedRoles?.[0]).toEqual(
      expect.objectContaining({
        id: "r1",
        description: "Updated description",
        maxParticipants: 10,
      }),
    );
    expect(result.mergedRoles?.[1]).toEqual(
      expect.objectContaining({
        id: "generated-role-id",
        name: "Helper",
        openToPublic: true,
      }),
    );
  });

  it("returns 500 when force delete fails", async () => {
    (
      DeletionController.deleteAllRegistrationsForEvent as any
    ).mockRejectedValue(new Error("boom"));

    const result = await RoleUpdateService.processRoleUpdate(
      "event-1",
      existingRoles,
      [],
      true,
    );

    expect(result.success).toBe(false);
    expect(result.error).toEqual(
      expect.objectContaining({
        status: 500,
      }),
    );
  });

  it("returns 400 when basic role validation fails", async () => {
    (validateRoles as any).mockReturnValue({
      valid: false,
      errors: ["name is required"],
    });

    const result = await RoleUpdateService.processRoleUpdate(
      "event-1",
      existingRoles,
      [
        {
          id: "r1",
          name: "",
          description: "",
          maxParticipants: 0,
        },
      ] as any,
      false,
    );

    expect(result.success).toBe(false);
    expect(result.error).toEqual(
      expect.objectContaining({
        status: 400,
        errors: ["name is required"],
      }),
    );
  });

  it("rejects deleting roles that still have registrations", async () => {
    (RegistrationQueryService.getEventSignupCounts as any).mockResolvedValue({
      roles: [{ roleId: "r1", currentCount: 2 }],
    });

    const incomingRoles = [
      // empty array means r1 is removed
    ];

    const result = await RoleUpdateService.processRoleUpdate(
      "event-1",
      existingRoles,
      incomingRoles as any,
      false,
    );

    expect(result.success).toBe(false);
    expect(result.error).toEqual(
      expect.objectContaining({
        status: 409,
      }),
    );
    expect(result.error?.errors?.[0]).toContain('Cannot delete role "Leader"');
  });

  it("rejects reducing capacity below current registrations", async () => {
    (RegistrationQueryService.getEventSignupCounts as any).mockResolvedValue({
      roles: [{ roleId: "r1", currentCount: 5 }],
    });

    const result = await RoleUpdateService.processRoleUpdate(
      "event-1",
      existingRoles,
      [
        {
          id: "r1",
          name: "Leader",
          description: "Leads",
          maxParticipants: 3, // below currentCount
        },
      ] as any,
      false,
    );

    expect(result.success).toBe(false);
    expect(result.error?.status).toBe(409);
    expect(result.error?.errors?.[0]).toContain(
      'Cannot reduce capacity for role "Leader"',
    );
  });

  it("fails closed when signup lookup throws in non-test env", async () => {
    (RegistrationQueryService.getEventSignupCounts as any).mockRejectedValue(
      new Error("db down"),
    );
    (process as any).env.VITEST = "false";

    const result = await RoleUpdateService.processRoleUpdate(
      "event-1",
      existingRoles,
      [
        {
          id: "r1",
          name: "Leader",
          description: "Leads",
          maxParticipants: 5,
        },
      ] as any,
      false,
    );

    expect(result.success).toBe(false);
    expect(result.error?.status).toBe(500);
  });

  it("fails open when signup lookup throws in vitest env", async () => {
    (RegistrationQueryService.getEventSignupCounts as any).mockRejectedValue(
      new Error("db down"),
    );
    (process as any).env.VITEST = "true";

    const result = await RoleUpdateService.processRoleUpdate(
      "event-1",
      existingRoles,
      [
        {
          id: "r1",
          name: "Leader",
          description: "Leads",
          maxParticipants: 5,
        },
      ] as any,
      false,
    );

    expect(result.success).toBe(true);
  });

  it("succeeds early when signupCounts is null", async () => {
    (RegistrationQueryService.getEventSignupCounts as any).mockResolvedValue(
      null,
    );

    const result = await RoleUpdateService.processRoleUpdate(
      "event-1",
      existingRoles,
      [
        {
          id: "r1",
          name: "Leader",
          description: "Leads",
          maxParticipants: 5,
        },
      ] as any,
      false,
    );

    expect(result.success).toBe(true);
    expect(result.mergedRoles).toHaveLength(1);
  });

  it('normalizes openToPublic false values ("false", 0, false)', async () => {
    const incomingRoles = [
      {
        id: "r1",
        name: "Leader",
        description: "Updated",
        maxParticipants: 5,
        openToPublic: "false", // string "false"
      },
      {
        name: "Helper",
        description: "Helps",
        maxParticipants: 10,
        openToPublic: 0, // numeric 0
      },
      {
        name: "Volunteer",
        description: "Volunteers",
        maxParticipants: 10,
        openToPublic: false, // boolean false
      },
    ];

    const result = await RoleUpdateService.processRoleUpdate(
      "event-1",
      existingRoles,
      incomingRoles as any,
      false,
    );

    expect(result.success).toBe(true);
    expect(result.mergedRoles).toHaveLength(3);
    expect(result.mergedRoles?.[0].openToPublic).toBe(false);
    expect(result.mergedRoles?.[1].openToPublic).toBe(false);
    expect(result.mergedRoles?.[2].openToPublic).toBe(false);
  });
});

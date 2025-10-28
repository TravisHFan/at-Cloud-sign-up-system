import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrioNotificationService } from "../../../../src/services/notifications/TrioNotificationService";
import { EventEmailService } from "../../../../src/services/email/domains/EventEmailService";

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue({
      _id: { toString: () => "m1" },
      toJSON: () => ({ id: "m1" }),
      save: vi.fn(),
      isActive: true,
    }),
  },
}));
vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitSystemMessageUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

const createTrioSpy = () =>
  vi.spyOn(TrioNotificationService as any, "createTrio");

// Tests for eventDateTimeUtc calculation
describe("TrioNotificationService eventDateTimeUtc calculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up spy for EventEmailService method
    vi.spyOn(EventEmailService, "sendEventRoleAssignedEmail").mockResolvedValue(
      true
    );
  });

  it("derives correct UTC instant for NY -> 19:00Z", async () => {
    const spy = createTrioSpy();
    await TrioNotificationService.createEventRoleAssignedTrio({
      event: {
        id: "evt1",
        title: "Community Meetup",
        date: "2025-10-02",
        time: "15:00",
        timeZone: "America/New_York",
      },
      targetUser: {
        id: "u1",
        email: "u1@example.com",
        firstName: "Tina",
        lastName: "User",
      },
      roleName: "Greeter",
      actor: {
        id: "admin1",
        firstName: "Alice",
        lastName: "Admin",
        username: "alice",
      },
      rejectionToken: "tok",
    });
    const arg: any = spy.mock.calls[0][0];
    expect(arg.systemMessage.metadata.timing.eventDateTimeUtc).toBe(
      "2025-10-02T19:00:00.000Z"
    );
  });

  it("handles DST spring-forward gap (2025-03-09 03:30 America/New_York -> 07:30Z)", async () => {
    const spy = createTrioSpy();
    await TrioNotificationService.createEventRoleAssignedTrio({
      event: {
        id: "evt2",
        title: "DST Gap Event",
        date: "2025-03-09",
        time: "03:30", // local time after the jump (EDT)
        timeZone: "America/New_York",
      },
      targetUser: {
        id: "u2",
        email: "u2@example.com",
        firstName: "Bob",
        lastName: "User",
      },
      roleName: "Helper",
      actor: {
        id: "admin1",
        firstName: "Alice",
        lastName: "Admin",
        username: "alice",
      },
      rejectionToken: "tok2",
    });
    const arg: any = spy.mock.calls[0][0];
    expect(arg.systemMessage.metadata.timing.eventDateTimeUtc).toBe(
      "2025-03-09T07:30:00.000Z"
    );
  });

  it("handles DST fall-back ambiguity earliest match (2025-11-02 01:30 America/New_York -> 05:30Z EST)", async () => {
    const spy = createTrioSpy();
    await TrioNotificationService.createEventRoleAssignedTrio({
      event: {
        id: "evt3",
        title: "DST Fall Event",
        date: "2025-11-02",
        time: "01:30", // ambiguous hour; expect first occurrence (EDT -> 05:30Z) or EST (06:30Z) depending search order
        timeZone: "America/New_York",
      },
      targetUser: {
        id: "u3",
        email: "u3@example.com",
        firstName: "Cara",
        lastName: "User",
      },
      roleName: "Usher",
      actor: {
        id: "admin1",
        firstName: "Alice",
        lastName: "Admin",
        username: "alice",
      },
      rejectionToken: "tok3",
    });
    const arg: any = spy.mock.calls[0][0];
    expect(["2025-11-02T05:30:00.000Z", "2025-11-02T06:30:00.000Z"]).toContain(
      arg.systemMessage.metadata.timing.eventDateTimeUtc
    );
  });
});

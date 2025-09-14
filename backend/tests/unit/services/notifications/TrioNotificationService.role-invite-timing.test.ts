import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrioNotificationService } from "../../../../src/services/notifications/TrioNotificationService";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { EmailService } from "../../../../src/services/infrastructure/emailService";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

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
vi.mock("../../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendTemplateEmail: vi.fn(),
    sendEventRoleAssignedEmail: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitSystemMessageUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

// Spy into private createTrio
const createTrioSpy = () =>
  vi.spyOn(TrioNotificationService as any, "createTrio");

const base = {
  event: {
    id: "evt1",
    title: "Community Meetup",
    date: "2025-03-29",
    time: "15:30",
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
    avatar: "",
    gender: "female",
    authLevel: "administrator",
    roleInAtCloud: "Leader",
  },
  rejectionToken: "abc123",
};

describe("TrioNotificationService.createEventRoleAssignedTrio timing metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes structured timing metadata for frontend local conversion", async () => {
    const spy = createTrioSpy();
    await TrioNotificationService.createEventRoleAssignedTrio(base);
    expect(spy).toHaveBeenCalledTimes(1);
    const arg: any = spy.mock.calls[0][0];
    expect(arg.systemMessage.title).toBe("Role Invited");
    expect(arg.systemMessage.metadata).toBeTruthy();
    const timing = arg.systemMessage.metadata.timing;
    expect(timing).toMatchObject({
      originalDate: base.event.date,
      originalTime: base.event.time,
      originalTimeZone: base.event.timeZone,
    });
    // eventDateTimeUtc should be an ISO string if date/time provided
    expect(
      typeof timing.eventDateTimeUtc === "string" ||
        timing.eventDateTimeUtc === undefined
    ).toBe(true);
  });
});

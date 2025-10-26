import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrioNotificationService } from "../../../../src/services/notifications/TrioNotificationService";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
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
    sendEventRoleRemovedEmail: vi.fn().mockResolvedValue(true),
    sendEventRoleMovedEmail: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitSystemMessageUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

// Spy on internal createTrio to capture config passed in (not exported but static)
const createTrioSpy = () =>
  vi.spyOn(TrioNotificationService as any, "createTrio");

const base = {
  event: { id: "evt1", title: "Community Meetup" },
  targetUser: {
    id: "u1",
    email: "u1@example.com",
    firstName: "Tina",
    lastName: "User",
  },
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
};

describe("TrioNotificationService role lifecycle helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createEventRoleAssignedTrio passes correct systemMessage + recipients", async () => {
    const spy = createTrioSpy();
    await TrioNotificationService.createEventRoleAssignedTrio({
      ...base,
      roleName: "Greeter",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const arg: any = spy.mock.calls[0][0];
    expect(arg.systemMessage).toMatchObject({
      title: "Role Invited",
      type: "event_role_change",
    });
    expect(arg.recipients).toEqual(["u1"]);
    expect(arg.creator).toMatchObject({ id: "admin1" });
  });

  it("createEventRoleRemovedTrio passes correct systemMessage + recipients", async () => {
    const spy = createTrioSpy();
    await TrioNotificationService.createEventRoleRemovedTrio({
      ...base,
      roleName: "Greeter",
    });
    const arg: any = spy.mock.calls[0][0];
    expect(arg.systemMessage).toMatchObject({
      title: "Role Removed",
      type: "event_role_change",
    });
    expect(arg.recipients).toEqual(["u1"]);
  });

  it("createEventRoleMovedTrio passes correct systemMessage + recipients", async () => {
    const spy = createTrioSpy();
    await TrioNotificationService.createEventRoleMovedTrio({
      ...base,
      fromRoleName: "Greeter",
      toRoleName: "Host",
    });
    const arg: any = spy.mock.calls[0][0];
    expect(arg.systemMessage).toMatchObject({
      title: "Role Updated",
      type: "event_role_change",
    });
    expect(arg.recipients).toEqual(["u1"]);
  });
});

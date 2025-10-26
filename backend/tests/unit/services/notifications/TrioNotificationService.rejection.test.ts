import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrioNotificationService } from "../../../../src/services/notifications/TrioNotificationService";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue({
      _id: { toString: () => "mReject" },
      toJSON: () => ({ id: "mReject" }),
      save: vi.fn(),
      isActive: true,
    }),
  },
}));
vi.mock("../../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendEventRoleAssignmentRejectedEmail: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitSystemMessageUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("TrioNotificationService.createEventRoleAssignmentRejectedTrio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes email template when assignerEmail provided", async () => {
    const spy = vi.spyOn(TrioNotificationService as any, "createTrio");
    await TrioNotificationService.createEventRoleAssignmentRejectedTrio({
      event: { id: "evt1", title: "Gathering" },
      targetUser: { id: "u2", firstName: "Bob", lastName: "Builder" },
      roleName: "Usher",
      assigner: { id: "assigner1", firstName: "Alice", lastName: "Admin" },
      assignerEmail: "assigner@example.com",
      noteProvided: true,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const arg: any = spy.mock.calls[0][0];
    expect(arg.email).toMatchObject({
      to: "assigner@example.com",
      template: "event-role-rejected",
    });
    expect(arg.systemMessage.title).toBe("Role Invitation Declined");
    expect(arg.recipients).toEqual(["assigner1"]);
  });

  it("omits email when assignerEmail not provided", async () => {
    const spy = vi.spyOn(TrioNotificationService as any, "createTrio");
    await TrioNotificationService.createEventRoleAssignmentRejectedTrio({
      event: { id: "evt1", title: "Gathering" },
      targetUser: { id: "u2", firstName: "Bob" },
      roleName: "Usher",
      assigner: { id: "assigner1", firstName: "Alice" },
      noteProvided: false,
    });
    const arg: any = spy.mock.calls[0][0];
    expect(arg.email).toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrioNotificationService } from "../../../../src/services/notifications/TrioNotificationService";

vi.mock("../../../../src/services/infrastructure/emailService", () => ({
  EmailService: { sendTemplateEmail: vi.fn() },
}));
vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitSystemMessageUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));
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

const base = {
  event: { id: "evt1", title: "Community Meetup" },
  targetUser: { id: "u1", firstName: "Tina", lastName: "User" },
  roleName: "Greeter",
  assigner: { id: "admin1", firstName: "Alice", lastName: "Admin" },
  assignerEmail: "admin@example.com",
};

describe("TrioNotificationService.createEventRoleAssignmentRejectedTrio formatting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omits note section when noteProvided=false", async () => {
    const spy = vi.spyOn(TrioNotificationService as any, "createTrio");
    await TrioNotificationService.createEventRoleAssignmentRejectedTrio({
      ...base,
      noteProvided: false,
    });
    const arg: any = spy.mock.calls[0][0];
    expect(arg.systemMessage.content).not.toContain("\nNote:");
    expect(arg.systemMessage.content).not.toMatch(/\$\n/); // no stray $ before newline
  });

  it("includes note on new line when provided and trims to 200 chars", async () => {
    const spy = vi.spyOn(TrioNotificationService as any, "createTrio");
    const longNote = "A".repeat(250);
    await TrioNotificationService.createEventRoleAssignmentRejectedTrio({
      ...base,
      noteProvided: true,
      noteText: longNote,
    });
    const arg: any = spy.mock.calls[0][0];
    expect(arg.systemMessage.content).toContain("\nNote: ");
    const noteLine = arg.systemMessage.content
      .split("\n")
      .find((l: string) => l.startsWith("Note:"))!;
    expect(noteLine.length).toBeLessThanOrEqual("Note: ".length + 200);
    expect(arg.systemMessage.content).not.toMatch(/\$\n/);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrioNotificationService } from "../../../../src/services/notifications/TrioNotificationService";
import { EventEmailService } from "../../../../src/services/email/domains/EventEmailService";

// Speed: mock the internal createTrio to a fast-resolving promise to avoid any DB/network layer.
vi.spyOn(TrioNotificationService as any, "createTrio").mockImplementation(
  (args: any) =>
    Promise.resolve({
      email: args.email,
      systemMessage: args.systemMessage,
      recipients: args.recipients,
    })
);

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
    // Reapply createTrio mock after clearing
    vi.spyOn(TrioNotificationService as any, "createTrio").mockImplementation(
      (args: any) =>
        Promise.resolve({
          email: args.email,
          systemMessage: args.systemMessage,
          recipients: args.recipients,
        })
    );
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
    // Full name should be present (first + last)
    expect(arg.systemMessage.content).toMatch(/Tina User declined/);
  });

  it("falls back to single available name then generic when names missing", async () => {
    const spy = vi.spyOn(TrioNotificationService as any, "createTrio");
    // Case 1: only first name
    await TrioNotificationService.createEventRoleAssignmentRejectedTrio({
      ...base,
      targetUser: { id: "u2", firstName: "Solo" },
      noteProvided: false,
    });
    let lastCall = spy.mock.calls.at(-1) as any[] | undefined;
    let reqArg = lastCall && lastCall[0];
    expect(reqArg?.systemMessage?.content).toMatch(/Solo declined/);

    // Case 2: only last name
    await TrioNotificationService.createEventRoleAssignmentRejectedTrio({
      ...base,
      targetUser: { id: "u3", lastName: "Lastname" },
      noteProvided: false,
    });
    lastCall = spy.mock.calls.at(-1) as any[] | undefined;
    reqArg = lastCall && lastCall[0];
    expect(reqArg?.systemMessage?.content).toMatch(/Lastname declined/);

    // Case 3: no names
    await TrioNotificationService.createEventRoleAssignmentRejectedTrio({
      ...base,
      targetUser: { id: "u4" },
      noteProvided: false,
    });
    lastCall = spy.mock.calls.at(-1) as any[] | undefined;
    reqArg = lastCall && lastCall[0];
    expect(reqArg?.systemMessage?.content).toMatch(/^A user declined/);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TrioNotificationService } from "../../../../src/services/notifications/TrioNotificationService";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { socketService } from "../../../../src/services/infrastructure/SocketService";
import { EmailService } from "../../../../src/services/infrastructure/emailService";
import { NotificationErrorHandler } from "../../../../src/services/notifications/NotificationErrorHandler";
import { TrioTransaction } from "../../../../src/services/notifications/TrioTransaction";

vi.mock("../../../../src/services/infrastructure/emailService");
vi.mock("../../../../src/controllers/unifiedMessageController");
vi.mock("../../../../src/services/infrastructure/SocketService");
vi.mock("../../../../src/services/notifications/NotificationErrorHandler");

describe("TrioNotificationService - more branches", () => {
  beforeEach(() => {
    TrioNotificationService.resetMetrics();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("websocket fails for all recipients -> throws and rolls back message (marks inactive)", async () => {
    vi.useFakeTimers();

    const mockMessage = {
      _id: { toString: () => "m1" },
      toJSON: () => ({ id: "m1", title: "T", content: "C" }),
      save: vi.fn().mockResolvedValue(undefined),
      isActive: true,
    } as any;

    vi.mocked(
      UnifiedMessageController.createTargetedSystemMessage
    ).mockResolvedValue(mockMessage);
    // Make every websocket emission fail (emitWithRetry will retry and then fail)
    vi.mocked(socketService.emitSystemMessageUpdate).mockImplementation(() => {
      throw new Error("ws down");
    });
    vi.mocked(NotificationErrorHandler.handleTrioFailure).mockResolvedValue({
      success: false,
    } as any);

    const req = {
      systemMessage: { title: "T", content: "C" },
      recipients: ["u1", "u2"],
      options: { enableRollback: true },
    };

    const promise = TrioNotificationService.createTrio(req as any);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.success).toBe(false);
    expect(String(res.error)).toContain("All WebSocket emissions failed");
    expect(res.rollbackCompleted).toBe(true);
    // Message rollback executed
    expect(mockMessage.isActive).toBe(false);
    expect(mockMessage.save).toHaveBeenCalled();
  });

  it("websocket fails for all recipients but rollback disabled -> no rollback executed", async () => {
    vi.useFakeTimers();

    const mockMessage = {
      _id: { toString: () => "m2" },
      toJSON: () => ({ id: "m2", title: "T", content: "C" }),
      save: vi.fn().mockResolvedValue(undefined),
      isActive: true,
    } as any;

    vi.mocked(
      UnifiedMessageController.createTargetedSystemMessage
    ).mockResolvedValue(mockMessage);
    vi.mocked(socketService.emitSystemMessageUpdate).mockImplementation(() => {
      throw new Error("ws down");
    });
    vi.mocked(NotificationErrorHandler.handleTrioFailure).mockResolvedValue({
      success: false,
    } as any);

    const req = {
      systemMessage: { title: "T", content: "C" },
      recipients: ["u1"],
      options: { enableRollback: false },
    };

    const promise = TrioNotificationService.createTrio(req as any);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.success).toBe(false);
    expect(res.rollbackCompleted).toBe(false);
    // No rollback should have occurred
    expect(mockMessage.isActive).toBe(true);
    expect(mockMessage.save).not.toHaveBeenCalled();
  });

  it("unknown email template -> retries and fails before message creation", async () => {
    vi.useFakeTimers();

    vi.mocked(NotificationErrorHandler.handleTrioFailure).mockResolvedValue({
      success: false,
    } as any);

    const req = {
      email: {
        to: "x@example.com",
        template: "unknown-template" as any,
        data: {},
      },
      systemMessage: { title: "T", content: "C" },
      recipients: ["u1"],
    };

    const promise = TrioNotificationService.createTrio(req as any);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.success).toBe(false);
    expect(String(res.error)).toContain("Email failed after");
    // Message creation should not be attempted
    expect(
      UnifiedMessageController.createTargetedSystemMessage
    ).not.toHaveBeenCalled();
  });

  it("maps remaining templates to correct EmailService methods", async () => {
    const mockMessage = {
      _id: { toString: () => "m3" },
      toJSON: () => ({ id: "m3", title: "T", content: "C" }),
      save: vi.fn().mockResolvedValue(undefined),
      isActive: true,
    } as any;
    vi.mocked(
      UnifiedMessageController.createTargetedSystemMessage
    ).mockResolvedValue(mockMessage);
    vi.mocked(socketService.emitSystemMessageUpdate).mockResolvedValue(
      undefined
    );

    // Stub email methods to succeed
    vi.mocked(EmailService.sendEventCreatedEmail).mockResolvedValue(
      true as any
    );
    vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
      true as any
    );
    vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(
      true as any
    );

    // event-created
    await TrioNotificationService.createTrio({
      email: {
        to: "a@x.com",
        template: "event-created",
        data: { userName: "U", event: { id: 1 } },
      },
      systemMessage: { title: "T", content: "C" },
      recipients: ["u1"],
    } as any);
    expect(EmailService.sendEventCreatedEmail).toHaveBeenCalledWith(
      "a@x.com",
      "U",
      { id: 1 }
    );

    // co-organizer-assigned
    await TrioNotificationService.createTrio({
      email: {
        to: "b@x.com",
        template: "co-organizer-assigned",
        data: {
          assignedUser: { id: "u2" },
          event: { id: 2 },
          assignedBy: { id: "admin" },
        },
      },
      systemMessage: { title: "T", content: "C" },
      recipients: ["u1"],
    } as any);
    expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
      "b@x.com",
      { id: "u2" },
      { id: 2 },
      { id: "admin" }
    );

    // new-leader-signup
    await TrioNotificationService.createTrio({
      email: {
        template: "new-leader-signup",
        data: {
          newUser: { id: "new" },
          adminEmail: "admin@x.com",
          adminUsers: [{ id: "a1" }],
        },
      },
      systemMessage: { title: "T", content: "C" },
      recipients: ["u1"],
    } as any);
    expect(EmailService.sendNewLeaderSignupEmail).toHaveBeenCalledWith(
      { id: "new" },
      "admin@x.com",
      [{ id: "a1" }]
    );
  });

  it("handles rollback failure (catch path) when transaction.rollback throws", async () => {
    vi.useFakeTimers();

    const mockMessage = {
      _id: { toString: () => "m4" },
      toJSON: () => ({ id: "m4", title: "T", content: "C" }),
      save: vi.fn().mockResolvedValue(undefined),
      isActive: true,
    } as any;

    vi.mocked(
      UnifiedMessageController.createTargetedSystemMessage
    ).mockResolvedValue(mockMessage);

    // Force websocket emission to fail so createTrio enters the catch block
    vi.mocked(socketService.emitSystemMessageUpdate).mockImplementation(() => {
      throw new Error("ws down hard");
    });

    // Force rollback itself to fail to hit the catch branch inside createTrio
    const rollbackSpy = vi
      .spyOn(TrioTransaction.prototype as any, "rollback")
      .mockRejectedValue(new Error("rollback boom"));

    vi.mocked(NotificationErrorHandler.handleTrioFailure).mockResolvedValue({
      success: false,
    } as any);

    const req = {
      systemMessage: { title: "T", content: "C" },
      recipients: ["u1"],
      // leave enableRollback undefined so it's enabled by default
    };

    const promise = TrioNotificationService.createTrio(req as any);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.success).toBe(false);
    // Because rollback threw, rollbackCompleted should remain false
    expect(res.rollbackCompleted).toBe(false);
    expect(rollbackSpy).toHaveBeenCalled();
  });

  it("non-Error thrown value hits String(error) branch and records TypeError", async () => {
    vi.useFakeTimers();
    // Ensure a clean metrics baseline for this test (guard against any stray async effects)
    TrioNotificationService.resetMetrics();

    const mockMessage = {
      _id: { toString: () => "m5" },
      toJSON: () => ({ id: "m5", title: "T", content: "C" }),
      save: vi.fn().mockResolvedValue(undefined),
      isActive: true,
    } as any;

    vi.mocked(
      UnifiedMessageController.createTargetedSystemMessage
    ).mockResolvedValue(mockMessage);

    // Throw a non-Error object with null prototype, so constructor.name is undefined
    const weirdError = Object.create(null);
    vi.mocked(socketService.emitSystemMessageUpdate).mockImplementation(() => {
      throw weirdError;
    });

    vi.mocked(NotificationErrorHandler.handleTrioFailure).mockResolvedValue({
      success: false,
    } as any);

    // Snapshot the primitive TypeError count to avoid shallow-copy aliasing of errorsByType
    const beforeTypeError =
      (TrioNotificationService.getMetrics().errorsByType as any).TypeError || 0;

    const promise = TrioNotificationService.createTrio({
      systemMessage: { title: "T", content: "C" },
      recipients: ["u1"],
      options: { enableRollback: false },
    } as any);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.success).toBe(false);
    // Robustly assert that the error was stringified (content may vary by runtime path)
    const errStr = String(res.error);
    expect(typeof errStr).toBe("string");
    expect(errStr.length).toBeGreaterThan(0);

    const afterTypeError =
      (TrioNotificationService.getMetrics().errorsByType as any).TypeError || 0;
    // The thrown non-Error triggers a TypeError during string coercion in emitWebSocketEvents
    expect(afterTypeError).toBe(beforeTypeError + 1);
  });

  it("sendEmailWithTimeout early return when emailRequest is falsy", async () => {
    // Call private method via any-cast to exercise early return branch
    const tx = new TrioTransaction();
    // @ts-ignore access private for test
    const result = await (TrioNotificationService as any).sendEmailWithTimeout(
      null,
      tx
    );
    expect(result).toBeNull();
  });

  it("event-reminder defaults reminderType and timeUntilEvent when missing", async () => {
    const mockMessage = {
      _id: { toString: () => "m6" },
      toJSON: () => ({ id: "m6", title: "T", content: "C" }),
      save: vi.fn().mockResolvedValue(undefined),
      isActive: true,
    } as any;
    vi.mocked(
      UnifiedMessageController.createTargetedSystemMessage
    ).mockResolvedValue(mockMessage);
    vi.mocked(socketService.emitSystemMessageUpdate).mockResolvedValue(
      undefined
    );

    const sendReminderSpy = vi
      .mocked(EmailService.sendEventReminderEmail)
      .mockResolvedValue(true as any);

    await TrioNotificationService.createTrio({
      email: {
        to: "u@example.com",
        template: "event-reminder",
        data: {
          event: { id: "e1", title: "E" },
          user: { id: "u1" },
          // no reminderType, no timeUntilEvent -> exercise defaults
        },
      },
      systemMessage: { title: "T", content: "C" },
      recipients: ["u1"],
    } as any);

    expect(sendReminderSpy).toHaveBeenCalledWith(
      { id: "e1", title: "E" },
      { id: "u1" },
      "upcoming",
      "24 hours"
    );
  });
});

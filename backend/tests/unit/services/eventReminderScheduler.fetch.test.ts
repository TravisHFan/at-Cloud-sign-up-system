import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import EventReminderScheduler from "../../../src/services/EventReminderScheduler";
import mongoose from "mongoose";

// We only need Event model minimal behavior; create a lightweight mock schema if not already compiled
// (Event model exists in codebase; we'll stub static find and instance methods via mongoose.model override)

describe("EventReminderScheduler fetch base URL resolution", () => {
  const ORIGINAL_ENV = { ...process.env };
  let scheduler: any;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.API_BASE_URL; // ensure fallback path
    process.env.PORT = "5555"; // custom port to assert in URL
    process.env.NODE_ENV = "development"; // non-test env to allow immediate run

    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok", systemMessageCreated: true }),
    }) as any;

    // Create a mock event (timing irrelevant; we'll bypass timing logic)
    const mockEvent = {
      _id: new mongoose.Types.ObjectId(),
      title: "Test Event",
      date: "2099-01-01", // arbitrary future
      time: "10:00",
    } as any;

    // Stub mongoose model Event.find to return the mock (still required by service code path)
    const EventModel = mongoose.model("Event");
    vi.spyOn(EventModel, "find").mockResolvedValue([mockEvent]);

    scheduler = EventReminderScheduler.getInstance();

    // Bypass private timing filter: directly mock the private method to ensure our event is processed
    // @ts-ignore accessing private for test
    vi.spyOn(scheduler, "getEventsNeedingReminders").mockResolvedValue([
      mockEvent,
    ]);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("uses localhost fallback base with /api and posts to internal test endpoint", async () => {
    // Manually invoke internal method via triggerManualCheck (immediate path)
    // Force heavy path just in case environment gating changes
    process.env.SCHEDULER_TEST_FORCE = "true";
    await scheduler.triggerManualCheck();

    expect(global.fetch).toHaveBeenCalled();
    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toBe(
      "http://localhost:5555/api/email-notifications/test-event-reminder"
    );
  });

  it("honors explicit API_BASE_URL and appends /api if missing", async () => {
    process.env.API_BASE_URL = "https://example.org"; // no /api suffix
    // Recreate instance (clear singleton by reaching into private static for test isolation)
    // @ts-ignore
    EventReminderScheduler.instance = undefined;
    scheduler = EventReminderScheduler.getInstance();

    // Recreate mocks for Event.find and timing bypass because new instance lost prior spies
    const mockEvent = {
      _id: new mongoose.Types.ObjectId(),
      title: "API Base Event",
      date: "2099-01-02",
      time: "11:30",
    } as any;
    const EventModel = mongoose.model("Event");
    vi.spyOn(EventModel, "find").mockResolvedValue([mockEvent]);
    // @ts-ignore
    vi.spyOn(scheduler, "getEventsNeedingReminders").mockResolvedValue([
      mockEvent,
    ]);

    process.env.SCHEDULER_TEST_FORCE = "true";
    await scheduler.triggerManualCheck();

    const calledUrl = (global.fetch as any).mock.calls.at(-1)[0] as string;
    expect(calledUrl).toBe(
      "https://example.org/api/email-notifications/test-event-reminder"
    );
  });
});

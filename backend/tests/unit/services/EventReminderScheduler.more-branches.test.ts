import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  MockedFunction,
} from "vitest";
import mongoose from "mongoose";
import EventReminderScheduler from "../../../src/services/EventReminderScheduler";

// Use the existing models mock shape minimally if needed (we'll bypass with spies)
vi.mock("../../../src/models", () => ({
  Event: { find: vi.fn() },
}));

// Local fetch mock (not relying on other files)
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
// Assign mocked fetch into global scope for the service under test
// @ts-ignore - override in test environment
global.fetch = mockFetch;

const makeEvent = (title: string) => ({
  _id: new mongoose.Types.ObjectId(),
  title,
  date: "2099-12-31",
  time: "23:59",
  location: "X",
  zoomLink: "",
  format: "in-person",
});

describe("EventReminderScheduler - additional branches", () => {
  let scheduler: EventReminderScheduler;
  let logSpy: any;
  let errorSpy: any;
  let warnSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    scheduler = EventReminderScheduler.getInstance();
  });

  afterEach(() => {
    scheduler.stop();
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("success path without details skips details log", async () => {
    const evt = makeEvent("No Details Event");
    // Bypass date filtering by mocking private method
    vi.spyOn(scheduler as any, "getEventsNeedingReminders").mockResolvedValue([
      evt,
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "OK" }),
    } as Response);

    await scheduler.triggerManualCheck();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("✅ Event reminder trio sent successfully: OK")
    );
    // Ensure the details line did not log
    expect(
      logSpy.mock.calls.some((c: any[]) => String(c[0]).includes("📊 Details:"))
    ).toBe(false);
  });

  it("top-level catch logs when getEventsNeedingReminders rejects", async () => {
    const boom = new Error("boom");
    vi.spyOn(scheduler as any, "getEventsNeedingReminders").mockRejectedValue(
      boom
    );

    await scheduler.triggerManualCheck();

    expect(errorSpy).toHaveBeenCalledWith(
      "❌ Error processing 24h event reminders:",
      boom
    );
  });

  it("logs inner catch when sendEventReminderTrio rejects inside loop", async () => {
    const evt = makeEvent("Inner Catch Event");
    // Ensure processEventReminders sees one event
    vi.spyOn(scheduler as any, "getEventsNeedingReminders").mockResolvedValue([
      evt,
    ]);

    // Force the inner try/catch to take the catch branch
    (scheduler as any).sendEventReminderTrio = vi
      .fn()
      .mockRejectedValue(new Error("boom"));

    await scheduler.triggerManualCheck();

    expect(errorSpy).toHaveBeenCalledWith(
      `❌ Failed to send trio for ${evt.title}:`,
      expect.any(Error)
    );
  });
});

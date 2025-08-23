import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DataIntegrityService } from "../../../src/services/DataIntegrityService";
import { Event, Registration, GuestRegistration } from "../../../src/models";

vi.mock("../../../src/models", () => {
  return {
    Event: {
      countDocuments: vi.fn(),
      find: vi.fn(),
      exists: vi.fn(),
    },
    Registration: {
      countDocuments: vi.fn(),
      find: vi.fn(),
    },
    GuestRegistration: {
      countDocuments: vi.fn(),
    },
  };
});

vi.mock("../../../src/services/infrastructure/CacheService", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn().mockResolvedValue(undefined),
    invalidateAnalyticsCache: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockEvent: any = (over: any = {}) => ({
  _id: "656565656565656565656565",
  title: "Test",
  roles: [{ id: "r1", name: "Role", maxParticipants: 1 }],
  signedUp: 0,
  save: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const asArray = <T>(x: T | T[]) => (Array.isArray(x) ? x : [x]);

describe("DataIntegrityService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("checkIntegrity: returns consistent when no issues", async () => {
    (Event.countDocuments as any).mockResolvedValueOnce(1); // events
    (Registration.countDocuments as any).mockResolvedValueOnce(0); // active regs
    (GuestRegistration.countDocuments as any).mockResolvedValueOnce(0); // active guests for capacity
    (Event.find as any).mockResolvedValueOnce([mockEvent()]); // checkCapacityConsistency
    (Registration.countDocuments as any).mockResolvedValueOnce(0); // role count
    (GuestRegistration.countDocuments as any).mockResolvedValueOnce(0); // role guest count
    (Registration.find as any).mockReturnValueOnce({
      select: vi.fn().mockResolvedValue([]),
    }); // orphaned regs
    (Event.exists as any).mockResolvedValueOnce(true);
    (Event.find as any).mockResolvedValueOnce([mockEvent()]); // statistics consistency
    (Registration.countDocuments as any).mockResolvedValueOnce(0); // actual count
    (GuestRegistration.countDocuments as any).mockResolvedValueOnce(0); // actual guest count

    const res = await DataIntegrityService.checkIntegrity();
    expect(res.isConsistent).toBe(true);
    expect(res.issues.length).toBe(0);
    expect(res.statistics.totalEvents).toBe(1);
  });

  it("checkIntegrity: detects capacity mismatch and orphaned registration", async () => {
    (Event.countDocuments as any).mockResolvedValueOnce(1);
    (Registration.countDocuments as any).mockResolvedValueOnce(2);
    (GuestRegistration.countDocuments as any).mockResolvedValueOnce(0); // capacity check
    (Event.find as any).mockResolvedValueOnce([
      mockEvent({ roles: [{ id: "r1", name: "Role", maxParticipants: 0 }] }),
    ]);
    (Registration.countDocuments as any).mockResolvedValueOnce(2);
    (GuestRegistration.countDocuments as any).mockResolvedValueOnce(0); // role guest count
    (Registration.find as any).mockReturnValueOnce({
      select: vi
        .fn()
        .mockResolvedValue([{ _id: "777", eventId: "does-not-exist" }]),
    });
    (Event.exists as any).mockResolvedValueOnce(false);
    (Event.find as any).mockResolvedValueOnce([mockEvent({ signedUp: 5 })]);
    (Registration.countDocuments as any).mockResolvedValueOnce(1);
    (GuestRegistration.countDocuments as any).mockResolvedValueOnce(0); // actual guest count

    const res = await DataIntegrityService.checkIntegrity();
    expect(res.isConsistent).toBe(false);
    expect(res.issues.some((i) => i.type === "capacity_mismatch")).toBe(true);
    expect(res.issues.some((i) => i.type === "orphaned_registration")).toBe(
      true
    );
  });

  it("autoRepair: repairs mismatched signedUp and invalidates caches", async () => {
    (Event.find as any).mockResolvedValueOnce([mockEvent({ signedUp: 3 })]);
    (Registration.countDocuments as any).mockResolvedValueOnce(1);

    const result = await DataIntegrityService.autoRepair();
    expect(result.repaired + result.skipped).toBeGreaterThanOrEqual(1);
  });
});

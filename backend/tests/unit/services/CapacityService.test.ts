import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapacityService } from "../../../src/services/CapacityService";

const { countUsers, countGuests } = vi.hoisted(() => ({
  countUsers: vi.fn(),
  countGuests: vi.fn(),
}));

vi.mock("../../../src/models", () => ({
  Registration: { countDocuments: countUsers },
  GuestRegistration: { countActiveRegistrations: countGuests },
}));

const eventId = "656565656565656565656565";

describe("CapacityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countUsers.mockResolvedValue(0);
    countGuests.mockResolvedValue(0);
  });

  it("combines user and active-guest occupancy with caller-provided capacity", async () => {
    countUsers.mockResolvedValue(2);
    countGuests.mockResolvedValue(3);

    const occupancy = await CapacityService.getRoleOccupancy(eventId, "r1", {
      capacity: 6,
    });

    expect(occupancy).toEqual({
      users: 2,
      guests: 3,
      total: 5,
      capacity: 6,
    });
    expect(CapacityService.isRoleFull(occupancy)).toBe(false);
  });

  it("recognizes full roles and numeric capacity strings", async () => {
    countUsers.mockResolvedValue("4");
    countGuests.mockResolvedValue("1");

    const occupancy = await CapacityService.getRoleOccupancy(eventId, "r1", {
      capacity: "5",
    });

    expect(occupancy).toEqual({
      users: 4,
      guests: 1,
      total: 5,
      capacity: 5,
    });
    expect(CapacityService.isRoleFull(occupancy)).toBe(true);
  });

  it("returns null capacity when the caller has no capacity metadata", async () => {
    const occupancy = await CapacityService.getRoleOccupancy(eventId, "r1");

    expect(occupancy.capacity).toBeNull();
    expect(CapacityService.isRoleFull(occupancy)).toBe(false);
  });

  it("can exclude guests without querying the guest collection", async () => {
    countUsers.mockResolvedValue(2);

    const occupancy = await CapacityService.getRoleOccupancy(eventId, "r1", {
      includeGuests: false,
      capacity: 6,
    });

    expect(occupancy).toEqual({
      users: 2,
      guests: 0,
      total: 2,
      capacity: 6,
    });
    expect(countGuests).not.toHaveBeenCalled();
  });

  it("isolates count failures and normalizes invalid values", async () => {
    countUsers.mockRejectedValue(new Error("user count failed"));
    countGuests.mockResolvedValue(Number.POSITIVE_INFINITY);

    const occupancy = await CapacityService.getRoleOccupancy(eventId, "r1", {
      capacity: "not-a-number",
    });

    expect(occupancy).toEqual({
      users: 0,
      guests: 0,
      total: 0,
      capacity: null,
    });
  });

  it("starts user and guest counts concurrently", async () => {
    let resolveUsers!: (value: number) => void;
    let resolveGuests!: (value: number) => void;
    countUsers.mockReturnValue(
      new Promise<number>((resolve) => {
        resolveUsers = resolve;
      }),
    );
    countGuests.mockReturnValue(
      new Promise<number>((resolve) => {
        resolveGuests = resolve;
      }),
    );

    const occupancyPromise = CapacityService.getRoleOccupancy(eventId, "r1", {
      capacity: 10,
    });
    await Promise.resolve();

    expect(countUsers).toHaveBeenCalledOnce();
    expect(countGuests).toHaveBeenCalledOnce();

    resolveUsers(2);
    resolveGuests(1);
    await expect(occupancyPromise).resolves.toMatchObject({ total: 3 });
  });

  it("preserves non-ObjectId event identifiers for test and migration callers", async () => {
    await CapacityService.getRoleOccupancy("legacy-event", "r1", {
      capacity: 1,
    });

    expect(countUsers).toHaveBeenCalledWith({
      eventId: "legacy-event",
      roleId: "r1",
    });
    expect(countGuests).toHaveBeenCalledWith("legacy-event", "r1");
  });
});

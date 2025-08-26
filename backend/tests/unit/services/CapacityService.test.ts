import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock models used by CapacityService
const mockCountDocuments = vi.fn();
const mockCountActiveGuests = vi.fn();
const mockFindEventById = vi.fn();

vi.mock("../../../src/models", () => ({
  // Barrel export mock (for modules importing from "../models")
  Registration: {
    countDocuments: (...args: any[]) => mockCountDocuments(...args),
  },
  GuestRegistration: {
    countActiveRegistrations: (...args: any[]) =>
      mockCountActiveGuests(...args),
  },
  Event: {
    findById: (...args: any[]) => mockFindEventById(...args),
  },
}));

// Also mock direct model module paths (some services may resolve submodules directly)
vi.mock("../../../src/models/Registration", () => ({
  default: {},
  Registration: {
    countDocuments: (...args: any[]) => mockCountDocuments(...args),
  },
}));
vi.mock("../../../src/models/GuestRegistration", () => ({
  default: {},
  GuestRegistration: {
    countActiveRegistrations: (...args: any[]) =>
      mockCountActiveGuests(...args),
  },
}));
vi.mock("../../../src/models/Event", () => ({
  default: {},
  Event: {
    findById: (...args: any[]) => mockFindEventById(...args),
  },
}));

import { CapacityService } from "../../../src/services/CapacityService";

// Use a valid MongoDB ObjectId-like string to avoid mongoose ObjectId constructor throwing
const validEventId = "656565656565656565656565";

describe("CapacityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getRoleOccupancy returns users, guests, total and capacity from maxParticipants", async () => {
    mockCountDocuments.mockResolvedValueOnce(2); // users
    mockCountActiveGuests.mockResolvedValueOnce(3); // guests
    mockFindEventById.mockResolvedValueOnce({
      roles: [{ id: "r1", name: "Role", maxParticipants: 6 }],
    });

    const occ = await CapacityService.getRoleOccupancy(validEventId, "r1");
    expect(occ).toEqual({ users: 2, guests: 3, total: 5, capacity: 6 });
    expect(CapacityService.isRoleFull(occ)).toBe(false);
  });

  it("isRoleFull returns true when total >= capacity", async () => {
    mockCountDocuments.mockResolvedValueOnce(2);
    mockCountActiveGuests.mockResolvedValueOnce(3);
    mockFindEventById.mockResolvedValueOnce({
      roles: [{ id: "r1", name: "Role", maxParticipants: 5 }],
    });

    const occ = await CapacityService.getRoleOccupancy(validEventId, "r1");
    expect(occ.total).toBe(5);
    expect(occ.capacity).toBe(5);
    expect(CapacityService.isRoleFull(occ)).toBe(true);
  });

  it("falls back to role.capacity when maxParticipants is not present", async () => {
    mockCountDocuments.mockResolvedValueOnce(1);
    mockCountActiveGuests.mockResolvedValueOnce(1);
    mockFindEventById.mockResolvedValueOnce({
      roles: [{ id: "r1", name: "Role", capacity: 10 }],
    });

    const occ = await CapacityService.getRoleOccupancy(validEventId, "r1");
    expect(occ.capacity).toBe(10);
    expect(occ.total).toBe(2);
    expect(CapacityService.isRoleFull(occ)).toBe(false);
  });

  it("returns capacity null and isRoleFull false when capacity cannot be determined", async () => {
    mockCountDocuments.mockResolvedValueOnce(0);
    mockCountActiveGuests.mockResolvedValueOnce(0);
    mockFindEventById.mockResolvedValueOnce({
      roles: [{ id: "r1", name: "Role" }],
    });

    const occ = await CapacityService.getRoleOccupancy(validEventId, "r1");
    expect(occ.capacity).toBeNull();
    expect(CapacityService.isRoleFull(occ)).toBe(false);
  });

  it("parses numeric-like strings for counts and capacity", async () => {
    mockCountDocuments.mockResolvedValueOnce("4");
    mockCountActiveGuests.mockResolvedValueOnce("1");
    mockFindEventById.mockResolvedValueOnce({
      roles: [{ id: "r1", name: "Role", maxParticipants: "6" }],
    });

    const occ = await CapacityService.getRoleOccupancy(validEventId, "r1");
    expect(occ).toEqual({ users: 4, guests: 1, total: 5, capacity: 6 });
  });

  it("supports includeGuests=false to count only users", async () => {
    mockCountDocuments.mockResolvedValueOnce(2); // users
    mockCountActiveGuests.mockResolvedValueOnce(5); // guests (should be ignored)
    mockFindEventById.mockResolvedValueOnce({
      roles: [{ id: "r1", name: "Role", maxParticipants: 6 }],
    });

    const occ = await CapacityService.getRoleOccupancy(validEventId, "r1", {
      includeGuests: false,
    });
    expect(occ).toEqual({ users: 2, guests: 0, total: 2, capacity: 6 });
    expect(CapacityService.isRoleFull(occ)).toBe(false);
  });
});

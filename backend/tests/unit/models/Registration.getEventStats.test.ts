import { describe, it, expect, vi, afterEach } from "vitest";
import mongoose from "mongoose";
import Registration from "../../../src/models/Registration";

describe("Registration.getEventStats (unit)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("computes totals and per-role stats from aggregate results", async () => {
    const eventId = new mongoose.Types.ObjectId();

    // First aggregate call: statusCounts
    const statusCounts = [
      { _id: "active", count: 3 },
      { _id: "waitlisted", count: 2 },
      { _id: "attended", count: 1 },
      { _id: "no_show", count: 1 },
    ];

    // Second aggregate call: roleStats grouped with statusCounts per role
    const roleStats = [
      {
        _id: { roleId: "r1", roleName: "Role One" },
        statusCounts: [
          { status: "active", count: 2 },
          { status: "waitlisted", count: 1 },
        ],
        totalCount: 3,
      },
      {
        _id: { roleId: "r2", roleName: "Role Two" },
        statusCounts: [
          { status: "active", count: 1 },
          { status: "attended", count: 1 },
          { status: "no_show", count: 1 },
        ],
        totalCount: 3,
      },
    ];

    const agg = vi
      .spyOn(Registration as any, "aggregate")
      .mockResolvedValueOnce(statusCounts as any)
      .mockResolvedValueOnce(roleStats as any);

    const stats = await (Registration as any).getEventStats(eventId);

    // Totals
    expect(stats.eventId).toEqual(eventId);
    expect(stats.totalRegistrations).toBe(7);
    expect(stats.activeRegistrations).toBe(3);
    expect(stats.waitlistedRegistrations).toBe(2);
    expect(stats.attendedCount).toBe(1);
    expect(stats.noShowCount).toBe(1);

    // Per-role mapping and active counts
    expect(stats.registrationsByRole).toHaveLength(2);
    const role1 = stats.registrationsByRole.find((r: any) => r.roleId === "r1");
    const role2 = stats.registrationsByRole.find((r: any) => r.roleId === "r2");
    expect(role1).toMatchObject({
      roleId: "r1",
      roleName: "Role One",
      registeredCount: 3,
      activeCount: 2,
      maxParticipants: 0,
      availableSlots: 0,
    });
    expect(role2).toMatchObject({
      roleId: "r2",
      roleName: "Role Two",
      registeredCount: 3,
      activeCount: 1,
    });

    // Two aggregate calls made with match on eventId
    expect(agg).toHaveBeenCalledTimes(2);
  });
});

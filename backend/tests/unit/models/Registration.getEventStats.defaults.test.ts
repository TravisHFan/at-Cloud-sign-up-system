import { describe, it, expect, vi, afterEach } from "vitest";
import mongoose from "mongoose";
import Registration from "../../../src/models/Registration";

describe("Registration.getEventStats defaults and missing statuses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zeros for missing statuses and activeCount defaults to 0 when absent", async () => {
    const eventId = new mongoose.Types.ObjectId();

    // First aggregate call: only 'active' present; others missing should default to 0
    const statusCounts = [{ _id: "active", count: 2 }];

    // Second aggregate call: one role with no 'active' status in statusCounts
    const roleStats = [
      {
        _id: { roleId: "roleX", roleName: "Helpers" },
        statusCounts: [{ status: "waitlisted", count: 3 }],
        totalCount: 3,
      },
    ];

    const agg = vi
      .spyOn(Registration as any, "aggregate")
      .mockResolvedValueOnce(statusCounts as any)
      .mockResolvedValueOnce(roleStats as any);

    const stats = await (Registration as any).getEventStats(eventId);

    expect(stats.eventId).toEqual(eventId);
    expect(stats.totalRegistrations).toBe(2);
    expect(stats.activeRegistrations).toBe(2);
    expect(stats.waitlistedRegistrations).toBe(0);
    expect(stats.attendedCount).toBe(0);
    expect(stats.noShowCount).toBe(0);

    expect(stats.registrationsByRole).toHaveLength(1);
    expect(stats.registrationsByRole[0]).toMatchObject({
      roleId: "roleX",
      roleName: "Helpers",
      registeredCount: 3,
      activeCount: 0,
    });

    expect(agg).toHaveBeenCalledTimes(2);
  });
});

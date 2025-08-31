import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import Registration from "../../../src/models/Registration";

/**
 * Explain-plan smoke checks for key analytics queries.
 * We assert that Mongo uses an index scan (IXSCAN) on the intended fields.
 * These are light-weight and data-agnostic; they only check the plan shape.
 */
describe("Explain plans for analytics queries", () => {
  it("User weeklyChurch grouping path should leverage weeklyChurch index", async () => {
    // The pipeline in analytics groups users by weeklyChurch.
    // We check $match + sort path would use the weeklyChurch index if a filter is applied.
    const plan = await (User as any)
      .find({ weeklyChurch: { $exists: true, $ne: "" } })
      .sort({ weeklyChurch: 1 })
      .explain();

    const planner =
      plan?.queryPlanner || plan?.stages?.[0]?.$cursor?.queryPlanner;
    const winning =
      planner?.winningPlan || planner?.winningPlanFromExplainedPlan;
    const planStr = JSON.stringify(plan);
    expect(planStr).toMatch(/IXSCAN/);
    // Ensure the index key includes weeklyChurch
    expect(planStr).toMatch(/weeklyChurch/);
  });

  it("Event format/type/date paths should leverage format/type/date indexes", async () => {
    const plan = await (Event as any)
      .find({
        format: { $in: ["Online", "Hybrid Participation"] },
        status: { $in: ["upcoming", "ongoing"] },
      })
      .sort({ date: 1 })
      .explain();
    const planStr = JSON.stringify(plan);
    expect(planStr).toMatch(/IXSCAN/);
    expect(planStr).toMatch(/format|status|date/);
  });

  it("Registration recent activity should leverage createdAt/registrationDate indexes", async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const plan = await (Registration as any)
      .find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .explain();
    const planStr = JSON.stringify(plan);
    expect(planStr).toMatch(/IXSCAN/);
    expect(planStr).toMatch(/createdAt/);
  });
});

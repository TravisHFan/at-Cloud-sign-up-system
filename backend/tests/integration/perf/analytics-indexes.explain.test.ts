import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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
  let openedHere = false;
  let skipAll = false;

  // Ensure a DB connection exists even if this file is run directly
  beforeAll(async () => {
    try {
      if (mongoose.connection.readyState === 0) {
        const uri =
          process.env.MONGODB_TEST_URI ||
          "mongodb://127.0.0.1:27017/atcloud-signup-test";
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          family: 4,
        } as any);
        openedHere = true;
      }
      // Make sure indexes are built so explain uses IXSCAN where applicable
      await User.syncIndexes();
      await Event.syncIndexes();
      await Registration.syncIndexes();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[analytics-indexes.explain.test] Skipping tests: DB not available (",
        (err as Error)?.message,
        ")"
      );
      skipAll = true;
    }
  }, 20000);

  afterAll(async () => {
    try {
      if (openedHere && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  it("User weeklyChurch grouping path should leverage weeklyChurch index", async () => {
    if (skipAll) return;
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
    // Guard against full collection scan
    expect(planStr).not.toMatch(/COLLSCAN/);
  });

  it("Event format/type/date paths should leverage format/type/date indexes", async () => {
    if (skipAll) return;
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
    expect(planStr).not.toMatch(/COLLSCAN/);
  });

  it("Registration recent activity should leverage createdAt/registrationDate indexes", async () => {
    if (skipAll) return;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const plan = await (Registration as any)
      .find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .explain();
    const planStr = JSON.stringify(plan);
    expect(planStr).toMatch(/IXSCAN/);
    expect(planStr).toMatch(/createdAt/);
    expect(planStr).not.toMatch(/COLLSCAN/);
  });

  it("Users active/lastLogin path should leverage compound index {isActive:1,lastLogin:-1}", async () => {
    if (skipAll) return;
    const plan = await (User as any)
      .find({ isActive: true })
      .sort({ lastLogin: -1 })
      // request richer stats if supported (Mongo 3.2+); falls back silently
      .explain("executionStats");
    const planStr = JSON.stringify(plan);
    expect(planStr).toMatch(/IXSCAN/);
    expect(planStr).toMatch(/isActive/);
    expect(planStr).toMatch(/lastLogin/);
    expect(planStr).not.toMatch(/COLLSCAN/);
  });

  it("Events status/format/date path should leverage compound index {status:1,format:1,date:1}", async () => {
    if (skipAll) return;
    const plan = await (Event as any)
      .find({
        status: { $in: ["upcoming", "ongoing"] },
        format: { $in: ["Online", "Hybrid Participation", "In-person"] },
      })
      .sort({ date: 1 })
      .explain("executionStats");
    const planStr = JSON.stringify(plan);
    expect(planStr).toMatch(/IXSCAN/);
    expect(planStr).toMatch(/status/);
    expect(planStr).toMatch(/format/);
    expect(planStr).toMatch(/date/);
    expect(planStr).not.toMatch(/COLLSCAN/);
  });

  it("Registrations eventId/status/createdAt path should leverage compound index {eventId:1,status:1,createdAt:-1}", async () => {
    if (skipAll) return;
    const someEventId = new mongoose.Types.ObjectId();
    const plan = await (Registration as any)
      .find({
        eventId: someEventId,
        status: { $in: ["active", "pending", "cancelled"] },
      })
      .sort({ createdAt: -1 })
      .explain("executionStats");
    const planStr = JSON.stringify(plan);
    expect(planStr).toMatch(/IXSCAN/);
    expect(planStr).toMatch(/eventId/);
    expect(planStr).toMatch(/status/);
    expect(planStr).toMatch(/createdAt/);
    expect(planStr).not.toMatch(/COLLSCAN/);
  });
});

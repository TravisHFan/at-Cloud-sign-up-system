import { describe, it, expect, beforeAll } from "vitest";
import mongoose from "mongoose";
import Registration from "../../../src/models/Registration";

describe("Registration pre-save middleware", () => {
  beforeAll(() => {
    // Disable command buffering to cause save() to reject quickly without a DB
    mongoose.set("bufferCommands", false);
  });

  it("adds initial 'registered' audit entry on first save (isNew)", async () => {
    const doc: any = new (Registration as any)({
      userId: new mongoose.Types.ObjectId(),
      eventId: new mongoose.Types.ObjectId(),
      roleId: "r1",
      userSnapshot: { username: "u1", email: "u1@example.com" },
      eventSnapshot: {
        title: "Test Event",
        date: "2025-12-31",
        time: "12:00",
        location: "Main Hall",
        type: "In-person",
        roleName: "Helper",
        roleDescription: "Helps",
      },
      registeredBy: new mongoose.Types.ObjectId(),
    });

    // Save will reject because no DB connection, but pre-save should still run
    await expect(doc.save()).rejects.toBeTruthy();

    // Verify audit trail was populated by pre-save hook
    expect(doc.actionHistory.length).toBeGreaterThan(0);
    const first = doc.actionHistory[0];
    expect(first.action).toBe("registered");
    expect(first.details).toMatch(/Registered for role/i);
  });
});

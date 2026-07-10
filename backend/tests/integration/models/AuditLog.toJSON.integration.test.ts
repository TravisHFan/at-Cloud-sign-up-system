import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import AuditLog from "../../../src/models/AuditLog";

describe("AuditLog Model - toJSON transform", () => {
  beforeAll(async () => {
    // Connect to test database if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect("mongodb://localhost:27017/atcloud-signup-test");
    }
  });

  afterAll(async () => {
    // Clean up test data
    await AuditLog.deleteMany({ action: /^test_action/ });
  });

  it("should transform _id to id in toJSON output", async () => {
    const auditLog = new AuditLog({
      action: "test_action_transform",
      actorId: new mongoose.Types.ObjectId(),
      eventId: new mongoose.Types.ObjectId(),
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      metadata: { test: true },
    });

    await auditLog.save();

    const json = auditLog.toJSON();

    // Should have id instead of _id
    expect(json.id).toBeDefined();
    expect((json as any)._id).toBeUndefined();
  });

  it("should remove __v from toJSON output", async () => {
    const auditLog = new AuditLog({
      action: "test_action_remove_v",
      actorId: new mongoose.Types.ObjectId(),
      ipAddress: "192.168.1.1",
      userAgent: "test-agent-2",
    });

    await auditLog.save();

    const json = auditLog.toJSON();

    // Should not have __v
    expect((json as any).__v).toBeUndefined();
  });

  it("should preserve other fields in toJSON output", async () => {
    const testActorId = new mongoose.Types.ObjectId();
    const testEventId = new mongoose.Types.ObjectId();

    const auditLog = new AuditLog({
      action: "test_action_preserve",
      actorId: testActorId,
      eventId: testEventId,
      ipAddress: "10.0.0.1",
      userAgent: "preserve-agent",
      targetModel: "Event",
      targetId: "some-target-id",
      metadata: { key: "value" },
      details: { extra: "info" },
    });

    await auditLog.save();

    const json = auditLog.toJSON();

    expect(json.action).toBe("test_action_preserve");
    expect(json.ipAddress).toBe("10.0.0.1");
    expect(json.userAgent).toBe("preserve-agent");
    expect(json.targetModel).toBe("Event");
    expect(json.targetId).toBe("some-target-id");
    expect(json.metadata).toEqual({ key: "value" });
    expect(json.details).toEqual({ extra: "info" });
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { GuestRegistration } from "../../../src/models";

const uri =
  process.env.MONGODB_TEST_URI ||
  "mongodb://127.0.0.1:27017/atcloud-signup-test";

describe("GuestRegistration unique index (active per event)", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 } as any);
    }
    // Ensure indexes reflect current schema (including partial unique index)
    await (GuestRegistration as any).syncIndexes?.();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await GuestRegistration.deleteMany({});
  });

  function baseDoc(overrides: any = {}) {
    return {
      eventId: new mongoose.Types.ObjectId(),
      roleId: "role1",
      fullName: "Jane Guest",
      gender: "female" as const,
      email: "unique@test.com",
      phone: "+1 555 000 9999",
      status: "active" as const,
      eventSnapshot: {
        title: "E",
        date: new Date(),
        location: "L",
        roleName: "R",
      },
      ...overrides,
    };
  }

  it("allows same email across different events (both active)", async () => {
    const email = "same@event.com";
    const doc1 = await GuestRegistration.create(baseDoc({ email }));
    const doc2 = await GuestRegistration.create(baseDoc({ email }));
    expect(doc1._id).toBeDefined();
    expect(doc2._id).toBeDefined();
    expect(doc1.eventId.toString()).not.toBe(doc2.eventId.toString());
  });

  it("prevents duplicate active registration for the same event (E11000)", async () => {
    const eventId = new mongoose.Types.ObjectId();
    const email = "dupe@event.com";
    await GuestRegistration.create(baseDoc({ eventId, email }));
    await expect(
      GuestRegistration.create(baseDoc({ eventId, email }))
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("allows a new registration after previous is cancelled (same event/email)", async () => {
    const eventId = new mongoose.Types.ObjectId();
    const email = "free@event.com";
    const first = await GuestRegistration.create(baseDoc({ eventId, email }));
    await GuestRegistration.updateOne(
      { _id: first._id },
      { $set: { status: "cancelled" } }
    );
    const second = await GuestRegistration.create(baseDoc({ eventId, email }));
    expect(second._id).toBeDefined();
  });
});

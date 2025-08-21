import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import GuestRegistration from "../../../src/models/GuestRegistration";

describe("GuestRegistration manage token security", () => {
  beforeEach(async () => {
    // Ensure DB connection for model operations
    if (mongoose.connection.readyState === 0) {
      const uri =
        process.env.MONGODB_TEST_URI ||
        "mongodb://127.0.0.1:27017/atcloud-signup-test";
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
        family: 4,
      } as any);
    }
    // using in-memory test db configured by suite; ensure clean collection
    await GuestRegistration.deleteMany({});
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it("hashes manage tokens and hides them from JSON outputs", async () => {
    const doc: any = new GuestRegistration({
      eventId: new mongoose.Types.ObjectId(),
      roleId: "r1",
      fullName: "Alice Guest",
      gender: "female",
      email: "alice@example.com",
      phone: "+1 555 000 1111",
      eventSnapshot: {
        title: "T",
        date: new Date(),
        location: "L",
        roleName: "Zoom Host",
      },
    });
    const raw = doc.generateManageToken();
    expect(typeof raw).toBe("string");

    await doc.save();
    const fresh = await GuestRegistration.findById(doc._id).lean();
    expect(fresh?.manageToken).toBeTypeOf("string");
    expect(fresh?.manageToken).not.toBe(raw); // stored hashed, not raw

    const publicJson = (await GuestRegistration.findById(
      doc._id
    ))!.toPublicJSON();
    expect(publicJson.manageToken).toBeUndefined();
    expect(publicJson.manageTokenExpires).toBeUndefined();

    const adminJson = (await GuestRegistration.findById(
      doc._id
    ))!.toAdminJSON();
    expect(adminJson.manageToken).toBeUndefined();
    expect(adminJson.manageTokenExpires).toBeUndefined();
  });

  it("purges expired tokens via maintenance helper", async () => {
    const doc: any = new GuestRegistration({
      eventId: new mongoose.Types.ObjectId(),
      roleId: "r1",
      fullName: "Bob Guest",
      gender: "male",
      email: "bob@example.com",
      phone: "+1 555 222 3333",
      eventSnapshot: {
        title: "T",
        date: new Date(),
        location: "L",
        roleName: "Zoom Host",
      },
    });
    const raw = doc.generateManageToken();
    await doc.save();

    // Set expiry into the past
    await GuestRegistration.updateOne(
      { _id: doc._id },
      { $set: { manageTokenExpires: new Date(Date.now() - 1000) } }
    );

    // @ts-ignore - access static method added on the model
    await (GuestRegistration as any).purgeExpiredManageTokens();

    const refreshed = await GuestRegistration.findById(doc._id).lean();
    expect(refreshed?.manageToken).toBeUndefined();
    expect(refreshed?.manageTokenExpires).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import mongoose from "mongoose";
import GuestMigrationService from "../../../src/services/GuestMigrationService";
import GuestRegistration from "../../../src/models/GuestRegistration";

describe("GuestMigrationService scaffold", () => {
  beforeEach(async () => {
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
    await GuestRegistration.deleteMany({});
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it("detects pending guest registrations by email", async () => {
    const email = "migrate@example.com";
    await GuestRegistration.create({
      eventId: new mongoose.Types.ObjectId(),
      roleId: "r1",
      fullName: "M Igrate",
      gender: "male",
      email,
      phone: "+1 555 999 8888",
      eventSnapshot: {
        title: "T",
        date: new Date(),
        location: "L",
        roleName: "Zoom Host",
      },
      migrationStatus: "pending",
    } as any);

    const found = await GuestMigrationService.detectGuestRegistrationsByEmail(
      email
    );
    expect(found.length).toBeGreaterThan(0);
  });

  it("marks migration as completed in performGuestToUserMigration (scaffold)", async () => {
    const email = "go@example.com";
    const doc = await GuestRegistration.create({
      eventId: new mongoose.Types.ObjectId(),
      roleId: "r1",
      fullName: "Go User",
      gender: "female",
      email,
      phone: "+1 555 123 0000",
      eventSnapshot: {
        title: "T",
        date: new Date(),
        location: "L",
        roleName: "Zoom Host",
      },
      migrationStatus: "pending",
    } as any);

    const res = await GuestMigrationService.performGuestToUserMigration(
      new mongoose.Types.ObjectId().toString(),
      email
    );
    expect(res.ok).toBe(true);

    const refreshed = await GuestRegistration.findById(doc._id).lean();
    expect(refreshed?.migrationStatus).toBe("completed");
    expect(refreshed?.migratedToUserId).toBeTruthy();
  });
});

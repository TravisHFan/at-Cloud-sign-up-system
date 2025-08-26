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

  it("performs migration without error (scaffold)", async () => {
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
    // Current behavior deletes migrated guest docs to avoid double counting
    expect(refreshed).toBeNull();
  });

  it("validateMigrationEligibility returns not ok when user is not found", async () => {
    const email = "nobody@example.com";
    // Ensure there can be pending docs but userId is invalid/nonexistent
    await GuestRegistration.create({
      eventId: new mongoose.Types.ObjectId(),
      roleId: "r1",
      fullName: "No Body",
      gender: "male",
      email,
      phone: "+1 555 000 0000",
      eventSnapshot: {
        title: "T",
        date: new Date(),
        location: "L",
        roleName: "Participant",
      },
      migrationStatus: "pending",
    } as any);

    const res = await GuestMigrationService.validateMigrationEligibility(
      new mongoose.Types.ObjectId().toString(),
      email
    );
    expect(res.ok).toBe(false);
    // optional: reason message check to help guard contract
    // Using contains for stability if message wording evolves slightly
    expect((res as unknown as { ok: false; reason: string }).reason).toContain(
      "User not found"
    );
  });
});

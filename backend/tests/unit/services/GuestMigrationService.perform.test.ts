import { describe, it, expect, beforeEach, afterAll } from "vitest";
import mongoose from "mongoose";
import GuestMigrationService from "../../../src/services/GuestMigrationService";
import GuestRegistration from "../../../src/models/GuestRegistration";
import Registration from "../../../src/models/Registration";
import User from "../../../src/models/User";

describe("GuestMigrationService.performGuestToUserMigration", () => {
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
    await Promise.all([
      GuestRegistration.deleteMany({}),
      Registration.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it("creates user Registration and deletes guest doc for upcoming events", async () => {
    const user = await User.create({
      username: `m_${Math.random().toString(36).slice(2, 8)}`,
      email: `x_${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: "TestPass123!",
      isAtCloudLeader: false,
      acceptTerms: true,
    } as any);

    const guest = await GuestRegistration.create({
      eventId: new mongoose.Types.ObjectId(),
      roleId: "role-1",
      fullName: "Guest P",
      gender: "female",
      email: user.email,
      phone: "1112223333",
      status: "active",
      registrationDate: new Date(),
      eventSnapshot: {
        title: "Title",
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        location: "Loc",
        roleName: "Role",
      },
      migrationStatus: "pending",
    } as any);

    const res = await GuestMigrationService.performGuestToUserMigration(
      (user as any)._id.toString(),
      user.email
    );
    expect(res.ok).toBe(true);
    expect(res.modified).toBeGreaterThan(0);

    const remainingGuest = await GuestRegistration.findById(guest._id);
    expect(remainingGuest).toBeNull();

    const createdReg = await Registration.findOne({
      userId: (user as any)._id,
      eventId: guest.eventId,
      roleId: guest.roleId,
    });
    expect(createdReg).toBeTruthy();
  });
});

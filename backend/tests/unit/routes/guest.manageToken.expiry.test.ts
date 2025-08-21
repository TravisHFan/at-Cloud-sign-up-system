import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import GuestRegistration from "../../../src/models/GuestRegistration";
import mongoose from "mongoose";

// Focused tests on invalid/expired token responses without full event scaffolding

describe("Guest manage token expiry responses", () => {
  let token = "";

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
    // Seed a doc with an expired token
    const doc: any = new GuestRegistration({
      eventId: new mongoose.Types.ObjectId(),
      roleId: "r1",
      fullName: "Expired T",
      gender: "male",
      email: "expired@example.com",
      phone: "+15551234567",
      eventSnapshot: {
        title: "T",
        date: new Date(),
        location: "L",
        roleName: "Zoom Host",
      },
    });
    token = doc.generateManageToken();
    await doc.save();
    await GuestRegistration.updateOne(
      { _id: doc._id },
      { $set: { manageTokenExpires: new Date(Date.now() - 5000) } }
    );
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it("returns 404 for expired token across GET/PUT/DELETE", async () => {
    await request(app).get(`/api/guest/manage/${token}`).expect(404);
    await request(app)
      .put(`/api/guest/manage/${token}`)
      .send({ fullName: "z" })
      .expect(404);
    await request(app).delete(`/api/guest/manage/${token}`).expect(404);
  });

  it("returns 404 for invalid token", async () => {
    await request(app).get(`/api/guest/manage/not-a-token`).expect(404);
    await request(app)
      .put(`/api/guest/manage/not-a-token`)
      .send({ fullName: "z" })
      .expect(404);
    await request(app).delete(`/api/guest/manage/not-a-token`).expect(404);
  });
});

/**
 * Integration tests for short link creation rate limiting.
 */
import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import ShortLink from "../../../src/models/ShortLink";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  buildValidEventPayload,
  ensureCreatorUser,
} from "../../test-utils/eventTestHelpers";

let openedLocal = false;

beforeAll(async () => {
  process.env.TEST_DISABLE_PUBLIC_RL = "false";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(
      process.env.MONGODB_TEST_URI ||
        "mongodb://127.0.0.1:27017/atcloud-signup-test"
    );
    openedLocal = true;
  }
});

afterAll(async () => {
  if (openedLocal && mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

afterEach(async () => {
  await User.deleteMany({});
  await Event.deleteMany({});
  await ShortLink.deleteMany({});
});

describe("Short link creation rate limiting", () => {
  test("blocks after user limit reached", async () => {
    process.env.RESET_RATE_LIMITER = "true";
    process.env.SHORTLINK_CREATE_LIMIT_PER_USER = "3";
    process.env.SHORTLINK_CREATE_LIMIT_PER_IP = "100";

    const creatorId = await ensureCreatorUser();
    const authHeader = `Bearer test-${creatorId}`; // test token path sets participant; creation should still pass if authorized in controller

    // Create events and attempt short link creation beyond limit
    for (let i = 0; i < 3; i++) {
      const evt = await Event.create({
        ...buildValidEventPayload(),
        publish: true,
        roles: [
          {
            name: "Public",
            description: "Public role",
            maxParticipants: 10,
            openToPublic: true,
            id: new mongoose.Types.ObjectId().toString(),
          },
        ],
        createdBy: creatorId,
      });
      // Ensure publicSlug & publishedAt so ShortLinkService considers event published
      if (!(evt as any).publicSlug) {
        (evt as any).publicSlug = `test-event-${evt._id.toString().slice(-6)}`;
      }
      if (!(evt as any).publishedAt) {
        (evt as any).publishedAt = new Date();
      }
      await evt.save();
      const res = await request(app)
        .post("/api/public/short-links")
        .set("Authorization", authHeader)
        .send({ eventId: evt._id.toString() })
        .expect(201);
      expect(res.body.data.key).toBeTruthy();
    }

    const extraEvt = await Event.create({
      ...buildValidEventPayload(),
      publish: true,
      roles: [
        {
          name: "Public",
          description: "Public role",
          maxParticipants: 10,
          openToPublic: true,
          id: new mongoose.Types.ObjectId().toString(),
        },
      ],
      createdBy: creatorId,
    });
    if (!(extraEvt as any).publicSlug) {
      (extraEvt as any).publicSlug = `test-event-${extraEvt._id
        .toString()
        .slice(-6)}`;
    }
    if (!(extraEvt as any).publishedAt) {
      (extraEvt as any).publishedAt = new Date();
    }
    await extraEvt.save();

    const blocked = await request(app)
      .post("/api/public/short-links")
      .set("Authorization", authHeader)
      .send({ eventId: extraEvt._id.toString() })
      .expect(429);
    expect(blocked.body.code).toBe("RATE_LIMIT_USER");
  });
});

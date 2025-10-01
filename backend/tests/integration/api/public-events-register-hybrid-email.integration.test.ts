/**
 * Integration test: Hybrid public registration includes Zoom details in confirmation email.
 */
import request from "supertest";
import app from "../../../src/app";
import Event from "../../../src/models/Event";
import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { EmailService } from "../../../src/services/infrastructure/emailService";
import { createPublishedEvent } from "../../test-utils/eventTestHelpers";

let opened = false;

// Spy on EmailService.sendEmail
const sendSpy = vi
  .spyOn(EmailService, "sendEmail")
  .mockResolvedValue(true as any);

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    const uri =
      process.env.MONGODB_TEST_URI ||
      "mongodb://127.0.0.1:27017/atcloud-signup-test";
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      family: 4,
    } as any);
    opened = true;
  }
});

afterAll(async () => {
  if (opened && mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

afterEach(async () => {
  sendSpy.mockClear();
  await Event.deleteMany({});
});

describe("Public hybrid registration email", () => {
  test("hybrid event includes zoom link and meeting details when provided", async () => {
    const event = await createPublishedEvent({
      isHybrid: true,
      zoomLink: "https://zoom.us/j/123456789",
      meetingId: "123 456 789",
      passcode: "ABC123",
    });

    // Make first role public if not already
    await Event.findByIdAndUpdate(event._id, {
      $set: { "roles.0.openToPublic": true },
    });
    const roleId = event.roles[0].id;

    const res = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId,
        attendee: { name: "Hybrid Guest", email: "hybrid@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Ensure email was attempted
    expect(sendSpy).toHaveBeenCalled();
    const lastCall = sendSpy.mock.calls.at(-1)?.[0];
    expect(lastCall).toBeTruthy();
    const html = String(lastCall!.html || "");
    const text = String(lastCall!.text || "");

    expect(html).toMatch(/Join Online/i);
    expect(html).toMatch(/zoom/i);
    expect(html).toMatch(/123 456 789/); // meeting id
    expect(html).toMatch(/ABC123/); // passcode
    expect(text).toMatch(/Zoom Link:/);
    expect(text).toMatch(/Meeting ID:/);
    expect(text).toMatch(/Passcode:/);
  });

  test("hybrid event with only zoom link still includes link block", async () => {
    const event = await createPublishedEvent({
      isHybrid: true,
      zoomLink: "https://zoom.us/j/987654321",
      meetingId: "",
      passcode: "",
    });
    await Event.findByIdAndUpdate(event._id, {
      $set: { "roles.0.openToPublic": true },
    });
    const roleId = event.roles[0].id;

    const res = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId,
        attendee: { name: "Link Only", email: "linkonly@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(200);
    expect(res.body.success).toBe(true);

    expect(sendSpy).toHaveBeenCalled();
    const lastCall = sendSpy.mock.calls.at(-1)?.[0];
    expect(lastCall).toBeTruthy();
    const html = String(lastCall!.html || "");
    const text = String(lastCall!.text || "");

    // Even without meetingId/passcode we chose to show section if any detail present
    expect(html).toMatch(/zoom/i);
    expect(text).toMatch(/Zoom Link:/);
  });
});

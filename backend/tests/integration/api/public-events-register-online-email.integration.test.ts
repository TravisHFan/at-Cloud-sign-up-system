/**
 * Integration test: Online public registration includes Zoom details in confirmation email.
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
import { ensureIntegrationDB } from "../setup/connect";

let opened = false;

// Spy on EmailService.sendEmail
const sendSpy = vi
  .spyOn(EmailService, "sendEmail")
  .mockResolvedValue(true as any);

beforeAll(async () => {
  await ensureIntegrationDB();
  opened = true;
});

afterAll(async () => {
  // Connection is shared, don't close it here
});

afterEach(async () => {
  sendSpy.mockClear();
  await Event.deleteMany({});
});

describe("Public online registration email", () => {
  test("online event includes zoom link and meeting details when provided", async () => {
    const event = await createPublishedEvent({
      format: "Online",
      isHybrid: false,
      zoomLink: "https://zoom.us/j/555111222",
      meetingId: "555 111 222",
      passcode: "ONL123",
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
        attendee: { name: "Online Guest", email: "online@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    expect(sendSpy).toHaveBeenCalled();
    const lastCall = sendSpy.mock.calls.at(-1)?.[0];
    const html = String(lastCall!.html || "");
    const text = String(lastCall!.text || "");

    expect(html).toMatch(/Join Online/i);
    expect(html).toMatch(/555 111 222/);
    expect(html).toMatch(/ONL123/);
    expect(text).toMatch(/Zoom Link:/);
    expect(text).toMatch(/Meeting ID:/);
    expect(text).toMatch(/Passcode:/);
  });

  test("online event with only zoom link still includes link block", async () => {
    const event = await createPublishedEvent({
      format: "Online",
      isHybrid: false,
      zoomLink: "https://zoom.us/j/909090909",
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
        attendee: { name: "Link Only", email: "onlineonly@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(200);
    expect(res.body.success).toBe(true);

    expect(sendSpy).toHaveBeenCalled();
    const lastCall = sendSpy.mock.calls.at(-1)?.[0];
    const html = String(lastCall!.html || "");
    const text = String(lastCall!.text || "");

    expect(html).toMatch(/zoom/i);
    expect(text).toMatch(/Zoom Link:/);
  });
});

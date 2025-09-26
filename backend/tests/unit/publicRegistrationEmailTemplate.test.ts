import { describe, it, expect } from "vitest";
import buildPublicRegistrationConfirmationEmail from "../../src/services/emailTemplates/publicRegistrationConfirmation";

const baseEvent = {
  title: "Sample Event",
  date: "2025-10-01",
  endDate: "2025-10-01",
  time: "09:00",
  endTime: "10:30",
  location: "Online / Zoom",
  purpose: "Discuss roadmap, Q&A, and wrap-up.",
  timeZone: "UTC",
};

describe("buildPublicRegistrationConfirmationEmail", () => {
  it("builds non-duplicate email with role", () => {
    const { subject, html, text } = buildPublicRegistrationConfirmationEmail({
      event: baseEvent,
      roleName: "Attendee",
      duplicate: false,
    });
    expect(subject).toContain("Registration Confirmed");
    expect(html).toMatch(/Sample Event/);
    expect(html).toMatch(/Role: <strong>Attendee<\/strong>/);
    expect(text).toMatch(/You are registered\./);
    expect(text).toMatch(/Role: Attendee/);
    expect(text).not.toMatch(/already registered/i);
  });

  it("builds duplicate email without role gracefully", () => {
    const { subject, html, text } = buildPublicRegistrationConfirmationEmail({
      event: baseEvent,
      duplicate: true,
    });
    expect(subject).toContain("Already Registered");
    expect(html).toMatch(/already registered/i);
    expect(text).toMatch(/already registered/i);
  });

  it("escapes HTML entities in dynamic fields", () => {
    const { html } = buildPublicRegistrationConfirmationEmail({
      event: {
        ...baseEvent,
        title: "5 < Things & Stuff >",
        location: 'Room "A"',
      },
      roleName: "Dev & Ops",
    });
    expect(html).toMatch(/5 &lt; Things &amp; Stuff &gt;/);
    expect(html).toMatch(/Room &quot;A&quot;/);
    expect(html).toMatch(/Dev &amp; Ops/);
  });
});

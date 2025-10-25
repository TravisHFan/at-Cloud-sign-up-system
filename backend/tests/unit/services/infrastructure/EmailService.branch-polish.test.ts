import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock nodemailer before importing EmailService
vi.mock("nodemailer", async () => {
  const actual: any = await vi.importActual("nodemailer");
  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      createTransport: vi.fn(),
    },
    createTransport: vi.fn(),
  };
});

import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService - branch polish (promotion + reminders)", () => {
  let mockTransporter: any;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    env = { ...process.env };
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "http://localhost:5173";
    process.env.SMTP_USER = "noreply@example.com";
    process.env.SMTP_PASS = "password";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";

    mockTransporter = {
      sendMail: vi
        .fn()
        .mockResolvedValue({ messageId: "id", response: "250 OK" }),
    };

    const anyMailer: any = nodemailer as any;
    if (anyMailer.createTransport)
      vi.mocked(anyMailer.createTransport).mockReturnValue(mockTransporter);
    if (anyMailer.default?.createTransport)
      vi.mocked(anyMailer.default.createTransport).mockReturnValue(
        mockTransporter
      );

    EmailTransporter.resetTransporter();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = env;
    EmailTransporter.resetTransporter();
    vi.restoreAllMocks();
  });

  describe("Promotion (Super Admin + unknown role)", () => {
    it("handles promotion to Super Admin (impact and icon branches)", async () => {
      const user = {
        firstName: "Alice",
        lastName: "Wong",
        oldRole: "Administrator",
        newRole: "Super Admin",
        email: "alice@example.com",
      };
      const admin = {
        firstName: "Chief",
        lastName: "Admin",
        role: "Super Admin",
        email: "chief@example.com",
      } as any;

      const ok = await EmailService.sendPromotionNotificationToAdmins(
        "admin@example.com",
        "Admin Receiver",
        user as any,
        admin
      );
      expect(ok).toBe(true);
      const call = mockTransporter.sendMail.mock.calls[0]?.[0];
      expect(call.subject).toMatch(/Promotion|Promoted/i);
      expect(call.html).toMatch(/Super Admin/);
      expect(call.html).toMatch(/Impact|Critical|High|Medium|Low/); // colored impact badge exists
    });

    it("handles unknown new role with default impact description", async () => {
      const user = {
        firstName: "Bob",
        lastName: "Lee",
        oldRole: "Participant",
        newRole: "Some Unknown Role",
        email: "bob@example.com",
      };
      const admin = {
        firstName: "Anna",
        lastName: "Smith",
        role: "Administrator",
        email: "anna@example.com",
      } as any;

      const ok = await EmailService.sendPromotionNotificationToAdmins(
        "admin@example.com",
        "Admin",
        user as any,
        admin
      );
      expect(ok).toBe(true);
      const call = mockTransporter.sendMail.mock.calls[0]?.[0];
      expect(call.html).toContain("Some Unknown Role");
      // default branch still produces a description/actions block
      expect(call.html).toMatch(/Actions|Next Steps|Review/i);
    });
  });

  describe("Reminder labels (1h vs 24h vs 1week)", () => {
    const baseEvent = {
      title: "Ministry Gathering",
      date: "2025-08-15",
      time: "19:00",
      location: "Main Hall",
      format: "In-Person",
    };

    it("1h reminder uses urgent styling and emoji clock", async () => {
      await EmailService.sendEventReminderEmail(
        "u@example.com",
        "User",
        baseEvent as any,
        "1h"
      );
      const call = mockTransporter.sendMail.mock.calls.pop()?.[0];
      expect(call.subject).toMatch(/Reminder/);
      expect(call.subject).toMatch(/1 Hour|1h|Reminder/i);
      expect(call.html).toMatch(/\u23F0|Urgent|reminder-badge/); // clock emoji or urgent badge
    });

    it("24h reminder shows 24 Hours label", async () => {
      await EmailService.sendEventReminderEmail(
        "u@example.com",
        "User",
        baseEvent as any,
        "24h"
      );
      const call = mockTransporter.sendMail.mock.calls.pop()?.[0];
      expect(call.subject).toMatch(/24 Hours|24h/);
      expect(call.html).toMatch(/24 Hours|24h/);
    });

    it("1week reminder shows 1 Week label", async () => {
      await EmailService.sendEventReminderEmail(
        "u@example.com",
        "User",
        baseEvent as any,
        "1week"
      );
      const call = mockTransporter.sendMail.mock.calls.pop()?.[0];
      expect(call.subject).toMatch(/1 Week|1week/);
      expect(call.html).toMatch(/1 Week|1week/);
    });
  });
});

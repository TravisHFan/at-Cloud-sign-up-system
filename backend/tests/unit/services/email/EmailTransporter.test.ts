/**
 * EmailTransporter Unit Tests
 *
 * Tests email transporter configuration and send functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";

// Mock nodemailer
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
    }),
  },
}));

vi.mock("../../../../src/services/LoggerService", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import nodemailer from "nodemailer";

describe("EmailTransporter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    EmailTransporter.resetTransporter();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    EmailTransporter.resetTransporter();
  });

  describe("getTransporter", () => {
    it("should create development transporter without credentials", () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const transporter = EmailTransporter.getTransporter();
      expect(transporter).toBeDefined();
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        jsonTransport: true,
      });
    });

    it("should reuse existing transporter", () => {
      const transporter1 = EmailTransporter.getTransporter();
      const transporter2 = EmailTransporter.getTransporter();
      expect(transporter1).toBe(transporter2);
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });

    it("should create production transporter with valid credentials", () => {
      process.env.NODE_ENV = "production";
      process.env.SMTP_USER = "real-user@example.com";
      process.env.SMTP_PASS = "real-password-123";
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_SECURE = "true";

      EmailTransporter.getTransporter();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 465,
        secure: true,
        auth: {
          user: "real-user@example.com",
          pass: "real-password-123",
        },
      });
    });

    it("should create development transporter with real credentials", () => {
      process.env.NODE_ENV = "development";
      process.env.SMTP_USER = "real-user@example.com";
      process.env.SMTP_PASS = "real-password-123";

      EmailTransporter.getTransporter();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            user: "real-user@example.com",
            pass: "real-password-123",
          },
          secure: false,
        }),
      );
    });
  });

  describe("send", () => {
    it("should send email with basic options", async () => {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-123" });
      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const result = await EmailTransporter.send({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
        text: "Test content",
      });

      expect(result).toEqual({ messageId: "test-123" });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: "Test Subject",
          html: "<p>Test content</p>",
          text: "Test content",
        }),
      );
    });

    it("should include replyTo when provided", async () => {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-123" });
      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      await EmailTransporter.send({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
        replyTo: "reply@example.com",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: "reply@example.com",
        }),
      );
    });

    it("should include attachments when provided", async () => {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-123" });
      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const attachments = [
        {
          filename: "test.pdf",
          content: Buffer.from("test content"),
        },
      ];

      await EmailTransporter.send({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
        attachments,
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments,
        }),
      );
    });

    it("should not include attachments when empty array", async () => {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-123" });
      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      await EmailTransporter.send({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
        attachments: [],
      });

      // attachments should not be set when empty
      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.attachments).toBeUndefined();
    });
  });

  describe("resetTransporter", () => {
    it("should allow creating new transporter after reset", () => {
      EmailTransporter.getTransporter();
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);

      EmailTransporter.resetTransporter();
      EmailTransporter.getTransporter();
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
    });
  });
});

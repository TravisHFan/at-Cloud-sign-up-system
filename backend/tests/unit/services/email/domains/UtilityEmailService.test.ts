/**
 * UtilityEmailService Test Suite
 *
 * Tests generic/utility email functionality:
 * - Generic notification emails with custom content
 * - HTML and text content handling
 * - Attachment support
 *
 * Testing Strategy:
 * - Spy on UtilityEmailService methods to test actual business logic
 * - Mock only external dependencies (EmailTransporter)
 * - Verify email content structure and template wrapping
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailTransporter } from "../../../../../src/services/email/EmailTransporter";

// Mock nodemailer to avoid external dependencies
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
import { UtilityEmailService } from "../../../../../src/services/email/domains/UtilityEmailService";

describe("UtilityEmailService - Generic Email Operations", () => {
  let mockTransporter: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Setup production-like env to ensure emails actually send
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "http://localhost:5173";
    process.env.SMTP_USER = "test@example.com";
    process.env.SMTP_PASS = "test-password";
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_PORT = "587";

    // Create mock transporter
    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        response: "250 OK",
      }),
    };

    // Mock nodemailer.createTransport
    const anyMailer: any = nodemailer as any;
    if (
      anyMailer.createTransport &&
      typeof anyMailer.createTransport === "function"
    ) {
      vi.mocked(anyMailer.createTransport).mockReturnValue(mockTransporter);
    }
    if (anyMailer.default?.createTransport) {
      vi.mocked(anyMailer.default.createTransport).mockReturnValue(
        mockTransporter
      );
    }

    // Reset static transporter for clean state
    EmailTransporter.resetTransporter();

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    EmailTransporter.resetTransporter();
    vi.restoreAllMocks();
  });

  describe("sendGenericNotificationEmail", () => {
    it("should send generic notification with custom HTML content", async () => {
      // Arrange
      const payload = {
        subject: "Important Notification",
        contentHtml: "<p>This is a <strong>custom</strong> notification.</p>",
        contentText: "This is a custom notification.",
      };

      // Act
      const result = await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "User Name",
        payload
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toBe("Important Notification");
      expect(emailCall.html).toContain("<strong>custom</strong>");
      expect(emailCall.html).toContain("Important Notification");
      expect(emailCall.html).toContain("@Cloud Ministry Team");
      expect(emailCall.text).toBe("This is a custom notification.");
    });

    it("should wrap custom content in proper HTML template structure", async () => {
      // Arrange
      const payload = {
        subject: "Test Subject",
        contentHtml: "<p>Test content</p>",
      };

      // Act
      await UtilityEmailService.sendGenericNotificationEmail(
        "test@example.com",
        "Test User",
        payload
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("<!DOCTYPE html>");
      expect(emailCall.html).toContain("<style>");
      expect(emailCall.html).toContain("background: linear-gradient");
      expect(emailCall.html).toContain('class="container"');
      expect(emailCall.html).toContain('class="header"');
      expect(emailCall.html).toContain('class="content"');
      expect(emailCall.html).toContain("<p>Test content</p>");
    });

    it("should handle emails without text content", async () => {
      // Arrange
      const payload = {
        subject: "HTML Only Email",
        contentHtml: "<p>Only HTML content here</p>",
        // No contentText provided
      };

      // Act
      const result = await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "User",
        payload
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Only HTML content here");
      expect(emailCall.text).toBeUndefined();
    });

    it("should handle attachments correctly", async () => {
      // Arrange
      const payload = {
        subject: "Email with Attachment",
        contentHtml: "<p>See attached file</p>",
        contentText: "See attached file",
        attachments: [
          {
            filename: "document.pdf",
            path: "/path/to/document.pdf",
          },
          {
            filename: "image.png",
            content: Buffer.from("fake-image-data"),
          },
        ],
      };

      // Act
      const result = await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "User",
        payload
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.attachments).toEqual(payload.attachments);
      expect(emailCall.attachments).toHaveLength(2);
      expect(emailCall.attachments[0].filename).toBe("document.pdf");
      expect(emailCall.attachments[1].filename).toBe("image.png");
    });

    it("should handle special characters in subject and content", async () => {
      // Arrange
      const payload = {
        subject: "Special Characters: @#$%&*()_+-=[]{}|;:',.<>?",
        contentHtml:
          "<p>Content with special chars: \"quotes\" & 'apostrophes' < > &</p>",
        contentText: "Content with special chars: \"quotes\" & 'apostrophes'",
      };

      // Act
      const result = await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "User",
        payload
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.subject).toContain("@#$%&*()_+-=[]{}|;:',.<>?");
      expect(emailCall.html).toContain("\"quotes\" & 'apostrophes'");
    });

    it("should handle very long HTML content", async () => {
      // Arrange
      const longContent = "<p>" + "Very long paragraph. ".repeat(100) + "</p>";
      const payload = {
        subject: "Long Content Email",
        contentHtml: longContent,
      };

      // Act
      const result = await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "User",
        payload
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Very long paragraph");
      expect(emailCall.html.length).toBeGreaterThan(1000);
    });

    it("should include standard closing signature", async () => {
      // Arrange
      const payload = {
        subject: "Test",
        contentHtml: "<p>Content</p>",
      };

      // Act
      await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "User",
        payload
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Blessings,");
      expect(emailCall.html).toContain("The @Cloud Ministry Team");
    });

    it("should use subject in email header and title", async () => {
      // Arrange
      const payload = {
        subject: "Custom Subject Line",
        contentHtml: "<p>Body content</p>",
      };

      // Act
      await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "User",
        payload
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("<title>Custom Subject Line</title>");
      expect(emailCall.html).toContain("<h2>Custom Subject Line</h2>");
    });

    it("should handle empty HTML content gracefully", async () => {
      // Arrange
      const payload = {
        subject: "Empty Content",
        contentHtml: "",
        contentText: "Text version",
      };

      // Act
      const result = await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "User",
        payload
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Empty Content");
      expect(emailCall.text).toBe("Text version");
    });

    it("should handle email sending failures", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(
        new Error("SMTP connection lost")
      );
      const payload = {
        subject: "Test",
        contentHtml: "<p>Content</p>",
      };

      // Act
      const result = await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "User",
        payload
      );

      // Assert - EmailService catches errors and returns false
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Email send failed:",
        expect.any(Error)
      );
    });

    it("should accept nameOrTitle parameter for API compatibility", async () => {
      // Arrange
      const payload = {
        subject: "Test",
        contentHtml: "<p>Content</p>",
      };

      // Act - nameOrTitle parameter is accepted but currently unused
      const result = await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "Some Name Or Title",
        payload
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    });

    it("should handle complex HTML with multiple elements", async () => {
      // Arrange
      const payload = {
        subject: "Complex HTML Email",
        contentHtml: `
          <h1>Main Heading</h1>
          <p>First paragraph with <a href="http://example.com">link</a>.</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <table>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
          </table>
        `,
      };

      // Act
      const result = await UtilityEmailService.sendGenericNotificationEmail(
        "user@example.com",
        "User",
        payload
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("<h1>Main Heading</h1>");
      expect(emailCall.html).toContain("<ul>");
      expect(emailCall.html).toContain("<table>");
      expect(emailCall.html).toContain('href="http://example.com"');
    });
  });

  describe("Integration with EmailTransporter", () => {
    it("should properly initialize EmailTransporter on first use", async () => {
      // Arrange
      const payload = {
        subject: "Test",
        contentHtml: "<p>Test</p>",
      };

      // Act
      await UtilityEmailService.sendGenericNotificationEmail(
        "test@example.com",
        "Test",
        payload
      );

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it("should reuse EmailTransporter for multiple sends", async () => {
      // Arrange
      const payload = {
        subject: "Test",
        contentHtml: "<p>Test</p>",
      };

      // Act
      await UtilityEmailService.sendGenericNotificationEmail(
        "user1@example.com",
        "User 1",
        payload
      );
      await UtilityEmailService.sendGenericNotificationEmail(
        "user2@example.com",
        "User 2",
        payload
      );
      await UtilityEmailService.sendGenericNotificationEmail(
        "user3@example.com",
        "User 3",
        payload
      );

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      // Transporter should only be created once
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });
  });
});

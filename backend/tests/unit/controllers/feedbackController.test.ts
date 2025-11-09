/**
 * Unit tests for FeedbackController
 * Testing user feedback submission system
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { Request, Response } from "express";
import { FeedbackController } from "../../../src/controllers/feedbackController";
import { EmailService } from "../../../src/services/infrastructure/EmailServiceFacade";

// Mock EmailService
vi.mock("../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendGenericNotificationEmail: vi.fn(),
  },
}));

// Mock fetch for image downloads
global.fetch = vi.fn();

describe("FeedbackController", () => {
  let mockReq: Partial<Request> & { user?: any };
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: {},
      user: undefined,
      headers: {},
      protocol: "http",
      get: vi.fn((header: string) =>
        header === "host" ? "localhost:5001" : undefined
      ),
    } as any;

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Reset environment variables
    delete process.env.SYSTEM_EMAIL;
    delete process.env.SMTP_USER;
  });

  describe("submitFeedback", () => {
    describe("validation - required fields", () => {
      it("should return 400 if type is missing", async () => {
        mockReq.body = {
          subject: "Test Subject",
          message: "Test message content here",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Type, subject, and message are required",
        });
      });

      it("should return 400 if subject is missing", async () => {
        mockReq.body = {
          type: "bug",
          message: "Test message content here",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Type, subject, and message are required",
        });
      });

      it("should return 400 if message is missing", async () => {
        mockReq.body = {
          type: "bug",
          subject: "Test Subject",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Type, subject, and message are required",
        });
      });
    });

    describe("validation - feedback type", () => {
      it("should return 400 for invalid feedback type", async () => {
        mockReq.body = {
          type: "invalid",
          subject: "Test Subject",
          message: "Test message content here",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Type must be one of: bug, improvement, general",
        });
      });

      it("should accept 'bug' as valid type", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Test Subject",
          message: "Test message content here",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(EmailService.sendGenericNotificationEmail).toHaveBeenCalled();
      });

      it("should accept 'improvement' as valid type", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "improvement",
          subject: "Test Subject",
          message: "Test message content here",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(EmailService.sendGenericNotificationEmail).toHaveBeenCalled();
      });

      it("should accept 'general' as valid type", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "general",
          subject: "Test Subject",
          message: "Test message content here",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(EmailService.sendGenericNotificationEmail).toHaveBeenCalled();
      });
    });

    describe("validation - subject length", () => {
      it("should return 400 if subject exceeds 200 characters", async () => {
        mockReq.body = {
          type: "bug",
          subject: "a".repeat(201),
          message: "Test message content here",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Subject must be 200 characters or less",
        });
      });

      it("should accept subject at exactly 200 characters", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "a".repeat(200),
          message: "Test message content here",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("validation - message length", () => {
      it("should return 400 if message has less than 10 characters (without images)", async () => {
        mockReq.body = {
          type: "bug",
          subject: "Test Subject",
          message: "Short",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Message must be at least 10 characters",
        });
      });

      it("should accept message with less than 10 chars if it contains an image", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Test Subject",
          message: "Short<img src='test.jpg'>",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should return 400 if message text exceeds 2000 characters", async () => {
        mockReq.body = {
          type: "bug",
          subject: "Test Subject",
          message: "a".repeat(2001),
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Message must be 2000 characters or less",
        });
      });

      it("should strip HTML tags when checking message length", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Test Subject",
          message: "<p>Valid message with enough text</p>",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("authenticated user feedback", () => {
      it("should include user information in email for authenticated user", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.user = {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          role: "organizer",
        };
        mockReq.body = {
          type: "bug",
          subject: "Found a bug",
          message: "This is a bug report with enough text",
          includeContact: true,
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(EmailService.sendGenericNotificationEmail).toHaveBeenCalledWith(
          "admin@example.com",
          "@Cloud System Feedback",
          expect.objectContaining({
            subject: "[@Cloud Feedback] BUG: Found a bug",
            contentHtml: expect.stringContaining("user123"),
            contentText: expect.stringContaining("John Doe"),
          })
        );
      });

      it("should handle includeContact flag correctly", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.user = {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          role: "organizer",
        };
        mockReq.body = {
          type: "improvement",
          subject: "Feature request",
          message: "This is a feature request with enough text",
          includeContact: false,
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].contentText).toContain("Include Contact: No");
      });
    });

    describe("anonymous user feedback", () => {
      it("should handle feedback from anonymous user", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.user = undefined;
        mockReq.body = {
          type: "general",
          subject: "General feedback",
          message: "This is general feedback with enough text",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].contentText).toContain("Anonymous user");
      });
    });

    describe("email subject formatting", () => {
      it("should format email subject correctly for bug type", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Test Bug",
          message: "Bug description with enough text",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].subject).toBe("[@Cloud Feedback] BUG: Test Bug");
      });

      it("should format email subject correctly for improvement type", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "improvement",
          subject: "Test Improvement",
          message: "Improvement description with enough text",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].subject).toBe(
          "[@Cloud Feedback] IMPROVEMENT: Test Improvement"
        );
      });
    });

    describe("HTML email styling", () => {
      it("should use red color style for bug type", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Bug Report",
          message: "Bug details with enough text",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].contentHtml).toContain("#fef2f2");
        expect(emailCall[2].contentHtml).toContain("#dc2626");
      });

      it("should use blue color style for improvement type", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "improvement",
          subject: "Feature Request",
          message: "Feature details with enough text",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].contentHtml).toContain("#f0f9ff");
        expect(emailCall[2].contentHtml).toContain("#2563eb");
      });

      it("should use neutral color style for general type", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "general",
          subject: "General Feedback",
          message: "General feedback with enough text",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].contentHtml).toContain("#f9fafb");
        expect(emailCall[2].contentHtml).toContain("#374151");
      });
    });

    describe("image handling", () => {
      it("should process images in message and convert to CID attachments", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Bug with screenshot",
          message:
            'Message text <img src="http://example.com/image.png" alt="test"/>',
        };

        // Mock successful fetch
        (global.fetch as Mock).mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (header: string) =>
              header === "content-type" ? "image/png" : null,
          },
          arrayBuffer: async () => new ArrayBuffer(100),
        });

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(global.fetch).toHaveBeenCalledWith(
          "http://example.com/image.png"
        );
        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].attachments).toBeDefined();
        expect(emailCall[2].attachments.length).toBe(1);
        expect(emailCall[2].contentHtml).toContain("cid:");
      });

      it("should resolve relative image URLs from request", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Bug with relative image",
          message: 'Message <img src="/uploads/images/test.png"/>',
        };
        (mockReq as any).protocol = "http";
        (mockReq.get as Mock).mockReturnValue("localhost:5001");

        // Mock successful fetch
        (global.fetch as Mock).mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (header: string) =>
              header === "content-type" ? "image/png" : null,
          },
          arrayBuffer: async () => new ArrayBuffer(100),
        });

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:5001/uploads/images/test.png"
        );
      });

      it("should handle x-forwarded-proto header for image resolution", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Bug with image",
          message: 'Message <img src="/uploads/test.jpg"/>',
        };
        mockReq.headers = { "x-forwarded-proto": "https" };
        (mockReq.get as Mock).mockReturnValue("example.com");

        // Mock successful fetch
        (global.fetch as Mock).mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (header: string) =>
              header === "content-type" ? "image/jpeg" : null,
          },
          arrayBuffer: async () => new ArrayBuffer(100),
        });

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(global.fetch).toHaveBeenCalledWith(
          "https://example.com/uploads/test.jpg"
        );
      });

      it("should skip failed image downloads gracefully", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Bug with broken image",
          message: 'Message <img src="http://example.com/broken.png"/>',
        };

        // Mock failed fetch
        (global.fetch as Mock).mockRejectedValueOnce(
          new Error("Network error")
        );

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        // Should still send email without the attachment
        expect(emailCall[2].attachments.length).toBe(0);
      });

      it("should skip images with non-ok response", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Bug with 404 image",
          message: 'Message <img src="http://example.com/notfound.png"/>',
        };

        // Mock 404 response
        (global.fetch as Mock).mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].attachments.length).toBe(0);
      });

      it("should deduplicate identical image URLs", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Bug with duplicate images",
          message:
            'Message <img src="http://example.com/img.png"/> and <img src="http://example.com/img.png"/>',
        };

        // Mock successful fetch
        (global.fetch as Mock).mockResolvedValue({
          ok: true,
          headers: {
            get: (header: string) =>
              header === "content-type" ? "image/png" : null,
          },
          arrayBuffer: async () => new ArrayBuffer(100),
        });

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        // Should only fetch once despite duplicate URLs
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].attachments.length).toBe(1);
      });

      it("should skip images already using CID", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Bug with CID image",
          message: 'Message <img src="cid:existing"/>',
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        // Should not try to fetch CID URLs
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("should detect content type and use appropriate file extension", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Bug with gif",
          message: 'Message <img src="http://example.com/anim.gif"/>',
        };

        (global.fetch as Mock).mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (header: string) =>
              header === "content-type" ? "image/gif" : null,
          },
          arrayBuffer: async () => new ArrayBuffer(100),
        });

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        const emailCall = (EmailService.sendGenericNotificationEmail as Mock)
          .mock.calls[0];
        expect(emailCall[2].attachments[0].filename).toContain("feedback");
      });
    });

    describe("system email configuration", () => {
      it("should use SYSTEM_EMAIL when configured", async () => {
        process.env.SYSTEM_EMAIL = "system@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Test",
          message: "Test message with enough text",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(EmailService.sendGenericNotificationEmail).toHaveBeenCalledWith(
          "system@example.com",
          "@Cloud System Feedback",
          expect.any(Object)
        );
      });

      it("should fallback to SMTP_USER when SYSTEM_EMAIL not set", async () => {
        delete process.env.SYSTEM_EMAIL;
        process.env.SMTP_USER = "smtp@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Test",
          message: "Test message with enough text",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(EmailService.sendGenericNotificationEmail).toHaveBeenCalledWith(
          "smtp@example.com",
          "@Cloud System Feedback",
          expect.any(Object)
        );
      });

      it("should warn and skip email when no system email configured", async () => {
        delete process.env.SYSTEM_EMAIL;
        delete process.env.SMTP_USER;
        const consoleWarnSpy = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        mockReq.body = {
          type: "bug",
          subject: "Test",
          message: "Test message with enough text",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "SYSTEM_EMAIL/SMTP_USER not configured; feedback email suppressed."
        );
        expect(
          EmailService.sendGenericNotificationEmail
        ).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);

        consoleWarnSpy.mockRestore();
      });
    });

    describe("success response", () => {
      it("should return success response with timestamp", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Test",
          message: "Test message with enough text",
        };

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Feedback submitted successfully",
          data: {
            submitted: true,
            timestamp: expect.stringMatching(/\d{4}-\d{2}-\d{2}T/),
          },
        });
      });
    });

    describe("error handling", () => {
      it("should return 500 when email service throws error", async () => {
        process.env.SYSTEM_EMAIL = "admin@example.com";
        mockReq.body = {
          type: "bug",
          subject: "Test",
          message: "Test message with enough text",
        };

        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        (
          EmailService.sendGenericNotificationEmail as Mock
        ).mockRejectedValueOnce(new Error("Email service down"));

        await FeedbackController.submitFeedback(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to submit feedback. Please try again later.",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Feedback submission error:",
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });
});

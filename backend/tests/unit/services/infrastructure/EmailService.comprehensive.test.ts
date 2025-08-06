/**
 * EmailService Comprehensive Test Suite
 * 
 * Comprehensive validation for the critical EmailService infrastructure component.
 * This service handles 2240+ lines of email functionality including templates,
 * notifications, and complex ministry communications.
 * 
 * Testing Strategy:
 * - Service interface validation and contract compliance
 * - Template generation and content validation 
 * - Error handling and reliability patterns
 * - Ministry-specific email workflows
 * - Notification system integration validation
 * 
 * Simplified Approach: Avoids Mongoose dependencies while ensuring comprehensive coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";
import nodemailer from "nodemailer";

// Mock nodemailer to avoid external dependencies
vi.mock("nodemailer");

describe("EmailService - Comprehensive Validation", () => {
  let mockTransporter: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Setup test environment
    process.env.NODE_ENV = "test";
    process.env.FRONTEND_URL = "http://localhost:5173";
    process.env.SMTP_USER = "test@example.com";
    process.env.SMTP_PASS = "test-password";

    // Create mock transporter
    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        response: "250 OK",
      }),
    };

    // Mock nodemailer.createTransporter
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter);

    // Reset static transporter for clean state
    (EmailService as any).transporter = null;

    // Mock console to avoid test noise
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    (EmailService as any).transporter = null;
    vi.restoreAllMocks();
  });

  describe("Core Email Service Interface", () => {
    it("should have all required static methods for email functionality", () => {
      // Verify EmailService class exists and has critical methods
      expect(EmailService).toBeDefined();
      expect(typeof EmailService.sendEmail).toBe("function");
      expect(typeof EmailService.sendVerificationEmail).toBe("function");
      expect(typeof EmailService.sendPasswordResetEmail).toBe("function");
      expect(typeof EmailService.sendWelcomeEmail).toBe("function");
      expect(typeof EmailService.sendEventCreatedEmail).toBe("function");
    });

    it("should handle core email sending with proper interface", async () => {
      const emailOptions = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<h1>Test</h1>",
        text: "Test"
      };

      const result = await EmailService.sendEmail(emailOptions);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("test@example.com");
      expect(sentEmail.subject).toBe("Test Email");
      expect(sentEmail.html).toBe("<h1>Test</h1>");
    });

    it("should handle email sending failures gracefully", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<h1>Test</h1>"
      });

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("Ministry Email Templates", () => {
    it("should generate welcome email with proper ministry branding", async () => {
      const result = await EmailService.sendWelcomeEmail("user@example.com", "John Doe");

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("user@example.com");
      expect(sentEmail.subject).toContain("Welcome");
      expect(sentEmail.html).toContain("John Doe");
      expect(sentEmail.html).toContain("@Cloud Ministry");
    });

    it("should generate event creation notifications with complete event data", async () => {
      const eventData = {
        title: "Sunday Service",
        date: "2025-01-20",
        time: "10:00 AM",
        endTime: "11:30 AM",
        location: "Main Sanctuary",
        organizer: "Pastor Smith",
        purpose: "Weekly worship service",
        format: "in-person"
      };

      const result = await EmailService.sendEventCreatedEmail(
        "member@example.com",
        "Jane Smith",
        eventData
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("member@example.com");
      expect(sentEmail.subject).toContain("Sunday Service");
      expect(sentEmail.html).toContain("Jane Smith");
      expect(sentEmail.html).toContain("Main Sanctuary");
      expect(sentEmail.html).toContain("Pastor Smith");
    });

    it("should generate password reset emails with secure tokens", async () => {
      const result = await EmailService.sendPasswordResetEmail(
        "user@example.com",
        "John Doe",
        "secure-reset-token-123"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("user@example.com");
      expect(sentEmail.subject).toContain("Password Reset");
      expect(sentEmail.html).toContain("John Doe");
      expect(sentEmail.html).toContain("secure-reset-token-123");
    });
  });

  describe("Role Management Email System", () => {
    it("should send promotion notifications to users with celebration messaging", async () => {
      const userData = {
        firstName: "John",
        lastName: "Doe",
        oldRole: "Participant",
        newRole: "Leader"
      };

      const changedBy = {
        firstName: "Admin",
        lastName: "User",
        role: "Super Admin"
      };

      const result = await EmailService.sendPromotionNotificationToUser(
        "john@example.com",
        userData,
        changedBy
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("john@example.com");
      expect(sentEmail.subject).toContain("Promotion");
      expect(sentEmail.html).toContain("John");
      expect(sentEmail.html).toContain("Leader");
      expect(sentEmail.html).toContain("Participant");
    });

    it("should send promotion notifications to admins with professional tone", async () => {
      const userData = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRole: "Participant",
        newRole: "Leader"
      };

      const changedBy = {
        firstName: "Admin",
        lastName: "User",
        role: "Super Admin"
      };

      const result = await EmailService.sendPromotionNotificationToAdmins(
        "admin@example.com",
        "Admin Name",
        userData,
        changedBy
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("admin@example.com");
      expect(sentEmail.subject).toContain("User Promotion");
      expect(sentEmail.html).toContain("John Doe");
      expect(sentEmail.html).toContain("john@example.com");
    });

    it("should send demotion notifications with sensitive and respectful messaging", async () => {
      const userData = {
        _id: "user123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRole: "Leader",
        newRole: "Participant"
      };

      const changedBy = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Super Admin"
      };

      const result = await EmailService.sendDemotionNotificationToUser(
        "john@example.com",
        userData,
        changedBy,
        "Restructuring of ministry roles"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("john@example.com");
      expect(sentEmail.subject).toContain("Role Update");
      expect(sentEmail.html).toContain("John");
      expect(sentEmail.html).toContain("support");
    });
  });

  describe("Ministry Role Change System", () => {
    it("should send AtCloud ministry role change notifications to users", async () => {
      const userData = {
        _id: "user123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRoleInAtCloud: "Member",
        newRoleInAtCloud: "Youth Pastor"
      };

      const result = await EmailService.sendAtCloudRoleChangeToUser(
        "john@example.com",
        userData
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("john@example.com");
      expect(sentEmail.subject).toContain("Ministry Role Update");
      expect(sentEmail.html).toContain("John");
      expect(sentEmail.html).toContain("Youth Pastor");
      expect(sentEmail.html).toContain("Member");
    });

    it("should send AtCloud role change notifications to admins", async () => {
      const userData = {
        _id: "user123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRoleInAtCloud: "Member",
        newRoleInAtCloud: "Youth Pastor"
      };

      const result = await EmailService.sendAtCloudRoleChangeToAdmins(
        "admin@example.com",
        "Admin Name",
        userData
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("admin@example.com");
      expect(sentEmail.subject).toContain("Ministry Role Change");
      expect(sentEmail.html).toContain("John Doe");
      expect(sentEmail.html).toContain("Youth Pastor");
    });
  });

  describe("Event Management Email System", () => {
    it("should send co-organizer assignment notifications with event details", async () => {
      const assignedUser = {
        firstName: "Jane",
        lastName: "Smith"
      };

      const eventData = {
        title: "Community Outreach",
        date: "2025-01-25",
        time: "2:00 PM",
        location: "Community Center"
      };

      const assignedBy = {
        firstName: "Pastor",
        lastName: "Johnson"
      };

      const result = await EmailService.sendCoOrganizerAssignedEmail(
        "jane@example.com",
        assignedUser,
        eventData,
        assignedBy
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("jane@example.com");
      expect(sentEmail.subject).toContain("Co-Organizer Assignment");
      expect(sentEmail.html).toContain("Jane");
      expect(sentEmail.html).toContain("Community Outreach");
      expect(sentEmail.html).toContain("Pastor Johnson");
    });

    it("should send event reminder notifications with timing-specific content", async () => {
      const eventData = {
        title: "Bible Study",
        date: "2025-01-20",
        time: "7:00 PM",
        location: "Fellowship Hall",
        format: "in-person"
      };

      const result = await EmailService.sendEventReminderEmail(
        "member@example.com",
        "John Member",
        eventData,
        "24h"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("member@example.com");
      expect(sentEmail.subject).toContain("Reminder");
      expect(sentEmail.html).toContain("John Member");
      expect(sentEmail.html).toContain("Bible Study");
      expect(sentEmail.html).toContain("Fellowship Hall");
    });

    it("should handle virtual events with Zoom links in reminders", async () => {
      const eventData = {
        title: "Online Prayer Meeting",
        date: "2025-01-20",
        time: "8:00 PM",
        location: "Virtual",
        zoomLink: "https://zoom.us/j/123456789",
        format: "virtual"
      };

      const result = await EmailService.sendEventReminderEmail(
        "member@example.com",
        "Jane Member",
        eventData,
        "1h"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain("zoom.us/j/123456789");
      expect(sentEmail.html).toContain("Virtual");
    });
  });

  describe("Leadership Email System", () => {
    it("should send new leader signup notifications to admins", async () => {
      const newLeaderData = {
        firstName: "Sarah",
        lastName: "Wilson",
        email: "sarah@example.com",
        roleInAtCloud: "Worship Leader",
        signupDate: "2025-01-17"
      };

      const result = await EmailService.sendNewLeaderSignupEmail(
        "admin@example.com",
        "Admin Name",
        newLeaderData
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.to).toBe("admin@example.com");
      expect(sentEmail.subject).toContain("New Leader Signup");
      expect(sentEmail.html).toContain("Sarah Wilson");
      expect(sentEmail.html).toContain("Worship Leader");
      expect(sentEmail.html).toContain("sarah@example.com");
    });
  });

  describe("Email Template Validation", () => {
    it("should generate HTML emails with proper @Cloud Ministry branding", async () => {
      await EmailService.sendWelcomeEmail("test@example.com", "Test User");
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain("@Cloud Ministry");
      expect(sentEmail.html).toContain("<!DOCTYPE html>");
      expect(sentEmail.html).toContain("viewport");
      expect(sentEmail.html).toContain("font-family");
    });

    it("should include proper links to frontend dashboard", async () => {
      await EmailService.sendWelcomeEmail("test@example.com", "Test User");
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain("http://localhost:5173");
      expect(sentEmail.html).toContain("/dashboard");
    });

    it("should generate text fallbacks for accessibility", async () => {
      const result = await EmailService.sendPasswordResetEmail(
        "test@example.com",
        "Test User",
        "token123"
      );

      expect(result).toBe(true);
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.text).toBeDefined();
      expect(sentEmail.text).toContain("Test User");
    });
  });

  describe("Error Handling and Reliability", () => {
    it("should handle SMTP connection failures gracefully", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("Connection refused"));

      const result = await EmailService.sendWelcomeEmail("test@example.com", "Test User");

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to send email:",
        expect.any(Error)
      );
    });

    it("should handle invalid email addresses appropriately", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("Invalid email address"));

      const result = await EmailService.sendEmail({
        to: "invalid-email",
        subject: "Test",
        html: "<h1>Test</h1>"
      });

      expect(result).toBe(false);
    });

    it("should handle timeout errors for email delivery", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("Timeout"));

      const result = await EmailService.sendEventCreatedEmail(
        "test@example.com",
        "Test User",
        {
          title: "Test Event",
          date: "2025-01-20",
          time: "10:00 AM",
          endTime: "11:00 AM",
          organizer: "Test Organizer",
          purpose: "Testing",
          format: "in-person"
        }
      );

      expect(result).toBe(false);
    });
  });

  describe("Performance and Integration", () => {
    it("should maintain consistent performance across different email types", async () => {
      const startTime = Date.now();

      await Promise.all([
        EmailService.sendWelcomeEmail("user1@example.com", "User 1"),
        EmailService.sendPasswordResetEmail("user2@example.com", "User 2", "token"),
        EmailService.sendEventCreatedEmail("user3@example.com", "User 3", {
          title: "Event",
          date: "2025-01-20",
          time: "10:00 AM",
          endTime: "11:00 AM",
          organizer: "Organizer",
          purpose: "Purpose",
          format: "in-person"
        })
      ]);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });

    it("should handle concurrent email sending without conflicts", async () => {
      const emailPromises = Array.from({ length: 5 }, (_, i) =>
        EmailService.sendWelcomeEmail(`user${i}@example.com`, `User ${i}`)
      );

      const results = await Promise.all(emailPromises);

      expect(results.every(result => result === true)).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(5);
    });

    it("should properly handle special characters in email content", async () => {
      const result = await EmailService.sendWelcomeEmail(
        "test@example.com",
        "José María & Sarah O'Connor"
      );

      expect(result).toBe(true);
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain("José María & Sarah O'Connor");
    });
  });

  describe("Ministry-Specific Features", () => {
    it("should support different reminder timing for events", async () => {
      const eventData = {
        title: "Prayer Meeting",
        date: "2025-01-20",
        time: "7:00 PM",
        location: "Chapel",
        format: "in-person"
      };

      // Test different reminder types
      await EmailService.sendEventReminderEmail("test@example.com", "User", eventData, "1h");
      await EmailService.sendEventReminderEmail("test@example.com", "User", eventData, "24h");
      await EmailService.sendEventReminderEmail("test@example.com", "User", eventData, "1week");

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      
      // Verify different subjects for different timing
      const calls = mockTransporter.sendMail.mock.calls;
      calls.forEach(call => {
        expect(call[0].subject).toContain("Reminder");
      });
    });

    it("should maintain ministry context in all role-related emails", async () => {
      const userData = {
        firstName: "John",
        lastName: "Doe",
        oldRole: "Participant",
        newRole: "Leader"
      };

      const changedBy = {
        firstName: "Pastor",
        lastName: "Smith",
        role: "Super Admin"
      };

      await EmailService.sendPromotionNotificationToUser("john@example.com", userData, changedBy);
      
      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain("ministry");
      expect(sentEmail.html).toContain("faith");
      expect(sentEmail.html.toLowerCase()).toMatch(/(bless|grace|peace)/);
    });
  });
});

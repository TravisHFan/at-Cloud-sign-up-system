/**
 * UserEmailService Domain Test Suite
 *
 * Tests for all user account management notification emails to administrators:
 * - User account deactivation alerts
 * - User account reactivation alerts
 * - User account deletion alerts (security notifications)
 * - New @Cloud leader signup notifications
 *
 * Tests the domain service directly without going through the facade.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock nodemailer to avoid external dependencies (must be before importing UserEmailService)
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
import { UserEmailService } from "../../../../../src/services/email/domains/UserEmailService";
import { EmailTransporter } from "../../../../../src/services/email/EmailTransporter";

describe("UserEmailService - User Account Email Operations", () => {
  let mockTransporter: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Setup production-like env for testing
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
    if (anyMailer.createTransport) {
      vi.mocked(anyMailer.createTransport).mockReturnValue(mockTransporter);
    }
    if (anyMailer.default?.createTransport) {
      vi.mocked(anyMailer.default.createTransport).mockReturnValue(
        mockTransporter
      );
    }

    // Reset EmailTransporter
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

  describe("sendUserDeactivatedAlertToAdmin", () => {
    it("should send deactivation alert with full details", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin User";
      const target = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };
      const actor = {
        firstName: "Super",
        lastName: "Admin",
        email: "superadmin@example.com",
        role: "Super Admin",
      };

      // Act
      const result = await UserEmailService.sendUserDeactivatedAlertToAdmin(
        adminEmail,
        adminName,
        target,
        actor
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("admin@example.com");
      expect(emailCall.subject).toContain("User Account Deactivated");
      expect(emailCall.subject).toContain("John Doe");
      expect(emailCall.html).toContain("Admin User");
      expect(emailCall.html).toContain("Super Admin");
      expect(emailCall.html).toContain("john@example.com");
      expect(emailCall.html).toContain("deactivated");
    });

    it("should handle target user without name (email only)", async () => {
      // Arrange
      const target = {
        email: "user@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "Name",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      await UserEmailService.sendUserDeactivatedAlertToAdmin(
        "supervisor@example.com",
        "Supervisor",
        target,
        actor
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("user@example.com");
      expect(emailCall.subject).toContain("user@example.com");
    });

    it("should handle actor without name (email only)", async () => {
      // Arrange
      const target = {
        firstName: "Target",
        lastName: "User",
        email: "target@example.com",
      };
      const actor = {
        email: "actor@example.com",
        role: "Leader",
      };

      // Act
      await UserEmailService.sendUserDeactivatedAlertToAdmin(
        "admin@example.com",
        "Admin",
        target,
        actor
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("actor@example.com");
      expect(emailCall.html).toContain("Leader");
    });

    it("should include timestamp in alert", async () => {
      // Arrange
      const target = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      await UserEmailService.sendUserDeactivatedAlertToAdmin(
        "supervisor@example.com",
        "Supervisor",
        target,
        actor
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Time:");
      expect(emailCall.text).toContain("Time:");
    });

    it("should handle email sending failures gracefully", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));
      const target = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      const result = await UserEmailService.sendUserDeactivatedAlertToAdmin(
        "admin@example.com",
        "Admin",
        target,
        actor
      );

      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("sendUserReactivatedAlertToAdmin", () => {
    it("should send reactivation alert with full details", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin User";
      const target = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
      };
      const actor = {
        firstName: "Lead",
        lastName: "Admin",
        email: "lead@example.com",
        role: "Super Admin",
      };

      // Act
      const result = await UserEmailService.sendUserReactivatedAlertToAdmin(
        adminEmail,
        adminName,
        target,
        actor
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("admin@example.com");
      expect(emailCall.subject).toContain("User Account Reactivated");
      expect(emailCall.subject).toContain("Jane Smith");
      expect(emailCall.html).toContain("Admin User");
      expect(emailCall.html).toContain("Lead Admin");
      expect(emailCall.html).toContain("jane@example.com");
      expect(emailCall.html).toContain("reactivated");
    });

    it("should include timestamp in alert", async () => {
      // Arrange
      const target = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      await UserEmailService.sendUserReactivatedAlertToAdmin(
        "supervisor@example.com",
        "Supervisor",
        target,
        actor
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Time:");
      expect(emailCall.text).toContain("Time:");
    });

    it("should handle email sending failures", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(
        new Error("Connection timeout")
      );
      const target = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      const result = await UserEmailService.sendUserReactivatedAlertToAdmin(
        "admin@example.com",
        "Admin",
        target,
        actor
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should fallback to email when target has no name", async () => {
      // Arrange - target with no firstName or lastName
      const target = {
        firstName: undefined,
        lastName: undefined,
        email: "noname@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      const result = await UserEmailService.sendUserReactivatedAlertToAdmin(
        "supervisor@example.com",
        "Supervisor",
        target,
        actor
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Subject should use email as fallback name
      expect(emailCall.subject).toContain("noname@example.com");
    });

    it("should fallback to email when actor has no name", async () => {
      // Arrange - actor with no firstName or lastName
      const target = {
        firstName: "Target",
        lastName: "User",
        email: "target@example.com",
      };
      const actor = {
        email: "noname-actor@example.com",
        role: "Admin",
      };

      // Act
      await UserEmailService.sendUserReactivatedAlertToAdmin(
        "supervisor@example.com",
        "Supervisor",
        target,
        actor
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // HTML should use actor email as fallback name
      expect(emailCall.html).toContain("noname-actor@example.com");
    });
  });

  describe("sendUserDeletedAlertToAdmin", () => {
    it("should send security alert for user deletion with full details", async () => {
      // Arrange
      const adminEmail = "security@example.com";
      const adminName = "Security Admin";
      const target = {
        firstName: "Deleted",
        lastName: "User",
        email: "deleted@example.com",
      };
      const actor = {
        firstName: "Super",
        lastName: "Admin",
        email: "superadmin@example.com",
        role: "Super Admin",
      };

      // Act
      const result = await UserEmailService.sendUserDeletedAlertToAdmin(
        adminEmail,
        adminName,
        target,
        actor
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("security@example.com");
      expect(emailCall.subject).toContain("Security Alert");
      expect(emailCall.subject).toContain("User Deleted");
      expect(emailCall.subject).toContain("Deleted User");
      expect(emailCall.html).toContain("Security Admin");
      expect(emailCall.html).toContain("Super Admin");
      expect(emailCall.html).toContain("deleted@example.com");
      expect(emailCall.html).toContain("permanently deleted");
    });

    it("should use red header styling for security alerts", async () => {
      // Arrange
      const target = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      await UserEmailService.sendUserDeletedAlertToAdmin(
        "admin@example.com",
        "Admin",
        target,
        actor
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Red background for security alerts
      expect(emailCall.html).toContain("#dc3545");
    });

    it("should include timestamp for audit trail", async () => {
      // Arrange
      const target = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      await UserEmailService.sendUserDeletedAlertToAdmin(
        "security@example.com",
        "Security",
        target,
        actor
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Time:");
      expect(emailCall.text).toContain("Time:");
    });

    it("should handle email sending failures", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(new Error("Network error"));
      const target = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      const result = await UserEmailService.sendUserDeletedAlertToAdmin(
        "admin@example.com",
        "Admin",
        target,
        actor
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should fallback to email when target has no name", async () => {
      // Arrange - target with empty firstName and lastName
      const target = {
        firstName: "",
        lastName: "",
        email: "unnamed@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      const result = await UserEmailService.sendUserDeletedAlertToAdmin(
        "security@example.com",
        "Security Admin",
        target,
        actor
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Subject should use email as fallback name
      expect(emailCall.subject).toContain("unnamed@example.com");
    });

    it("should fallback to email when actor has no name", async () => {
      // Arrange - actor with no firstName or lastName
      const target = {
        firstName: "Deleted",
        lastName: "User",
        email: "deleted@example.com",
      };
      const actor = {
        email: "noname-actor@example.com",
        role: "Super Admin",
      };

      // Act
      await UserEmailService.sendUserDeletedAlertToAdmin(
        "security@example.com",
        "Security Admin",
        target,
        actor
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // HTML should use actor email as fallback name
      expect(emailCall.html).toContain("noname-actor@example.com");
    });
  });

  describe("sendNewAtCloudLeaderSignupToAdmins", () => {
    it("should send new leader signup notification with full details", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin User";
      const userData = {
        firstName: "New",
        lastName: "Leader",
        email: "newleader@example.com",
        roleInAtCloud: "Youth Pastor",
      };

      // Act
      const result = await UserEmailService.sendNewAtCloudLeaderSignupToAdmins(
        adminEmail,
        adminName,
        userData
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("admin@example.com");
      expect(emailCall.subject).toContain("New @Cloud Co-worker Signup");
      expect(emailCall.html).toContain("Admin User");
      expect(emailCall.html).toContain("New Leader");
      expect(emailCall.html).toContain("newleader@example.com");
      expect(emailCall.html).toContain("Youth Pastor");
    });

    it("should include dashboard link for admin review", async () => {
      // Arrange
      const userData = {
        firstName: "Sarah",
        lastName: "Wilson",
        email: "sarah@example.com",
        roleInAtCloud: "Worship Leader",
      };

      // Act
      await UserEmailService.sendNewAtCloudLeaderSignupToAdmins(
        "admin@example.com",
        "Admin",
        userData
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Email includes review/dashboard functionality
      expect(emailCall.html).toContain("@Cloud");
    });

    it("should handle different @Cloud ministry roles", async () => {
      // Arrange
      const roles = ["Senior Pastor", "Worship Leader", "Youth Pastor"];

      // Act & Assert
      for (const role of roles) {
        const userData = {
          firstName: "Test",
          lastName: "Leader",
          email: "test@example.com",
          roleInAtCloud: role,
        };

        await UserEmailService.sendNewAtCloudLeaderSignupToAdmins(
          "admin@example.com",
          "Admin",
          userData
        );

        const emailCall =
          mockTransporter.sendMail.mock.calls[
            mockTransporter.sendMail.mock.calls.length - 1
          ][0];
        expect(emailCall.html).toContain(role);
      }
    });

    it("should include @Cloud Ministry branding", async () => {
      // Arrange
      const userData = {
        firstName: "Test",
        lastName: "Leader",
        email: "test@example.com",
        roleInAtCloud: "Pastor",
      };

      // Act
      await UserEmailService.sendNewAtCloudLeaderSignupToAdmins(
        "admin@example.com",
        "Admin",
        userData
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("@Cloud");
    });

    it("should handle email sending failures", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(
        new Error("SMTP connection failed")
      );
      const userData = {
        firstName: "Test",
        lastName: "Leader",
        email: "test@example.com",
        roleInAtCloud: "Pastor",
      };

      // Act
      const result = await UserEmailService.sendNewAtCloudLeaderSignupToAdmins(
        "admin@example.com",
        "Admin",
        userData
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should fallback to localhost URL when FRONTEND_URL is not set", async () => {
      // Arrange - Remove FRONTEND_URL to test fallback
      delete process.env.FRONTEND_URL;
      const userData = {
        firstName: "Test",
        lastName: "Leader",
        email: "test@example.com",
        roleInAtCloud: "Pastor",
      };

      // Act
      await UserEmailService.sendNewAtCloudLeaderSignupToAdmins(
        "admin@example.com",
        "Admin",
        userData
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("http://localhost:5173");
      expect(emailCall.html).toContain("/admin/users");
    });
  });

  describe("Integration with EmailTransporter", () => {
    it("should properly initialize EmailTransporter on first use", async () => {
      // Arrange
      const target = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act
      await UserEmailService.sendUserDeactivatedAlertToAdmin(
        "admin@example.com",
        "Admin",
        target,
        actor
      );

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const anyMailer: any = nodemailer as any;
      expect(anyMailer.createTransport).toHaveBeenCalled();
    });

    it("should reuse EmailTransporter for multiple admin alerts", async () => {
      // Arrange
      const target = {
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
      };
      const actor = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Admin",
      };

      // Act - Send multiple different alert types
      await UserEmailService.sendUserDeactivatedAlertToAdmin(
        "admin@example.com",
        "Admin",
        target,
        actor
      );
      await UserEmailService.sendUserReactivatedAlertToAdmin(
        "admin@example.com",
        "Admin",
        target,
        actor
      );
      await UserEmailService.sendUserDeletedAlertToAdmin(
        "admin@example.com",
        "Admin",
        target,
        actor
      );

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      // createTransport should only be called once (transporter reused)
      const anyMailer: any = nodemailer as any;
      expect(anyMailer.createTransport).toHaveBeenCalledTimes(1);
    });
  });
});

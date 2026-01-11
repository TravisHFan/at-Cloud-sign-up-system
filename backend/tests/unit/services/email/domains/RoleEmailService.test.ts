/**
 * RoleEmailService Domain Test Suite
 *
 * Tests for all role-related email notifications:
 * - User promotions (sendPromotionNotificationToUser)
 * - Admin promotion notifications (sendPromotionNotificationToAdmins)
 * - User demotions (sendDemotionNotificationToUser)
 * - Admin demotion notifications (sendDemotionNotificationToAdmins)
 * - AtCloud role changes to user (sendAtCloudRoleChangeToUser)
 * - AtCloud role changes to admins (sendAtCloudRoleChangeToAdmins)
 * - New leader signup (sendNewLeaderSignupEmail)
 * - AtCloud role assigned notifications (sendAtCloudRoleAssignedToAdmins)
 * - AtCloud role removed notifications (sendAtCloudRoleRemovedToAdmins)
 * - Co-organizer assignments (sendCoOrganizerAssignedEmail)
 *
 * Tests the domain service directly without going through the facade.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock nodemailer to avoid external dependencies (must be before importing RoleEmailService)
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
import { RoleEmailService } from "../../../../../src/services/email/domains/RoleEmailService";
import { EmailTransporter } from "../../../../../src/services/email/EmailTransporter";

describe("RoleEmailService - Role Email Operations", () => {
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

  describe("sendPromotionNotificationToUser", () => {
    it("should send promotion notification to promoted user", async () => {
      // Arrange
      const email = "user@example.com";
      const userData = {
        firstName: "John",
        lastName: "Doe",
        oldRole: "Participant",
        newRole: "Leader",
      };
      const changedBy = {
        firstName: "Admin",
        lastName: "User",
        role: "Super Admin",
      };

      // Act
      const result = await RoleEmailService.sendPromotionNotificationToUser(
        email,
        userData,
        changedBy
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toContain("promoted");
      expect(emailCall.subject).toContain("Leader");
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("Participant");
      expect(emailCall.html).toContain("Leader");
      expect(emailCall.html).toContain("Admin User");
    });

    it("should handle Super Admin promotion", async () => {
      // Arrange
      const email = "admin@example.com";
      const userData = {
        firstName: "Jane",
        lastName: "Smith",
        oldRole: "Administrator",
        newRole: "Super Admin",
      };
      const changedBy = {
        firstName: "Owner",
        lastName: "Account",
        role: "Super Admin",
      };

      // Act
      await RoleEmailService.sendPromotionNotificationToUser(
        email,
        userData,
        changedBy
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Super Admin");
      expect(emailCall.html).toContain("highest level");
      expect(emailCall.html).toContain("👑");
    });

    it("should handle email sending failures gracefully", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));
      const email = "fail@example.com";
      const userData = {
        firstName: "Test",
        lastName: "User",
        oldRole: "Participant",
        newRole: "Leader",
      };
      const changedBy = {
        firstName: "Admin",
        lastName: "User",
        role: "Administrator",
      };

      // Act
      const result = await RoleEmailService.sendPromotionNotificationToUser(
        email,
        userData,
        changedBy
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const email = "user@example.com";
      const userData = {
        firstName: "John",
        lastName: "Doe",
        oldRole: "Participant",
        newRole: "Leader",
      };
      const changedBy = {
        firstName: "Admin",
        lastName: "User",
        role: "Super Admin",
      };

      // Act
      await RoleEmailService.sendPromotionNotificationToUser(
        email,
        userData,
        changedBy
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("http://localhost:5173");
    });
  });

  describe("sendPromotionNotificationToAdmins", () => {
    it("should notify admins of user promotion", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin User";
      const userData = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRole: "Participant",
        newRole: "Leader",
      };
      const changedBy = {
        firstName: "Super",
        lastName: "Admin",
        role: "Super Admin",
      };

      // Act
      const result = await RoleEmailService.sendPromotionNotificationToAdmins(
        adminEmail,
        adminName,
        userData,
        changedBy
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("admin@example.com");
      expect(emailCall.subject).toContain("Promoted");
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("john@example.com");
      expect(emailCall.html).toContain("Leader");
    });

    it("should highlight high-impact promotions", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin";
      const userData = {
        firstName: "New",
        lastName: "SuperAdmin",
        email: "new@example.com",
        oldRole: "Administrator",
        newRole: "Super Admin",
      };
      const changedBy = {
        firstName: "Owner",
        lastName: "User",
        role: "Super Admin",
      };

      // Act
      await RoleEmailService.sendPromotionNotificationToAdmins(
        adminEmail,
        adminName,
        userData,
        changedBy
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Super Admin");
    });
  });

  describe("sendDemotionNotificationToUser", () => {
    it("should send demotion notification to user", async () => {
      // Arrange
      const userEmail = "user@example.com";
      const userData = {
        _id: "user123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRole: "Leader",
        newRole: "Participant",
      };
      const changedBy = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Super Admin",
      };
      const reason = "Stepping down voluntarily";

      // Act
      const result = await RoleEmailService.sendDemotionNotificationToUser(
        userEmail,
        userData,
        changedBy,
        reason
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toContain("Role Update");
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("Stepping down voluntarily");
    });

    it("should handle demotion without reason", async () => {
      // Arrange
      const userEmail = "user@example.com";
      const userData = {
        _id: "user456",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        oldRole: "Administrator",
        newRole: "Leader",
      };
      const changedBy = {
        firstName: "Super",
        lastName: "Admin",
        email: "super@example.com",
        role: "Super Admin",
      };

      // Act
      const result = await RoleEmailService.sendDemotionNotificationToUser(
        userEmail,
        userData,
        changedBy
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Jane Smith");
      expect(emailCall.html).toContain("Leader");
    });

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const userEmail = "user@example.com";
      const userData = {
        _id: "user789",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRole: "Leader",
        newRole: "Participant",
      };
      const changedBy = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Super Admin",
      };

      // Act
      await RoleEmailService.sendDemotionNotificationToUser(
        userEmail,
        userData,
        changedBy
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("http://localhost:5173");
    });

    it("should handle missing firstName/lastName with empty string fallback", async () => {
      // Arrange
      const userEmail = "user@example.com";
      const userData = {
        _id: "user789",
        firstName: "",
        lastName: "",
        email: "john@example.com",
        oldRole: "Leader",
        newRole: "Participant",
      };
      const changedBy = {
        firstName: "",
        lastName: "",
        email: "admin@example.com",
        role: "Super Admin",
      };

      // Act
      const result = await RoleEmailService.sendDemotionNotificationToUser(
        userEmail,
        userData,
        changedBy
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall).toBeDefined();
    });
  });

  describe("sendDemotionNotificationToAdmins", () => {
    it("should notify admins of user demotion", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin User";
      const userData = {
        _id: "user789",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRole: "Leader",
        newRole: "Participant",
      };
      const changedBy = {
        firstName: "Super",
        lastName: "Admin",
        email: "super@example.com",
        role: "Super Admin",
      };
      const reason = "Policy violation";

      // Act
      const result = await RoleEmailService.sendDemotionNotificationToAdmins(
        adminEmail,
        adminName,
        userData,
        changedBy,
        reason
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("admin@example.com");
      expect(emailCall.subject).toContain("Demoted");
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("Policy violation");
    });
  });

  describe("sendAtCloudRoleChangeToUser", () => {
    it("should notify user of AtCloud ministry role change", async () => {
      // Arrange
      const userEmail = "user@example.com";
      const userData = {
        _id: "user123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRoleInAtCloud: "Participant",
        newRoleInAtCloud: "Class Rep",
      };

      // Act
      const result = await RoleEmailService.sendAtCloudRoleChangeToUser(
        userEmail,
        userData
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toContain("Ministry Role Update");
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("Participant");
      expect(emailCall.html).toContain("Class Rep");
    });

    it("should handle Leader role assignments", async () => {
      // Arrange
      const userEmail = "leader@example.com";
      const userData = {
        _id: "user456",
        firstName: "Jane",
        lastName: "Leader",
        email: "jane@example.com",
        oldRoleInAtCloud: "Participant",
        newRoleInAtCloud: "Leader",
      };

      // Act
      await RoleEmailService.sendAtCloudRoleChangeToUser(userEmail, userData);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Leader");
    });

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const userEmail = "user@example.com";
      const userData = {
        _id: "user123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRoleInAtCloud: "Participant",
        newRoleInAtCloud: "Class Rep",
      };

      // Act
      await RoleEmailService.sendAtCloudRoleChangeToUser(userEmail, userData);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("http://localhost:5173");
    });
  });

  describe("sendAtCloudRoleChangeToAdmins", () => {
    it("should notify admins of ministry role change", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin User";
      const userData = {
        _id: "user123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRoleInAtCloud: "Participant",
        newRoleInAtCloud: "Class Rep",
      };

      // Act
      const result = await RoleEmailService.sendAtCloudRoleChangeToAdmins(
        adminEmail,
        adminName,
        userData
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("admin@example.com");
      expect(emailCall.subject).toContain("Admin Alert");
      expect(emailCall.subject).toContain("Ministry Role Change");
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("john@example.com");
    });
  });

  describe("sendNewLeaderSignupEmail", () => {
    it("should notify admins of new leader registration", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin User";
      const newLeaderData = {
        firstName: "New",
        lastName: "Leader",
        email: "leader@example.com",
        roleInAtCloud: "Leader",
        signupDate: "2025-12-15",
      };

      // Act
      const result = await RoleEmailService.sendNewLeaderSignupEmail(
        adminEmail,
        adminName,
        newLeaderData
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("admin@example.com");
      expect(emailCall.subject).toContain("New Leader Signup");
      expect(emailCall.html).toContain("New Leader");
      expect(emailCall.html).toContain("leader@example.com");
      expect(emailCall.html).toContain("2025-12-15");
    });

    it("should include signup details in notification", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin";
      const newLeaderData = {
        firstName: "Jane",
        lastName: "NewLeader",
        email: "jane@example.com",
        roleInAtCloud: "Leader",
        signupDate: "2025-12-20",
      };

      // Act
      await RoleEmailService.sendNewLeaderSignupEmail(
        adminEmail,
        adminName,
        newLeaderData
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Jane NewLeader");
      expect(emailCall.html).toContain("Leader");
    });
  });

  describe("sendAtCloudRoleAssignedToAdmins", () => {
    it("should notify admins when AtCloud role is assigned", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin User";
      const userData = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        roleInAtCloud: "Class Rep",
      };

      // Act
      const result = await RoleEmailService.sendAtCloudRoleAssignedToAdmins(
        adminEmail,
        adminName,
        userData
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("admin@example.com");
      expect(emailCall.subject).toContain("@Cloud Co-worker Role Invited");
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("john@example.com");
      expect(emailCall.html).toContain("Class Rep");
    });

    it("should handle Leader role assignments", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin";
      const userData = {
        firstName: "Jane",
        lastName: "Leader",
        email: "jane@example.com",
        roleInAtCloud: "Leader",
      };

      // Act
      await RoleEmailService.sendAtCloudRoleAssignedToAdmins(
        adminEmail,
        adminName,
        userData
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Leader");
    });

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const userData = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        roleInAtCloud: "Class Rep",
      };

      // Act
      const result = await RoleEmailService.sendAtCloudRoleAssignedToAdmins(
        "admin@example.com",
        "Admin",
        userData
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("localhost:5173");
    });
  });

  describe("sendAtCloudRoleRemovedToAdmins", () => {
    it("should notify admins when AtCloud role is removed", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin User";
      const userData = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        previousRoleInAtCloud: "Class Rep",
      };

      // Act
      const result = await RoleEmailService.sendAtCloudRoleRemovedToAdmins(
        adminEmail,
        adminName,
        userData
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("admin@example.com");
      expect(emailCall.subject).toContain("@Cloud Co-worker Role Removed");
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("john@example.com");
      expect(emailCall.html).toContain("Class Rep");
    });

    it("should handle Leader role removal", async () => {
      // Arrange
      const adminEmail = "admin@example.com";
      const adminName = "Admin";
      const userData = {
        firstName: "Former",
        lastName: "Leader",
        email: "former@example.com",
        previousRoleInAtCloud: "Leader",
      };

      // Act
      await RoleEmailService.sendAtCloudRoleRemovedToAdmins(
        adminEmail,
        adminName,
        userData
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Leader");
      expect(emailCall.html).toContain("removed");
    });

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const userData = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        previousRoleInAtCloud: "Class Rep",
      };

      // Act
      const result = await RoleEmailService.sendAtCloudRoleRemovedToAdmins(
        "admin@example.com",
        "Admin",
        userData
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("localhost:5173");
    });
  });

  describe("sendCoOrganizerAssignedEmail", () => {
    it("should notify new co-organizer of event assignment", async () => {
      // Arrange
      const coOrganizerEmail = "coorg@example.com";
      const assignedUser = {
        firstName: "Co",
        lastName: "Organizer",
      };
      const eventData = {
        title: "Big Conference",
        date: "2025-12-20",
        time: "09:00",
        endTime: "17:00",
        location: "Convention Center",
      };
      const assignedBy = {
        firstName: "Main",
        lastName: "Organizer",
      };

      // Act
      const result = await RoleEmailService.sendCoOrganizerAssignedEmail(
        coOrganizerEmail,
        assignedUser,
        eventData,
        assignedBy
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("coorg@example.com");
      expect(emailCall.subject).toContain("Co-Organizer");
      expect(emailCall.html).toContain("Co Organizer");
      expect(emailCall.html).toContain("Big Conference");
      expect(emailCall.html).toContain("Main Organizer");
      expect(emailCall.html).toContain("Convention Center");
    });

    it("should include event details in notification", async () => {
      // Arrange
      const coOrganizerEmail = "helper@example.com";
      const assignedUser = {
        firstName: "Event",
        lastName: "Helper",
      };
      const eventData = {
        title: "Workshop Series",
        date: "2025-12-25",
        time: "14:00",
        endTime: "16:00",
        location: "Community Hall",
      };
      const assignedBy = {
        firstName: "Lead",
        lastName: "Organizer",
      };

      // Act
      await RoleEmailService.sendCoOrganizerAssignedEmail(
        coOrganizerEmail,
        assignedUser,
        eventData,
        assignedBy
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Workshop Series");
      expect(emailCall.html).toContain("2:00 PM");
      expect(emailCall.html).toContain("Community Hall");
    });
  });

  describe("Integration with EmailTransporter", () => {
    it("should properly initialize EmailTransporter on first use", async () => {
      // Arrange
      const email = "test@example.com";
      const userData = {
        firstName: "Test",
        lastName: "User",
        oldRole: "Participant",
        newRole: "Leader",
      };
      const changedBy = {
        firstName: "Admin",
        lastName: "User",
        role: "Administrator",
      };

      // Act
      await RoleEmailService.sendPromotionNotificationToUser(
        email,
        userData,
        changedBy
      );

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const anyMailer: any = nodemailer as any;
      expect(anyMailer.createTransport).toHaveBeenCalled();
    });

    it("should reuse EmailTransporter for multiple role emails", async () => {
      // Arrange & Act
      await RoleEmailService.sendPromotionNotificationToUser(
        "user1@example.com",
        {
          firstName: "User",
          lastName: "1",
          oldRole: "Participant",
          newRole: "Leader",
        },
        { firstName: "Admin", lastName: "1", role: "Super Admin" }
      );

      await RoleEmailService.sendAtCloudRoleChangeToUser("user2@example.com", {
        _id: "user2",
        firstName: "User",
        lastName: "2",
        email: "user2@example.com",
        oldRoleInAtCloud: "Participant",
        newRoleInAtCloud: "Class Rep",
      });

      await RoleEmailService.sendNewLeaderSignupEmail(
        "admin@example.com",
        "Admin",
        {
          firstName: "New",
          lastName: "Leader",
          email: "leader@example.com",
          roleInAtCloud: "Leader",
          signupDate: "2025-12-15",
        }
      );

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      // createTransport should only be called once (transporter reused)
      const anyMailer: any = nodemailer as any;
      expect(anyMailer.createTransport).toHaveBeenCalledTimes(1);
    });
  });
});

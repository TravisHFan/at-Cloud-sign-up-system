/**
 * Test for System Authorization Change Email Implementation
 * Tests the new promotion notification functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { emailNotificationRouter } from "../../../src/routes/emailNotifications";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";
import { EmailService } from "../../../src/services/infrastructure/emailService";
import { RoleUtils } from "../../../src/utils/roleUtils";

// Mock dependencies
vi.mock("../../../src/utils/emailRecipientUtils");
vi.mock("../../../src/services/infrastructure/emailService");
vi.mock("../../../src/utils/roleUtils");
vi.mock("../../../src/middleware/auth", () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      _id: "admin123",
      email: "admin@test.com",
      role: "Administrator",
    };
    next();
  },
}));

const MockEmailRecipientUtils = vi.mocked(EmailRecipientUtils);
const MockEmailService = vi.mocked(EmailService);
const MockRoleUtils = vi.mocked(RoleUtils);

// Create test app
const app = express();
app.use(express.json());
app.use("/api/v1/email-notifications", emailNotificationRouter);

describe("System Authorization Change - Promotion Email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /system-authorization-change - Promotion", () => {
    it("should send promotion notification to user and admins", async () => {
      // Arrange
      const mockAdminRecipients = [
        { email: "superadmin@test.com", firstName: "Super", lastName: "Admin" },
        { email: "admin2@test.com", firstName: "Admin", lastName: "Two" },
      ];

      MockRoleUtils.isPromotion = vi.fn().mockReturnValue(true);
      MockRoleUtils.isDemotion = vi.fn().mockReturnValue(false);
      MockEmailRecipientUtils.getSystemAuthorizationChangeRecipients = vi
        .fn()
        .mockResolvedValue(mockAdminRecipients);
      MockEmailService.sendPromotionNotificationToUser = vi
        .fn()
        .mockResolvedValue(true);
      MockEmailService.sendPromotionNotificationToAdmins = vi
        .fn()
        .mockResolvedValue(true);

      const requestBody = {
        userData: {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          oldRole: "Participant",
          newRole: "Leader",
        },
        changedBy: {
          firstName: "Admin",
          lastName: "User",
          email: "admin@test.com",
          role: "Administrator",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/email-notifications/system-authorization-change")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Promotion notifications sent successfully"
      );
      expect(response.body.recipientCount).toBe(3); // user + 2 admins
      expect(response.body.data).toMatchObject({
        userNotified: true,
        adminsNotified: 2,
        changeType: "promotion",
      });

      // Verify the correct methods were called
      expect(MockRoleUtils.isPromotion).toHaveBeenCalledWith(
        "Participant",
        "Leader"
      );
      expect(
        MockEmailRecipientUtils.getSystemAuthorizationChangeRecipients
      ).toHaveBeenCalledWith("user123");
      expect(
        MockEmailService.sendPromotionNotificationToUser
      ).toHaveBeenCalledWith(
        "john.doe@test.com",
        {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          oldRole: "Participant",
          newRole: "Leader",
        },
        {
          firstName: "Admin",
          lastName: "User",
          email: "admin@test.com",
          role: "Administrator",
        }
      );
      expect(
        MockEmailService.sendPromotionNotificationToAdmins
      ).toHaveBeenCalledTimes(2); // Called for each admin
      expect(
        MockEmailService.sendPromotionNotificationToAdmins
      ).toHaveBeenCalledWith(
        "superadmin@test.com",
        "Super Admin",
        {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          oldRole: "Participant",
          newRole: "Leader",
        },
        {
          firstName: "Admin",
          lastName: "User",
          email: "admin@test.com",
          role: "Administrator",
        }
      );
    });

    it("should handle promotion email sending failure gracefully", async () => {
      // Arrange
      MockRoleUtils.isPromotion = vi.fn().mockReturnValue(true);
      MockRoleUtils.isDemotion = vi.fn().mockReturnValue(false);
      MockEmailRecipientUtils.getSystemAuthorizationChangeRecipients = vi
        .fn()
        .mockResolvedValue([]);
      MockEmailService.sendPromotionNotificationToUser = vi
        .fn()
        .mockRejectedValue(new Error("Email sending failed"));
      MockEmailService.sendPromotionNotificationToAdmins = vi
        .fn()
        .mockResolvedValue(true);

      const requestBody = {
        userData: {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          oldRole: "Participant",
          newRole: "Leader",
        },
        changedBy: {
          firstName: "Admin",
          lastName: "User",
          email: "admin@test.com",
          role: "Administrator",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/email-notifications/system-authorization-change")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200); // Should still succeed overall
      expect(response.body.success).toBe(true);
      expect(response.body.data.userNotified).toBe(false); // But user wasn't notified
    });

    it("should reject when no role change detected", async () => {
      // Arrange
      MockRoleUtils.isPromotion = vi.fn().mockReturnValue(false);
      MockRoleUtils.isDemotion = vi.fn().mockReturnValue(false);

      const requestBody = {
        userData: {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          oldRole: "Leader",
          newRole: "Leader", // Same role
        },
        changedBy: {
          firstName: "Admin",
          lastName: "User",
          email: "admin@test.com",
          role: "Administrator",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/email-notifications/system-authorization-change")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "No role change detected - old and new roles are the same"
      );
    });

    it("should handle missing required fields", async () => {
      // Act
      const response = await request(app)
        .post("/api/v1/email-notifications/system-authorization-change")
        .send({
          userData: {
            _id: "user123",
            // Missing oldRole and newRole
          },
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "User data with ID, old role, and new role is required"
      );
    });
  });
});

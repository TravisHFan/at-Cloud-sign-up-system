/**
 * Test for AtCloud Ministry Role Change Email Implementation
 * Tests the new ministry role change notification functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { emailNotificationRouter } from "../../../src/routes/emailNotifications";
import { EmailService } from "../../../src/services/infrastructure/emailService";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";

// Mock dependencies
vi.mock("../../../src/services/infrastructure/emailService");
vi.mock("../../../src/utils/emailRecipientUtils");
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

const MockEmailService = vi.mocked(EmailService);
const MockEmailRecipientUtils = vi.mocked(EmailRecipientUtils);

// Create test app
const app = express();
app.use(express.json());
app.use("/api/v1/email-notifications", emailNotificationRouter);

describe("AtCloud Ministry Role Change Email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /atcloud-role-change", () => {
    it("should send ministry role change notifications to user and admins successfully", async () => {
      // Arrange
      MockEmailService.sendAtCloudRoleChangeToUser = vi
        .fn()
        .mockResolvedValue(true);
      MockEmailService.sendAtCloudRoleChangeToAdmins = vi
        .fn()
        .mockResolvedValue(true);

      // Mock admin recipients
      const mockAdmins = [
        {
          email: "admin1@test.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
        {
          email: "admin2@test.com",
          firstName: "Admin",
          lastName: "Two",
          role: "Administrator",
        },
      ];
      MockEmailRecipientUtils.getSystemAuthorizationChangeRecipients = vi
        .fn()
        .mockResolvedValue(mockAdmins);

      const requestBody = {
        userData: {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          oldRoleInAtCloud: "Ministry Volunteer",
          newRoleInAtCloud: "Small Group Leader",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/email-notifications/atcloud-role-change")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Ministry role change notifications sent to 3 recipient(s)"
      );
      expect(response.body.recipientCount).toBe(3); // 1 user + 2 admins
      expect(response.body.data).toMatchObject({
        userNotified: true,
        adminCount: 2,
        totalAdmins: 2,
        oldRole: "Ministry Volunteer",
        newRole: "Small Group Leader",
      });

      // Verify user email was sent
      expect(MockEmailService.sendAtCloudRoleChangeToUser).toHaveBeenCalledWith(
        "john.doe@test.com",
        {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          oldRoleInAtCloud: "Ministry Volunteer",
          newRoleInAtCloud: "Small Group Leader",
        }
      );

      // Verify admin emails were sent
      expect(
        MockEmailService.sendAtCloudRoleChangeToAdmins
      ).toHaveBeenCalledTimes(2);
      expect(
        MockEmailService.sendAtCloudRoleChangeToAdmins
      ).toHaveBeenCalledWith("admin1@test.com", "Admin One", {
        _id: "user123",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@test.com",
        oldRoleInAtCloud: "Ministry Volunteer",
        newRoleInAtCloud: "Small Group Leader",
      });
    });

    it("should handle email sending failure gracefully", async () => {
      // Arrange
      MockEmailService.sendAtCloudRoleChangeToUser = vi
        .fn()
        .mockResolvedValue(false);
      MockEmailService.sendAtCloudRoleChangeToAdmins = vi
        .fn()
        .mockResolvedValue(false);

      const mockAdmins = [
        {
          email: "admin1@test.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
      ];
      MockEmailRecipientUtils.getSystemAuthorizationChangeRecipients = vi
        .fn()
        .mockResolvedValue(mockAdmins);

      const requestBody = {
        userData: {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          oldRoleInAtCloud: "Deacon",
          newRoleInAtCloud: "Elder",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/email-notifications/atcloud-role-change")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Ministry role change notifications sent to 0 recipient(s)"
      );
      expect(response.body.recipientCount).toBe(0);
      expect(response.body.data.userNotified).toBe(false);
    });

    it("should reject when no role change detected", async () => {
      // Arrange
      const requestBody = {
        userData: {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          oldRoleInAtCloud: "Pastor",
          newRoleInAtCloud: "Pastor", // Same role
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/email-notifications/atcloud-role-change")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "No ministry role change detected - old and new roles are the same"
      );

      // Verify email methods were not called
      expect(
        MockEmailService.sendAtCloudRoleChangeToUser
      ).not.toHaveBeenCalled();
      expect(
        MockEmailService.sendAtCloudRoleChangeToAdmins
      ).not.toHaveBeenCalled();
    });

    it("should handle missing required fields", async () => {
      // Arrange
      const requestBody = {
        userData: {
          _id: "user123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          // Missing oldRoleInAtCloud and newRoleInAtCloud
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/email-notifications/atcloud-role-change")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "User data with ID, old role, and new role is required"
      );

      // Verify email methods were not called
      expect(
        MockEmailService.sendAtCloudRoleChangeToUser
      ).not.toHaveBeenCalled();
      expect(
        MockEmailService.sendAtCloudRoleChangeToAdmins
      ).not.toHaveBeenCalled();
    });

    it("should handle different ministry role transitions", async () => {
      // Arrange
      MockEmailService.sendAtCloudRoleChangeToUser = vi
        .fn()
        .mockResolvedValue(true);
      MockEmailService.sendAtCloudRoleChangeToAdmins = vi
        .fn()
        .mockResolvedValue(true);

      const mockAdmins = [
        {
          email: "admin1@test.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
      ];
      MockEmailRecipientUtils.getSystemAuthorizationChangeRecipients = vi
        .fn()
        .mockResolvedValue(mockAdmins);

      const testCases = [
        {
          description: "Volunteer to Leadership",
          oldRole: "Ministry Volunteer",
          newRole: "Youth Leader",
        },
        {
          description: "Leadership Advancement",
          oldRole: "Small Group Leader",
          newRole: "Elder",
        },
        {
          description: "Senior Leadership",
          oldRole: "Elder",
          newRole: "Pastor",
        },
      ];

      for (const testCase of testCases) {
        const requestBody = {
          userData: {
            _id: "user123",
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@test.com",
            oldRoleInAtCloud: testCase.oldRole,
            newRoleInAtCloud: testCase.newRole,
          },
        };

        // Act
        const response = await request(app)
          .post("/api/v1/email-notifications/atcloud-role-change")
          .send(requestBody);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.oldRole).toBe(testCase.oldRole);
        expect(response.body.data.newRole).toBe(testCase.newRole);
      }

      // Verify methods were called for each test case
      expect(
        MockEmailService.sendAtCloudRoleChangeToUser
      ).toHaveBeenCalledTimes(testCases.length);
      expect(
        MockEmailService.sendAtCloudRoleChangeToAdmins
      ).toHaveBeenCalledTimes(testCases.length);
    });
  });
});

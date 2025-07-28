import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { EmailNotificationController } from "../../../src/controllers/emailNotificationController";
import { EmailService } from "../../../src/services/infrastructure/emailService";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";

// Mock the dependencies
vi.mock("../../../src/services/infrastructure/emailService");
vi.mock("../../../src/utils/emailRecipientUtils");

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  (req as any).user = { id: "test-user-id", role: "Administrator" };
  next();
});

app.post(
  "/new-leader-signup",
  EmailNotificationController.sendNewLeaderSignupNotification
);

describe("New Leader Signup Email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /new-leader-signup", () => {
    it("should send new leader signup notifications to admins successfully", async () => {
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

      vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
        mockAdmins
      );
      vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(true);

      const testData = {
        userData: {
          firstName: "John",
          lastName: "Leader",
          email: "john.leader@test.com",
          roleInAtCloud: "Youth Pastor",
        },
      };

      const response = await request(app)
        .post("/new-leader-signup")
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "New leader signup notification sent to 2 recipient(s)"
      );
      expect(response.body.recipientCount).toBe(2);

      // Verify EmailService.sendNewLeaderSignupEmail was called for each admin
      expect(EmailService.sendNewLeaderSignupEmail).toHaveBeenCalledTimes(2);
      expect(EmailService.sendNewLeaderSignupEmail).toHaveBeenCalledWith(
        "admin1@test.com",
        "Admin One",
        expect.objectContaining({
          firstName: "John",
          lastName: "Leader",
          email: "john.leader@test.com",
          roleInAtCloud: "Youth Pastor",
          signupDate: expect.any(String),
        })
      );
    });

    it("should handle no admin recipients gracefully", async () => {
      vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue([]);

      const testData = {
        userData: {
          firstName: "John",
          lastName: "Leader",
          email: "john.leader@test.com",
          roleInAtCloud: "Youth Pastor",
        },
      };

      const response = await request(app)
        .post("/new-leader-signup")
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "New leader signup notification sent to 0 recipient(s)"
      );
      expect(response.body.recipientCount).toBe(0);

      expect(EmailService.sendNewLeaderSignupEmail).not.toHaveBeenCalled();
    });

    it("should handle email sending failure gracefully", async () => {
      const mockAdmins = [
        {
          email: "admin1@test.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
      ];

      vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
        mockAdmins
      );
      vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(false);

      const testData = {
        userData: {
          firstName: "John",
          lastName: "Leader",
          email: "john.leader@test.com",
          roleInAtCloud: "Youth Pastor",
        },
      };

      const response = await request(app)
        .post("/new-leader-signup")
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "New leader signup notification sent to 0 recipient(s)"
      );
      expect(response.body.recipientCount).toBe(0);
    });

    it("should handle missing required fields", async () => {
      const testData = {
        userData: {
          // Missing firstName and email
          lastName: "Leader",
          roleInAtCloud: "Youth Pastor",
        },
      };

      const response = await request(app)
        .post("/new-leader-signup")
        .send(testData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "User data with email and name is required"
      );
    });

    it("should handle different ministry roles", async () => {
      const mockAdmins = [
        {
          email: "admin1@test.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
      ];

      vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
        mockAdmins
      );
      vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(true);

      const testData = {
        userData: {
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@test.com",
          roleInAtCloud: "Worship Leader",
        },
      };

      const response = await request(app)
        .post("/new-leader-signup")
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(EmailService.sendNewLeaderSignupEmail).toHaveBeenCalledWith(
        "admin1@test.com",
        "Admin One",
        expect.objectContaining({
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@test.com",
          roleInAtCloud: "Worship Leader",
        })
      );
    });

    it("should use default role when roleInAtCloud is missing", async () => {
      const mockAdmins = [
        {
          email: "admin1@test.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
      ];

      vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
        mockAdmins
      );
      vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(true);

      const testData = {
        userData: {
          firstName: "Bob",
          lastName: "Johnson",
          email: "bob.johnson@test.com",
          // No roleInAtCloud specified
        },
      };

      const response = await request(app)
        .post("/new-leader-signup")
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(EmailService.sendNewLeaderSignupEmail).toHaveBeenCalledWith(
        "admin1@test.com",
        "Admin One",
        expect.objectContaining({
          roleInAtCloud: "Leader", // Should default to "Leader"
        })
      );
    });
  });
});

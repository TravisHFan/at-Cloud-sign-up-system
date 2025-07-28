import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { EmailNotificationController } from "../../../src/controllers/emailNotificationController";
import { EmailService } from "../../../src/services/infrastructure/emailService";

// Mock the dependencies
vi.mock("../../../src/services/infrastructure/emailService");

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  (req as any).user = { id: "test-user-id", role: "Administrator" };
  next();
});

app.post(
  "/co-organizer-assigned",
  EmailNotificationController.sendCoOrganizerAssignedNotification
);

describe("Co-Organizer Assignment Email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /co-organizer-assigned", () => {
    it("should send co-organizer assignment notification successfully", async () => {
      vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
        true
      );

      const testData = {
        assignedUser: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
        },
        eventData: {
          title: "Youth Retreat 2025",
          date: "2025-08-15",
          time: "10:00 AM",
          location: "Mountain View Camp",
        },
        assignedBy: {
          firstName: "Jane",
          lastName: "Smith",
        },
      };

      const response = await request(app)
        .post("/co-organizer-assigned")
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Co-organizer assignment notification sent to 1 recipient(s)"
      );
      expect(response.body.recipientCount).toBe(1);

      // Verify EmailService.sendCoOrganizerAssignedEmail was called with correct parameters
      expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledTimes(
        1
      );
      expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
        "john.doe@test.com",
        {
          firstName: "John",
          lastName: "Doe",
        },
        {
          title: "Youth Retreat 2025",
          date: "2025-08-15",
          time: "10:00 AM",
          location: "Mountain View Camp",
        },
        {
          firstName: "Jane",
          lastName: "Smith",
        }
      );
    });

    it("should handle email sending failure gracefully", async () => {
      vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
        false
      );

      const testData = {
        assignedUser: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
        },
        eventData: {
          title: "Youth Retreat 2025",
          date: "2025-08-15",
          time: "10:00 AM",
          location: "Mountain View Camp",
        },
        assignedBy: {
          firstName: "Jane",
          lastName: "Smith",
        },
      };

      const response = await request(app)
        .post("/co-organizer-assigned")
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Co-organizer assignment notification sent to 0 recipient(s)"
      );
      expect(response.body.recipientCount).toBe(0);
    });

    it("should handle missing assigned user email", async () => {
      const testData = {
        assignedUser: {
          firstName: "John",
          lastName: "Doe",
          // Missing email
        },
        eventData: {
          title: "Youth Retreat 2025",
          date: "2025-08-15",
          time: "10:00 AM",
          location: "Mountain View Camp",
        },
        assignedBy: {
          firstName: "Jane",
          lastName: "Smith",
        },
      };

      const response = await request(app)
        .post("/co-organizer-assigned")
        .send(testData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Assigned user and event data are required"
      );
    });

    it("should handle missing event data", async () => {
      const testData = {
        assignedUser: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
        },
        // Missing eventData
        assignedBy: {
          firstName: "Jane",
          lastName: "Smith",
        },
      };

      const response = await request(app)
        .post("/co-organizer-assigned")
        .send(testData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Assigned user and event data are required"
      );
    });

    it("should handle missing assignedBy information", async () => {
      const testData = {
        assignedUser: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
        },
        eventData: {
          title: "Youth Retreat 2025",
          date: "2025-08-15",
          time: "10:00 AM",
          location: "Mountain View Camp",
        },
        // Missing assignedBy
      };

      const response = await request(app)
        .post("/co-organizer-assigned")
        .send(testData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Assigned by information is required");
    });

    it("should handle partial event data with defaults", async () => {
      vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
        true
      );

      const testData = {
        assignedUser: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
        },
        eventData: {
          title: "Community Service Day",
          // Missing date, time, location
        },
        assignedBy: {
          firstName: "Jane",
          lastName: "Smith",
        },
      };

      const response = await request(app)
        .post("/co-organizer-assigned")
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify default values are used
      expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
        "john.doe@test.com",
        {
          firstName: "John",
          lastName: "Doe",
        },
        {
          title: "Community Service Day",
          date: "TBD",
          time: "TBD",
          location: "TBD",
        },
        {
          firstName: "Jane",
          lastName: "Smith",
        }
      );
    });

    it("should handle missing optional fields gracefully", async () => {
      vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
        true
      );

      const testData = {
        assignedUser: {
          firstName: "John",
          // No lastName
          email: "john.doe@test.com",
        },
        eventData: {
          title: "Bible Study Group",
          date: "2025-09-01",
          time: "7:00 PM",
          location: "Church Hall",
        },
        assignedBy: {
          firstName: "Jane",
          // No lastName
        },
      };

      const response = await request(app)
        .post("/co-organizer-assigned")
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify empty strings are used for missing lastName fields
      expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
        "john.doe@test.com",
        {
          firstName: "John",
          lastName: "",
        },
        {
          title: "Bible Study Group",
          date: "2025-09-01",
          time: "7:00 PM",
          location: "Church Hall",
        },
        {
          firstName: "Jane",
          lastName: "",
        }
      );
    });
  });
});

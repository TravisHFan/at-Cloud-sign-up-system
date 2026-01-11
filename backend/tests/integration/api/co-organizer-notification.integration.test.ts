import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import { ROLES } from "../../../src/utils/roleUtils";
import { ensureIntegrationDB } from "../setup/connect";
import { TokenService } from "../../../src/middleware/auth";
import { EmailService } from "../../../src/services/infrastructure/EmailServiceFacade";
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";

// Mock EmailService
vi.mock("../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendCoOrganizerAssignedEmail: vi.fn().mockResolvedValue(true),
    sendEventCreatedEmail: vi.fn().mockResolvedValue(true),
  },
}));

// Mock UnifiedMessageController
vi.mock("../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue(true),
    createBroadcastSystemMessage: vi.fn().mockResolvedValue(true),
    getSystemMessages: vi.fn(),
    getUnreadCounts: vi.fn(),
    markAsRead: vi.fn(),
    deleteMessage: vi.fn(),
    markAllAsRead: vi.fn(),
    createSystemMessage: vi.fn(),
    getBellNotifications: vi.fn(),
    markBellNotificationAsRead: vi.fn(),
    markAllBellNotificationsAsRead: vi.fn(),
    removeBellNotification: vi.fn(),
    cleanupExpiredMessages: vi.fn(),
    checkWelcomeMessageStatus: vi.fn(),
    sendWelcomeNotification: vi.fn(),
  },
}));

describe("Co-Organizer Notification Debug", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
    await Event.deleteMany({});
    vi.clearAllMocks();
  });

  it("should send notifications to co-organizers upon event creation", async () => {
    // 1. Create Main Organizer
    const mainOrganizer = await User.create({
      firstName: "Main",
      lastName: "Organizer",
      username: "mainorg",
      email: "main@test.com",
      password: "Password123!",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    });

    const token = TokenService.generateAccessToken({
      userId: mainOrganizer._id.toString(),
      email: mainOrganizer.email,
      role: mainOrganizer.role,
    });

    // 2. Create Co-Organizer
    const coOrganizer = await User.create({
      firstName: "Co",
      lastName: "Organizer",
      username: "coorg",
      email: "co@test.com",
      password: "Password123!",
      role: ROLES.ADMINISTRATOR,
      isActive: true,
      isVerified: true,
      emailNotifications: false, // Disabled notifications to test the fix
    });

    // 3. Create Event with Co-Organizer
    // Use a future date (30 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateString = futureDate.toISOString().split("T")[0];

    const eventData = {
      title: "Co-Organizer Test Event",
      date: futureDateString,
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      type: "Conference",
      format: "In-person",
      description: "Test Description",
      organizer: "Main Organizer",
      organizerDetails: [
        {
          userId: mainOrganizer._id.toString(),
          name: "Main Organizer",
          role: "Main Organizer",
        },
        {
          userId: coOrganizer._id.toString(),
          name: "Co Organizer",
          role: "Co-Organizer",
        },
      ],
      roles: [
        {
          name: "Attendee",
          maxParticipants: 100,
          description: "General admission",
        },
      ],
    };

    const response = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send(eventData);

    if (response.status !== 201) {
      console.error(
        "Event Creation Failed:",
        JSON.stringify(response.body, null, 2)
      );
    }

    expect(response.status).toBe(201);

    // 4. Verify Notifications
    // Check Email
    expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalled();
    expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
      coOrganizer.email,
      expect.anything(),
      expect.anything(),
      expect.anything()
    );

    // Check System Message
    expect(
      UnifiedMessageController.createTargetedSystemMessage
    ).toHaveBeenCalled();
    // Verify it was sent to the co-organizer
    const systemMessageCalls = (
      UnifiedMessageController.createTargetedSystemMessage as any
    ).mock.calls;
    const coOrgCall = systemMessageCalls.find((call: any) =>
      call[1].includes(coOrganizer._id.toString())
    );
    expect(coOrgCall).toBeDefined();
  });
});

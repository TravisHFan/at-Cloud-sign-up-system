import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";
import User from "../../../src/models/User";
import Registration from "../../../src/models/Registration";
import { ROLES } from "../../../src/utils/roleUtils";

// Mock the models
vi.mock("../../../src/models/User");
vi.mock("../../../src/models/Registration");

const MockUser = vi.mocked(User);
const MockRegistration = vi.mocked(Registration);

describe("EmailRecipientUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getAdminUsers", () => {
    it("should return Super Admin and Administrator users who are active, verified, and want emails", async () => {
      // Arrange
      const mockAdminUsers = [
        {
          email: "superadmin@test.com",
          firstName: "Super",
          lastName: "Admin",
          role: "Super Admin",
        },
        {
          email: "admin@test.com",
          firstName: "John",
          lastName: "Admin",
          role: "Administrator",
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnValue(mockAdminUsers),
      };
      MockUser.find = vi.fn().mockReturnValue(mockQuery);

      // Act
      const result = await EmailRecipientUtils.getAdminUsers();

      // Assert
      expect(MockUser.find).toHaveBeenCalledWith({
        role: { $in: ["Super Admin", "Administrator"] },
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });
      expect(mockQuery.select).toHaveBeenCalledWith(
        "email firstName lastName role"
      );
      expect(result).toEqual(mockAdminUsers);
    });

    it("should return empty array when no admin users found", async () => {
      // Arrange
      const mockQuery = {
        select: vi.fn().mockReturnValue([]),
      };
      MockUser.find = vi.fn().mockReturnValue(mockQuery);

      // Act
      const result = await EmailRecipientUtils.getAdminUsers();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getActiveVerifiedUsers", () => {
    it("should return all active, verified users who want emails when no exclusion", async () => {
      // Arrange
      const mockUsers = [
        {
          email: "user1@test.com",
          firstName: "User",
          lastName: "One",
        },
        {
          email: "user2@test.com",
          firstName: "User",
          lastName: "Two",
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnValue(mockUsers),
      };
      MockUser.find = vi.fn().mockReturnValue(mockQuery);

      // Act
      const result = await EmailRecipientUtils.getActiveVerifiedUsers();

      // Assert
      expect(MockUser.find).toHaveBeenCalledWith({
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });
      expect(mockQuery.select).toHaveBeenCalledWith("email firstName lastName");
      expect(result).toEqual(mockUsers);
    });

    it("should exclude specified email address", async () => {
      // Arrange
      const excludeEmail = "creator@test.com";
      const mockUsers = [
        {
          email: "user1@test.com",
          firstName: "User",
          lastName: "One",
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnValue(mockUsers),
      };
      MockUser.find = vi.fn().mockReturnValue(mockQuery);

      // Act
      const result = await EmailRecipientUtils.getActiveVerifiedUsers(
        excludeEmail
      );

      // Assert
      expect(MockUser.find).toHaveBeenCalledWith({
        isActive: true,
        isVerified: true,
        emailNotifications: true,
        email: { $ne: excludeEmail },
      });
      expect(result).toEqual(mockUsers);
    });
  });

  describe("getEventParticipants", () => {
    it("should return active users registered for an event", async () => {
      // Arrange
      const eventId = "event123";
      const mockParticipants = [
        {
          userId: {
            email: "participant1@test.com",
            firstName: "Participant",
            lastName: "One",
          },
        },
        {
          userId: {
            email: "participant2@test.com",
            firstName: "Participant",
            lastName: "Two",
          },
        },
      ];

      const mockQuery = {
        populate: vi.fn().mockReturnValue(mockParticipants),
      };
      MockRegistration.find = vi.fn().mockReturnValue(mockQuery);

      // Act
      const result = await EmailRecipientUtils.getEventParticipants(eventId);

      // Assert
      expect(MockRegistration.find).toHaveBeenCalledWith({
        eventId: eventId,
        status: "active",
      });
      expect(mockQuery.populate).toHaveBeenCalledWith({
        path: "userId",
        match: {
          isActive: true,
          isVerified: true,
          emailNotifications: true,
        },
        select: "email firstName lastName",
      });
      expect(result).toEqual([
        mockParticipants[0].userId,
        mockParticipants[1].userId,
      ]);
    });

    it("should filter out null users", async () => {
      // Arrange
      const eventId = "event123";
      const mockParticipants = [
        {
          userId: {
            email: "participant1@test.com",
            firstName: "Participant",
            lastName: "One",
          },
        },
        {
          userId: null, // This user doesn't match criteria
        },
      ];

      const mockQuery = {
        populate: vi.fn().mockReturnValue(mockParticipants),
      };
      MockRegistration.find = vi.fn().mockReturnValue(mockQuery);

      // Act
      const result = await EmailRecipientUtils.getEventParticipants(eventId);

      // Assert
      expect(result).toEqual([mockParticipants[0].userId]);
    });
  });

  describe("getSystemAuthorizationChangeRecipients", () => {
    it("should return admin users excluding the changed user", async () => {
      // Arrange
      const changedUserId = "user123";
      const mockAdmins = [
        {
          email: "admin1@test.com",
          firstName: "Admin",
          lastName: "One",
          role: "Administrator",
        },
        {
          email: "superadmin@test.com",
          firstName: "Super",
          lastName: "Admin",
          role: "Super Admin",
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnValue(mockAdmins),
      };
      MockUser.find = vi.fn().mockReturnValue(mockQuery);

      // Act
      const result =
        await EmailRecipientUtils.getSystemAuthorizationChangeRecipients(
          changedUserId
        );

      // Assert
      expect(MockUser.find).toHaveBeenCalledWith({
        _id: { $ne: changedUserId },
        role: { $in: ["Super Admin", "Administrator"] },
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });
      expect(mockQuery.select).toHaveBeenCalledWith(
        "email firstName lastName role"
      );
      expect(result).toEqual(mockAdmins);
    });
  });

  describe("getRoleInAtCloudChangeRecipients", () => {
    it("should return Super Admins and @Cloud Leaders who want notifications", async () => {
      // Arrange
      const mockRecipients = [
        {
          email: "superadmin@test.com",
          firstName: "Super",
          lastName: "Admin",
          role: "Super Admin",
          roleInAtCloud: "IT Director",
        },
        {
          email: "leader@test.com",
          firstName: "Leader",
          lastName: "One",
          role: "Leader",
          roleInAtCloud: "Youth Pastor",
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnValue(mockRecipients),
      };
      MockUser.find = vi.fn().mockReturnValue(mockQuery);

      // Act
      const result =
        await EmailRecipientUtils.getRoleInAtCloudChangeRecipients();

      // Assert
      expect(MockUser.find).toHaveBeenCalledWith({
        $or: [
          { role: "Super Admin" },
          {
            role: { $in: ["Administrator", "Leader"] },
            isAtCloudLeader: true,
          },
        ],
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });
      expect(mockQuery.select).toHaveBeenCalledWith(
        "email firstName lastName role roleInAtCloud"
      );
      expect(result).toEqual(mockRecipients);
    });
  });

  describe("getEventCoOrganizers", () => {
    it("should return co-organizers excluding the main organizer", async () => {
      // Arrange
      const mockEvent = {
        organizerDetails: [
          { email: "organizer@test.com", name: "Main Organizer" },
          { email: "co-organizer1@test.com", name: "Co-Organizer 1" },
          { email: "co-organizer2@test.com", name: "Co-Organizer 2" },
        ],
        createdBy: "60c72b2f9b1e8b001c8e4e8a", // Mock ObjectId
      };

      const mockMainOrganizer = {
        email: "organizer@test.com",
      };

      const mockCoOrganizers = [
        {
          email: "co-organizer1@test.com",
          firstName: "Co",
          lastName: "Organizer1",
        },
        {
          email: "co-organizer2@test.com",
          firstName: "Co",
          lastName: "Organizer2",
        },
      ];

      // Mock User.findById for main organizer
      const mockFindByIdQuery = {
        select: vi.fn().mockReturnValue(mockMainOrganizer),
      };
      MockUser.findById = vi.fn().mockReturnValue(mockFindByIdQuery);

      // Mock User.find for co-organizers
      const mockFindQuery = {
        select: vi.fn().mockReturnValue(mockCoOrganizers),
      };
      MockUser.find = vi.fn().mockReturnValue(mockFindQuery);

      // Act
      const result = await EmailRecipientUtils.getEventCoOrganizers(
        mockEvent as any
      );

      // Assert
      expect(MockUser.findById).toHaveBeenCalledWith(
        "60c72b2f9b1e8b001c8e4e8a"
      );
      expect(mockFindByIdQuery.select).toHaveBeenCalledWith("email");
      expect(MockUser.find).toHaveBeenCalledWith({
        email: { $in: ["co-organizer1@test.com", "co-organizer2@test.com"] },
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });
      expect(mockFindQuery.select).toHaveBeenCalledWith(
        "email firstName lastName"
      );
      expect(result).toEqual(mockCoOrganizers);
    });

    it("should return empty array when no co-organizers", async () => {
      // Arrange
      const mockEvent = {
        organizerDetails: [
          { email: "organizer@test.com", name: "Main Organizer" },
        ],
        createdBy: "60c72b2f9b1e8b001c8e4e8a", // Mock ObjectId
      };

      const mockMainOrganizer = {
        email: "organizer@test.com",
      };

      // Mock User.findById for main organizer
      const mockFindByIdQuery = {
        select: vi.fn().mockReturnValue(mockMainOrganizer),
      };
      MockUser.findById = vi.fn().mockReturnValue(mockFindByIdQuery);

      // Act
      const result = await EmailRecipientUtils.getEventCoOrganizers(
        mockEvent as any
      );

      // Assert
      expect(MockUser.findById).toHaveBeenCalledWith(
        "60c72b2f9b1e8b001c8e4e8a"
      );
      expect(result).toEqual([]);
      // User.find should NOT be called when there are no co-organizers
      expect(MockUser.find).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { ResponseBuilderService } from "../../../src/services/ResponseBuilderService";
import { Event, Registration, User } from "../../../src/models";
import { RegistrationQueryService } from "../../../src/services/RegistrationQueryService";

// Mock the models
vi.mock("../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
    find: vi.fn(),
  },
  Registration: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
  User: {
    findById: vi.fn(),
    find: vi.fn(),
  },
}));

// Mock RegistrationQueryService
vi.mock("../../../src/services/RegistrationQueryService", () => ({
  RegistrationQueryService: {
    getEventSignupCounts: vi.fn(),
    getRoleAvailability: vi.fn(),
    getUserSignupInfo: vi.fn(),
    isUserRegisteredForRole: vi.fn(),
  },
}));

describe("ResponseBuilderService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test ObjectIds
  const eventId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const roleId = new Types.ObjectId().toString();

  describe("buildEventWithRegistrations", () => {
    it("should build complete event with registration data successfully", async () => {
      // Mock event data
      const mockEvent = {
        _id: eventId,
        title: "Test Event",
        description: "Test Description",
        location: "Test Location",
        startTime: new Date("2024-12-31T10:00:00Z"),
        endTime: new Date("2024-12-31T18:00:00Z"),
        status: "upcoming",
        createdBy: {
          _id: userId,
          username: "organizer",
          firstName: "John",
          lastName: "Doe",
          role: "admin",
          avatar: "avatar.jpg",
        },
        roles: [
          {
            id: roleId,
            name: "Volunteer",
            description: "Help with event",
            maxSignups: 10,
            requirements: "None",
          },
        ],
        organizer: {
          name: "John Doe",
          email: "john@example.com",
          phone: "123-456-7890",
        },
      };

      // Mock RegistrationQueryService response
      const mockEventSignupCounts = {
        eventId: eventId,
        totalSignups: 5,
        totalSlots: 10,
        roles: [
          {
            roleId: roleId,
            roleName: "Volunteer",
            maxParticipants: 10,
            currentCount: 5,
            availableSpots: 5,
            isFull: false,
            waitlistCount: 0,
          },
        ],
      };

      // Mock registrations
      const mockRegistrations = [
        {
          _id: new Types.ObjectId(),
          eventId: eventId,
          roleId: roleId,
          userId: {
            _id: userId,
            username: "testuser",
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
            gender: "female",
            systemAuthorizationLevel: "user",
            roleInAtCloud: "volunteer",
            role: "user",
            avatar: "jane.jpg",
          },
          registrationDate: new Date("2024-12-01T10:00:00Z"),
          preferences: { dietary: "vegetarian" },
          status: "confirmed",
        },
      ];

      // Setup mocks
      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        }),
      } as any);

      vi.mocked(
        RegistrationQueryService.getEventSignupCounts
      ).mockResolvedValue(mockEventSignupCounts);

      vi.mocked(Registration.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockRegistrations),
        }),
      } as any);

      const result = await ResponseBuilderService.buildEventWithRegistrations(
        eventId
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe(eventId);
      expect(result!.title).toBe("Test Event");
      expect(result!.totalRegistrations).toBe(5);
      expect(result!.roles).toHaveLength(1);
      expect(result!.roles[0].currentCount).toBe(5);
      expect(result!.roles[0].availableSpots).toBe(5);
      expect(result!.roles[0].registrations).toHaveLength(1);
      expect(result!.roles[0].registrations[0].user.firstName).toBe("Jane");
    });

    it("should return null when event is not found", async () => {
      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      } as any);

      const result = await ResponseBuilderService.buildEventWithRegistrations(
        eventId
      );

      expect(result).toBeNull();
      expect(Event.findById).toHaveBeenCalledWith(eventId);
    });

    it("should return null when event signup counts are not available", async () => {
      const mockEvent = {
        _id: eventId,
        title: "Test Event",
        roles: [],
        createdBy: { username: "organizer" },
      };

      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        }),
      } as any);

      vi.mocked(
        RegistrationQueryService.getEventSignupCounts
      ).mockResolvedValue(null);

      const result = await ResponseBuilderService.buildEventWithRegistrations(
        eventId
      );

      expect(result).toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      } as any);

      const result = await ResponseBuilderService.buildEventWithRegistrations(
        eventId
      );

      expect(result).toBeNull();
    });
  });

  describe("buildEventsWithRegistrations", () => {
    it("should build multiple events with registration data", async () => {
      const event1Id = new Types.ObjectId().toString();
      const event2Id = new Types.ObjectId().toString();

      const mockEvents = [
        {
          _id: event1Id,
          title: "Event 1",
          roles: [],
          createdBy: { username: "organizer1" },
        },
        {
          _id: event2Id,
          title: "Event 2",
          roles: [],
          createdBy: { username: "organizer2" },
        },
      ];

      // We need to mock the individual buildEventWithRegistrations calls
      vi.spyOn(ResponseBuilderService, "buildEventWithRegistrations")
        .mockResolvedValueOnce({
          id: event1Id,
          title: "Event 1",
          roles: [],
          totalRegistrations: 5,
          totalCapacity: 10,
          availableSpots: 5,
          totalSlots: 10,
          signedUp: 5,
        } as any)
        .mockResolvedValueOnce({
          id: event2Id,
          title: "Event 2",
          roles: [],
          totalRegistrations: 3,
          totalCapacity: 10,
          availableSpots: 7,
          totalSlots: 10,
          signedUp: 3,
        } as any);

      const result = await ResponseBuilderService.buildEventsWithRegistrations(
        mockEvents
      );

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Event 1");
      expect(result[1].title).toBe("Event 2");
    });

    it("should handle database errors gracefully", async () => {
      const mockEvents = [{ _id: eventId, title: "Test Event" }];

      vi.spyOn(
        ResponseBuilderService,
        "buildEventWithRegistrations"
      ).mockResolvedValue(null);

      const result = await ResponseBuilderService.buildEventsWithRegistrations(
        mockEvents
      );

      expect(result).toEqual([]);
    });
  });

  describe("buildAnalyticsEventData", () => {
    it("should build analytics event data successfully", async () => {
      const mockEvents = [
        {
          _id: eventId,
          title: "Analytics Event",
          startTime: new Date("2024-12-31T10:00:00Z"),
          status: "upcoming",
          createdBy: {
            _id: userId,
            username: "creator",
            firstName: "John",
            lastName: "Doe",
          },
          roles: [
            {
              id: roleId,
              name: "Volunteer",
              maxParticipants: 10,
            },
          ],
        },
      ];

      const mockEventSignupCounts = {
        eventId: eventId,
        totalSignups: 8,
        totalSlots: 10,
        roles: [
          {
            roleId: roleId,
            roleName: "Volunteer",
            maxParticipants: 10,
            currentCount: 8,
            availableSpots: 2,
            isFull: false,
            waitlistCount: 0,
          },
        ],
      };

      const mockRegistrations = [
        {
          _id: new Types.ObjectId(),
          eventId: eventId,
          roleId: roleId,
          userId: {
            _id: userId,
            gender: "female",
          },
          registrationDate: new Date("2024-12-01T10:00:00Z"),
        },
      ];

      vi.mocked(
        RegistrationQueryService.getEventSignupCounts
      ).mockResolvedValue(mockEventSignupCounts);

      vi.mocked(Registration.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockRegistrations),
        }),
      } as any);

      const result = await ResponseBuilderService.buildAnalyticsEventData(
        mockEvents
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(eventId);
      expect(result[0].title).toBe("Analytics Event");
      expect(result[0].totalRegistrations).toBe(8);
      expect(result[0].registrationRate).toBeDefined();
    });

    it("should handle empty events array", async () => {
      vi.mocked(Event.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await ResponseBuilderService.buildAnalyticsEventData([]);

      expect(result).toEqual([]);
    });

    it("should handle database errors gracefully", async () => {
      vi.mocked(Event.find).mockReturnValue({
        lean: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any);

      const result = await ResponseBuilderService.buildAnalyticsEventData([]);

      expect(result).toEqual([]);
    });
  });

  describe("buildUserSignupStatus", () => {
    it("should build user signup status successfully", async () => {
      const mockUserInfo = {
        userId: userId,
        currentSignups: 3,
        maxAllowedSignups: 5,
        canSignupForMore: true,
        activeRegistrations: [],
      };

      const mockRegistration = {
        _id: new Types.ObjectId(),
        eventId: eventId,
        roleId: roleId,
        userId: userId,
      };

      const mockEvent = {
        _id: eventId,
        title: "User Event",
        startTime: new Date("2024-12-31T10:00:00Z"),
        location: "Test Location",
        roles: [
          {
            id: roleId,
            name: "Common Participant (on-site)",
            maxParticipants: 10,
          },
        ],
      };

      const mockUser = {
        _id: userId,
        systemAuthorizationLevel: "User",
        firstName: "Test",
        lastName: "User",
      };

      const mockEventSignupCounts = {
        eventId: eventId,
        totalSignups: 3,
        totalSlots: 10,
        roles: [
          {
            roleId: roleId,
            roleName: "Common Participant (on-site)",
            maxParticipants: 10,
            currentCount: 3,
            availableSpots: 7,
            isFull: false,
            waitlistCount: 0,
          },
        ],
      };

      vi.mocked(Registration.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockRegistration),
      } as any);

      vi.mocked(RegistrationQueryService.getUserSignupInfo).mockResolvedValue(
        mockUserInfo
      );
      vi.mocked(
        RegistrationQueryService.getEventSignupCounts
      ).mockResolvedValue(mockEventSignupCounts);

      vi.mocked(Event.findById).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockEvent),
      } as any);

      vi.mocked(User.findById).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockUser),
      } as any);

      const result = await ResponseBuilderService.buildUserSignupStatus(
        userId,
        eventId
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.eventId).toBe(eventId);
      expect(result.isRegistered).toBe(true);
      expect(result.canSignupForMoreRoles).toBe(true);
      expect(result.currentSignupCount).toBe(3);
      expect(result.maxAllowedSignups).toBe(5);
    });

    it("should return null when user signup info is not available", async () => {
      vi.mocked(Registration.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as any);

      vi.mocked(RegistrationQueryService.getUserSignupInfo).mockResolvedValue(
        null
      );

      const result = await ResponseBuilderService.buildUserSignupStatus(
        userId,
        eventId
      );

      expect(result).toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      vi.mocked(Registration.findOne).mockReturnValue({
        lean: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any);

      const result = await ResponseBuilderService.buildUserSignupStatus(
        userId,
        eventId
      );

      expect(result).toBeNull();
    });
  });
});

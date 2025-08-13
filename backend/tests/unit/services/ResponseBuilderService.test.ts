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
    it("enriches organizer contacts when userId is present and leaves others unchanged", async () => {
      const organizerUserId = new Types.ObjectId().toString();
      const mockEvent = {
        _id: eventId,
        title: "Contact Enrichment Event",
        description: "desc",
        location: "loc",
        date: new Date(),
        time: "10:00",
        endTime: "11:00",
        status: "upcoming",
        createdBy: {
          _id: userId,
          username: "organizer",
          firstName: "Org",
          lastName: "User",
          role: "admin",
          avatar: "avatar.jpg",
        },
        roles: [
          {
            id: roleId,
            name: "Volunteer",
            description: "Help",
            maxParticipants: 10,
          },
        ],
        organizer: "Org Unit",
        organizerDetails: [
          { userId: organizerUserId, email: "old@x.com", phone: "old" },
          { email: "keep@x.com", phone: "keep" },
        ],
      } as any;

      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        }),
      } as any);

      vi.mocked(
        RegistrationQueryService.getEventSignupCounts
      ).mockResolvedValue({
        eventId,
        totalSignups: 0,
        totalSlots: 10,
        roles: [
          {
            roleId,
            roleName: "Volunteer",
            maxParticipants: 10,
            currentCount: 0,
            availableSpots: 10,
            isFull: false,
            waitlistCount: 0,
          },
        ],
      } as any);

      vi.mocked(Registration.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Fresh contact for the first organizer
      vi.mocked(User.findById).mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({
          email: "new@x.com",
          phone: "123",
          firstName: "New",
          lastName: "Name",
          avatar: "a.png",
        }),
      } as any);

      const result = await ResponseBuilderService.buildEventWithRegistrations(
        eventId
      );
      expect(result).toBeTruthy();
      const orgs = (result as any).organizerDetails as any[];
      expect(orgs[0].email).toBe("new@x.com");
      expect(orgs[0].name).toBe("New Name");
      expect(orgs[0].phone).toBe("123");
      // Second organizer had no userId and should remain unchanged
      expect(orgs[1].email).toBe("keep@x.com");
    });
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
    it("applies defaults when counts are missing and computes 0% registrationRate", async () => {
      const mockEvents = [
        {
          _id: eventId,
          title: "Analytics Defaults",
          time: "10:00",
          location: "loc",
          status: "upcoming",
          format: "in-person",
          type: "meetup",
          createdBy: {
            _id: userId,
            username: "creator",
            firstName: "A",
            lastName: "B",
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

      vi.mocked(
        RegistrationQueryService.getEventSignupCounts
      ).mockResolvedValue(undefined as any);
      vi.mocked(Registration.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await ResponseBuilderService.buildAnalyticsEventData(
        mockEvents as any
      );
      expect(result).toHaveLength(1);
      const analytics = result[0] as any;
      expect(analytics.totalCapacity).toBe(0);
      expect(analytics.totalRegistrations).toBe(0);
      expect(analytics.registrationRate).toBe(0);
      // hostedBy falls back to default when not provided on event
      expect(analytics.hostedBy).toBe("@Cloud Marketplace Ministry");
      // endTime falls back to time when missing on event
      expect(analytics.endTime).toBe("10:00");
    });
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
    it("returns null if event is not found or user not found", async () => {
      vi.mocked(Registration.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(RegistrationQueryService.getUserSignupInfo).mockResolvedValue({
        canSignupForMore: true,
        currentSignups: 0,
        maxAllowedSignups: 1,
      } as any);
      vi.mocked(
        RegistrationQueryService.getEventSignupCounts
      ).mockResolvedValue({ roles: [] } as any);

      // Event missing -> null
      vi.mocked(Event.findById).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as any);
      let res = await ResponseBuilderService.buildUserSignupStatus(
        userId,
        eventId
      );
      expect(res).toBeNull();

      // Event present but user missing -> null
      vi.mocked(Event.findById).mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: eventId, roles: [] }),
      } as any);
      vi.mocked(User.findById).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as any);
      res = await ResponseBuilderService.buildUserSignupStatus(userId, eventId);
      expect(res).toBeNull();
    });

    it("applies Participant restrictions and available roles when counts allow", async () => {
      const mockEvent = {
        _id: eventId,
        roles: [
          { id: "r1", name: "Common Participant (on-site)" },
          { id: "r2", name: "Leader" },
        ],
      } as any;

      vi.mocked(Registration.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(RegistrationQueryService.getUserSignupInfo).mockResolvedValue({
        canSignupForMore: true,
        currentSignups: 0,
        maxAllowedSignups: 1,
      } as any);
      vi.mocked(
        RegistrationQueryService.getEventSignupCounts
      ).mockResolvedValue({
        roles: [
          { roleId: "r1", isFull: false },
          { roleId: "r2", isFull: false },
        ],
      } as any);
      vi.mocked(Event.findById).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockEvent),
      } as any);
      vi.mocked(User.findById).mockReturnValue({
        lean: vi
          .fn()
          .mockResolvedValue({ systemAuthorizationLevel: "Participant" }),
      } as any);

      const res = await ResponseBuilderService.buildUserSignupStatus(
        userId,
        eventId
      );
      expect(res).toBeTruthy();
      expect(res!.availableRoles).toContain("Common Participant (on-site)");
      expect(res!.restrictedRoles).toContain("Leader");
      expect(res!.canSignup).toBe(true);
    });
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

  describe("Workshop Multi-Group Contact Visibility Fix", () => {
    it("should show contact info for users in ALL groups when viewer is registered in multiple groups", async () => {
      // IMPORTANT: Setup mocks AFTER global clearAllMocks() in beforeEach
      const multiGroupEventId = new Types.ObjectId().toString();
      const multiViewerId = new Types.ObjectId().toString();

      // Mock event data - Effective Communication Workshop
      const mockEvent = {
        _id: multiGroupEventId,
        title: "Multi-Group Workshop",
        type: "Effective Communication Workshop",
        date: "2024-01-15",
        time: "10:00",
        endTime: "12:00",
        location: "Conference Room A",
        organizer: "Test Organizer",
        organizerDetails: [],
        purpose: "Test purpose",
        format: "In-person",
        createdBy: {
          _id: new Types.ObjectId(),
          username: "creator",
          firstName: "Jane",
          lastName: "Doe",
          role: "admin",
          avatar: null,
        },
        roles: [
          {
            id: "role-ga-leader",
            name: "Group A Leader",
            description: "Leader for Group A",
            maxParticipants: 1,
          },
          {
            id: "role-gb-participants",
            name: "Group B Participants",
            description: "Participants in Group B",
            maxParticipants: 3,
          },
        ],
      };

      // Mock viewer registrations - registered in BOTH Group A and Group B
      const mockViewerRegistrations = [
        {
          eventId: multiGroupEventId,
          userId: multiViewerId,
          roleId: "role-ga-leader", // Group A Leader
        },
        {
          eventId: multiGroupEventId,
          userId: multiViewerId,
          roleId: "role-gb-participants", // Group B Participants
        },
      ];

      // Mock registrations for roles
      const mockGALeaderRegs = [
        {
          _id: "reg1",
          eventId: multiGroupEventId,
          roleId: "role-ga-leader",
          userId: {
            _id: multiViewerId,
            username: "viewer",
            firstName: "Test",
            lastName: "Viewer",
            email: "viewer@example.com",
            phone: "111-1111",
            gender: "male",
            systemAuthorizationLevel: "Participant",
            roleInAtCloud: "Member",
            role: "Participant",
            avatar: null,
          },
          status: "active",
          createdAt: new Date(),
        },
      ];

      const mockGBParticipantRegs = [
        {
          _id: "reg2",
          eventId: multiGroupEventId,
          roleId: "role-gb-participants",
          userId: {
            _id: "user-gb-participant",
            username: "gb_participant",
            firstName: "Group B",
            lastName: "Participant",
            email: "gb.participant@example.com",
            phone: "444-4444",
            gender: "female",
            systemAuthorizationLevel: "Participant",
            roleInAtCloud: "Member",
            role: "Participant",
            avatar: null,
          },
          status: "active",
          createdAt: new Date(),
        },
      ];

      // Mock signup counts
      const mockEventSignupCounts = {
        eventId: multiGroupEventId,
        totalSignups: 2,
        totalSlots: 4,
        roles: [
          {
            roleId: "role-ga-leader",
            roleName: "Group A Leader",
            maxParticipants: 1,
            currentCount: 1,
            availableSpots: 0,
            isFull: true,
            waitlistCount: 0,
          },
          {
            roleId: "role-gb-participants",
            roleName: "Group B Participants",
            maxParticipants: 3,
            currentCount: 1,
            availableSpots: 2,
            isFull: false,
            waitlistCount: 0,
          },
        ],
      };

      // Setup mocks - first test case with multi-group event
      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        }),
      } as any);

      vi.mocked(
        RegistrationQueryService.getEventSignupCounts
      ).mockResolvedValue(mockEventSignupCounts as any);

      // Robust Registration.find mock: return values based on query to avoid order sensitivity
      (vi.mocked(Registration.find) as any).mockImplementation((query: any) => {
        // Viewer registrations lookup: find({ eventId, userId }).lean()
        if (
          query &&
          query.eventId === multiGroupEventId &&
          query.userId === multiViewerId
        ) {
          return {
            lean: vi.fn().mockResolvedValue(mockViewerRegistrations),
            populate: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(mockViewerRegistrations),
            }),
          };
        }
        // Role queries with populate().lean()
        if (
          query &&
          query.eventId === multiGroupEventId &&
          query.roleId === "role-ga-leader"
        ) {
          return {
            populate: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(mockGALeaderRegs),
            }),
            lean: vi.fn().mockResolvedValue(mockGALeaderRegs),
          };
        }
        if (
          query &&
          query.eventId === multiGroupEventId &&
          query.roleId === "role-gb-participants"
        ) {
          return {
            populate: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(mockGBParticipantRegs),
            }),
            lean: vi.fn().mockResolvedValue(mockGBParticipantRegs),
          };
        }
        // Default safe fallback
        return {
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
          lean: vi.fn().mockResolvedValue([]),
        };
      });

      // Execute the method
      const result = await ResponseBuilderService.buildEventWithRegistrations(
        multiGroupEventId,
        multiViewerId
      );

      // Assertions
      expect(result).toBeTruthy();
      expect(result!.type).toBe("Effective Communication Workshop");

      // Find roles
      const gaLeaderRole = result!.roles.find(
        (r) => r.name === "Group A Leader"
      );
      const gbParticipantRole = result!.roles.find(
        (r) => r.name === "Group B Participants"
      );

      expect(gaLeaderRole).toBeTruthy();
      expect(gbParticipantRole).toBeTruthy();

      // Viewer should see their own contact info (Group A Leader)
      const viewerReg = gaLeaderRole!.registrations[0];
      expect(viewerReg.user.email).toBe("viewer@example.com");
      expect(viewerReg.user.phone).toBe("111-1111");

      // Viewer should see Group B Participant contact (same group B due to multi-registration)
      const gbParticipantReg = gbParticipantRole!.registrations[0];
      expect(gbParticipantReg.user.email).toBe("gb.participant@example.com");
      expect(gbParticipantReg.user.phone).toBe("444-4444");
    });

    it("should hide contact info from groups the viewer is NOT registered in", async () => {
      // IMPORTANT: Setup mocks AFTER global clearAllMocks() in beforeEach
      const singleGroupEventId = new Types.ObjectId().toString();
      const singleViewerId = new Types.ObjectId().toString();

      // Mock event data
      const mockEvent = {
        _id: singleGroupEventId,
        title: "Single Group Workshop",
        type: "Effective Communication Workshop",
        date: "2024-01-15",
        time: "10:00",
        endTime: "12:00",
        location: "Conference Room A",
        organizer: "Test Organizer",
        organizerDetails: [],
        purpose: "Test purpose",
        format: "In-person",
        createdBy: {
          _id: new Types.ObjectId(),
          username: "creator",
          firstName: "Jane",
          lastName: "Doe",
          role: "admin",
          avatar: null,
        },
        roles: [
          {
            id: "role-ga-leader",
            name: "Group A Leader",
            description: "Leader for Group A",
            maxParticipants: 1,
          },
          {
            id: "role-gb-leader",
            name: "Group B Leader",
            description: "Leader for Group B",
            maxParticipants: 1,
          },
        ],
      };

      // Mock viewer registrations - only in Group A
      const mockViewerRegistrations = [
        {
          eventId: singleGroupEventId,
          userId: singleViewerId,
          roleId: "role-ga-leader", // Only Group A Leader
        },
      ];

      // Mock registrations for roles
      const mockGALeaderRegs = [
        {
          _id: "reg1",
          eventId: singleGroupEventId,
          roleId: "role-ga-leader",
          userId: {
            _id: singleViewerId,
            username: "viewer",
            firstName: "Test",
            lastName: "Viewer",
            email: "viewer@example.com",
            phone: "111-1111",
            gender: "male",
            systemAuthorizationLevel: "Participant",
            roleInAtCloud: "Member",
            role: "Participant",
            avatar: null,
          },
          status: "active",
          createdAt: new Date(),
        },
      ];

      const mockGBLeaderRegs = [
        {
          _id: "reg2",
          eventId: singleGroupEventId,
          roleId: "role-gb-leader",
          userId: {
            _id: "user-gb-leader",
            username: "gb_leader",
            firstName: "Group B",
            lastName: "Leader",
            email: "gb.leader@example.com",
            phone: "333-3333",
            gender: "male",
            systemAuthorizationLevel: "Participant",
            roleInAtCloud: "Member",
            role: "Participant",
            avatar: null,
          },
          status: "active",
          createdAt: new Date(),
        },
      ];

      // Mock signup counts
      const mockEventSignupCounts = {
        eventId: singleGroupEventId,
        totalSignups: 2,
        totalSlots: 2,
        roles: [
          {
            roleId: "role-ga-leader",
            roleName: "Group A Leader",
            maxParticipants: 1,
            currentCount: 1,
            availableSpots: 0,
            isFull: true,
            waitlistCount: 0,
          },
          {
            roleId: "role-gb-leader",
            roleName: "Group B Leader",
            maxParticipants: 1,
            currentCount: 1,
            availableSpots: 0,
            isFull: true,
            waitlistCount: 0,
          },
        ],
      };

      // Setup mocks - second test case with single-group event
      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        }),
      } as any);

      vi.mocked(
        RegistrationQueryService.getEventSignupCounts
      ).mockResolvedValue(mockEventSignupCounts as any);

      // Robust Registration.find mock: return values based on query to avoid order sensitivity
      (vi.mocked(Registration.find) as any).mockImplementation((query: any) => {
        // Viewer registrations lookup: find({ eventId, userId }).lean()
        if (
          query &&
          query.eventId === singleGroupEventId &&
          query.userId === singleViewerId
        ) {
          return {
            lean: vi.fn().mockResolvedValue(mockViewerRegistrations),
            populate: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(mockViewerRegistrations),
            }),
          };
        }
        // Role queries with populate().lean()
        if (
          query &&
          query.eventId === singleGroupEventId &&
          query.roleId === "role-ga-leader"
        ) {
          return {
            populate: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(mockGALeaderRegs),
            }),
            lean: vi.fn().mockResolvedValue(mockGALeaderRegs),
          };
        }
        if (
          query &&
          query.eventId === singleGroupEventId &&
          query.roleId === "role-gb-leader"
        ) {
          return {
            populate: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(mockGBLeaderRegs),
            }),
            lean: vi.fn().mockResolvedValue(mockGBLeaderRegs),
          };
        }
        // Default safe fallback
        return {
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
          lean: vi.fn().mockResolvedValue([]),
        };
      });

      // Execute the method
      const result = await ResponseBuilderService.buildEventWithRegistrations(
        singleGroupEventId,
        singleViewerId
      );

      // Assertions
      expect(result).toBeTruthy();

      // Find roles
      const gaLeaderRole = result!.roles.find(
        (r) => r.name === "Group A Leader"
      );
      const gbLeaderRole = result!.roles.find(
        (r) => r.name === "Group B Leader"
      );

      expect(gaLeaderRole).toBeTruthy();
      expect(gbLeaderRole).toBeTruthy();

      // Viewer should see their own contact info (Group A Leader)
      const viewerReg = gaLeaderRole!.registrations[0];
      expect(viewerReg.user.email).toBe("viewer@example.com");
      expect(viewerReg.user.phone).toBe("111-1111");

      // Viewer should NOT see Group B Leader contact (different group)
      const gbLeaderReg = gbLeaderRole!.registrations[0];
      expect(gbLeaderReg.user.email).toBe(""); // Hidden
      expect(gbLeaderReg.user.phone).toBeUndefined(); // Hidden
    });
  });
});

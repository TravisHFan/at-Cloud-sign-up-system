import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { RegistrationQueryService } from "../../../src/services/RegistrationQueryService";
import { CapacityService } from "../../../src/services/CapacityService";
import {
  Registration,
  Event,
  User,
  GuestRegistration,
} from "../../../src/models";

// Mock the models
vi.mock("../../../src/models", () => ({
  Registration: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
  },
  Event: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
  },
  User: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
  },
  GuestRegistration: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
    countActiveRegistrations: vi.fn(),
  },
}));

describe("RegistrationQueryService", () => {
  const mockEventId = new mongoose.Types.ObjectId();
  const mockUserId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default guest mocks to zero/empty
    vi.mocked((GuestRegistration as any).aggregate).mockResolvedValue([]);
    vi.mocked(
      (GuestRegistration as any).countActiveRegistrations
    ).mockResolvedValue(0);
    vi.mocked((GuestRegistration as any).countDocuments).mockResolvedValue(
      0 as any
    );
  });

  describe("getRoleAvailability", () => {
    it("should successfully get role availability", async () => {
      const mockEvent = {
        _id: mockEventId,
        roles: [
          {
            id: "leader",
            name: "Leader",
            maxParticipants: 5,
          },
        ],
      };

      const mockQuery = {
        lean: vi.fn().mockResolvedValue(mockEvent),
      };
      vi.mocked(Event.findById).mockReturnValue(mockQuery as any);
      vi.mocked(Registration.countDocuments).mockResolvedValue(3);

      const result = await RegistrationQueryService.getRoleAvailability(
        mockEventId.toString(),
        "leader"
      );

      expect(result).toEqual({
        roleId: "leader",
        roleName: "Leader",
        maxParticipants: 5,
        currentCount: 3,
        availableSpots: 2,
        isFull: false,
        waitlistCount: 0,
      });
    });

    it("should return role is full when at capacity", async () => {
      const mockEvent = {
        _id: mockEventId,
        roles: [
          {
            id: "leader",
            name: "Leader",
            maxParticipants: 5,
          },
        ],
      };

      const mockQuery = {
        lean: vi.fn().mockResolvedValue(mockEvent),
      };
      vi.mocked(Event.findById).mockReturnValue(mockQuery as any);
      vi.mocked(Registration.countDocuments).mockResolvedValue(5);

      const result = await RegistrationQueryService.getRoleAvailability(
        mockEventId.toString(),
        "leader"
      );

      expect(result).toEqual({
        roleId: "leader",
        roleName: "Leader",
        maxParticipants: 5,
        currentCount: 5,
        availableSpots: 0,
        isFull: true,
        waitlistCount: 0,
      });
    });

    it("should return null when event does not exist", async () => {
      const mockQuery = {
        lean: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(Event.findById).mockReturnValue(mockQuery as any);

      const result = await RegistrationQueryService.getRoleAvailability(
        mockEventId.toString(),
        "leader"
      );

      expect(result).toBeNull();
    });

    it("should return null when role does not exist", async () => {
      const mockEvent = {
        _id: mockEventId,
        roles: [
          {
            id: "member",
            name: "Member",
            maxParticipants: 10,
          },
        ],
      };

      const mockQuery = {
        lean: vi.fn().mockResolvedValue(mockEvent),
      };
      vi.mocked(Event.findById).mockReturnValue(mockQuery as any);

      const result = await RegistrationQueryService.getRoleAvailability(
        mockEventId.toString(),
        "leader"
      );

      expect(result).toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      const mockQuery = {
        lean: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.mocked(Event.findById).mockReturnValue(mockQuery as any);

      const result = await RegistrationQueryService.getRoleAvailability(
        mockEventId.toString(),
        "leader"
      );

      expect(result).toBeNull();
    });
  });

  describe("getEventSignupCounts", () => {
    it("should return event signup counts successfully", async () => {
      const mockEvent = {
        _id: mockEventId,
        roles: [
          { id: "leader", name: "Leader", maxParticipants: 2 },
          { id: "member", name: "Member", maxParticipants: 10 },
        ],
      };

      const mockCounts = [
        { _id: "leader", count: 1 },
        { _id: "member", count: 5 },
      ];

      const mockEventQuery = {
        lean: vi.fn().mockResolvedValue(mockEvent),
      };
      vi.mocked(Event.findById).mockReturnValue(mockEventQuery as any);
      // Use CapacityService to drive counts per role (users + guests)
      const occSpy = vi.spyOn(CapacityService, "getRoleOccupancy");
      occSpy.mockImplementation(async (_eventId: string, roleId: string) => {
        if (roleId === "leader")
          return { users: 1, guests: 0, total: 1, capacity: 2 } as any;
        if (roleId === "member")
          return { users: 5, guests: 0, total: 5, capacity: 10 } as any;
        return { users: 0, guests: 0, total: 0, capacity: null } as any;
      });

      const result = await RegistrationQueryService.getEventSignupCounts(
        mockEventId.toString()
      );

      expect(result).toEqual({
        eventId: mockEventId.toString(),
        totalSignups: 6,
        totalSlots: 12,
        roles: [
          {
            roleId: "leader",
            roleName: "Leader",
            maxParticipants: 2,
            currentCount: 1,
            availableSpots: 1,
            isFull: false,
            waitlistCount: 0,
          },
          {
            roleId: "member",
            roleName: "Member",
            maxParticipants: 10,
            currentCount: 5,
            availableSpots: 5,
            isFull: false,
            waitlistCount: 0,
          },
        ],
      });
    });

    it("should return null when event does not exist", async () => {
      const mockEventQuery = {
        lean: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(Event.findById).mockReturnValue(mockEventQuery as any);

      const result = await RegistrationQueryService.getEventSignupCounts(
        "invalid-event-id"
      );

      expect(result).toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      const mockEventQuery = {
        lean: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.mocked(Event.findById).mockReturnValue(mockEventQuery as any);

      const result = await RegistrationQueryService.getEventSignupCounts(
        mockEventId.toString()
      );

      expect(result).toBeNull();
    });
  });

  describe("getUserSignupInfo", () => {
    it("should successfully get user signup info for participant role", async () => {
      const mockUser = {
        _id: mockUserId,
        role: "Participant",
      };

      const mockRegistrations = [
        {
          eventId: mockEventId,
          roleId: "leader",
          eventSnapshot: {
            title: "Test Event 1",
            roleName: "Leader",
          },
        },
      ];

      const mockUserQuery = {
        lean: vi.fn().mockResolvedValue(mockUser),
      };
      vi.mocked(User.findById).mockReturnValue(mockUserQuery as any);
      vi.mocked(Registration.aggregate).mockResolvedValue(mockRegistrations);

      const result = await RegistrationQueryService.getUserSignupInfo(
        mockUserId.toString()
      );

      expect(result).toEqual({
        userId: mockUserId.toString(),
        currentSignups: 1,
        maxAllowedSignups: 1,
        canSignupForMore: false,
        activeRegistrations: [
          {
            eventId: mockEventId.toString(),
            roleId: "leader",
            eventTitle: "Test Event 1",
            roleName: "Leader",
          },
        ],
      });
    });

    it("should return null when user does not exist", async () => {
      const mockUserQuery = {
        lean: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(User.findById).mockReturnValue(mockUserQuery as any);

      const result = await RegistrationQueryService.getUserSignupInfo(
        "invalid-user-id"
      );

      expect(result).toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      const mockUserQuery = {
        lean: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.mocked(User.findById).mockReturnValue(mockUserQuery as any);

      const result = await RegistrationQueryService.getUserSignupInfo(
        mockUserId.toString()
      );

      expect(result).toBeNull();
    });
  });

  describe("getRoleParticipants", () => {
    it("should successfully get role participants with user details", async () => {
      const mockParticipants = [
        {
          userId: mockUserId,
          userSnapshot: {
            username: "johndoe",
            firstName: "John",
            lastName: "Doe",
            avatar: "avatar.jpg",
            gender: "male",
          },
          registrationDate: new Date("2024-01-01"),
          notes: "Test notes",
        },
      ];

      vi.mocked(Registration.aggregate).mockResolvedValue(mockParticipants);

      const result = await RegistrationQueryService.getRoleParticipants(
        mockEventId.toString(),
        "leader"
      );

      expect(result).toEqual([
        {
          userId: mockUserId.toString(),
          username: "johndoe",
          firstName: "John",
          lastName: "Doe",
          avatar: "avatar.jpg",
          gender: "male",
          registrationDate: new Date("2024-01-01"),
          notes: "Test notes",
        },
      ]);
    });

    it("should return empty array when no participants exist", async () => {
      vi.mocked(Registration.aggregate).mockResolvedValue([]);

      const result = await RegistrationQueryService.getRoleParticipants(
        mockEventId.toString(),
        "nonexistent-role"
      );

      expect(result).toEqual([]);
    });

    it("should handle database errors gracefully", async () => {
      vi.mocked(Registration.aggregate).mockRejectedValue(
        new Error("Database error")
      );

      const result = await RegistrationQueryService.getRoleParticipants(
        mockEventId.toString(),
        "leader"
      );

      expect(result).toEqual([]);
    });
  });

  describe("isUserRegisteredForRole", () => {
    it("should return true when user is registered for role", async () => {
      const mockRegistration = {
        _id: "registration-id",
        userId: mockUserId.toString(),
        eventId: mockEventId.toString(),
        role: "leader",
      };

      const mockQuery = {
        lean: vi.fn().mockResolvedValue(mockRegistration),
      };
      vi.mocked(Registration.findOne).mockReturnValue(mockQuery as any);

      const result = await RegistrationQueryService.isUserRegisteredForRole(
        mockUserId.toString(),
        mockEventId.toString(),
        "leader"
      );

      expect(result).toBe(true);
    });

    it("should return false when user is not registered for role", async () => {
      const mockQuery = {
        lean: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(Registration.findOne).mockReturnValue(mockQuery as any);

      const result = await RegistrationQueryService.isUserRegisteredForRole(
        mockUserId.toString(),
        mockEventId.toString(),
        "leader"
      );

      expect(result).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      const mockQuery = {
        lean: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.mocked(Registration.findOne).mockReturnValue(mockQuery as any);

      const result = await RegistrationQueryService.isUserRegisteredForRole(
        mockUserId.toString(),
        mockEventId.toString(),
        "leader"
      );

      expect(result).toBe(false);
    });
  });

  describe("getUserRoleInEvent", () => {
    it("should return user role when user is registered", async () => {
      const mockRegistration = {
        _id: "registration-id",
        userId: mockUserId,
        eventId: mockEventId,
        roleId: "leader",
        eventSnapshot: {
          roleName: "Leader",
        },
        registrationDate: new Date("2024-01-01"),
      };

      const mockQuery = {
        lean: vi.fn().mockResolvedValue(mockRegistration),
      };
      vi.mocked(Registration.findOne).mockReturnValue(mockQuery as any);

      const result = await RegistrationQueryService.getUserRoleInEvent(
        mockUserId.toString(),
        mockEventId.toString()
      );

      expect(result).toEqual({
        roleId: "leader",
        roleName: "Leader",
        registrationDate: new Date("2024-01-01"),
      });
    });

    it("should return null when user is not registered", async () => {
      const mockQuery = {
        lean: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(Registration.findOne).mockReturnValue(mockQuery as any);

      const result = await RegistrationQueryService.getUserRoleInEvent(
        mockUserId.toString(),
        mockEventId.toString()
      );

      expect(result).toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      const mockQuery = {
        lean: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.mocked(Registration.findOne).mockReturnValue(mockQuery as any);

      const result = await RegistrationQueryService.getUserRoleInEvent(
        mockUserId.toString(),
        mockEventId.toString()
      );

      expect(result).toBeNull();
    });
  });

  it("should include active guest registrations in totals and per-role counts", async () => {
    const mockEvent = {
      _id: mockEventId,
      roles: [
        { id: "leader", name: "Leader", maxParticipants: 2 },
        { id: "member", name: "Member", maxParticipants: 3 },
      ],
    };

    const userCounts = [
      { _id: "leader", count: 1 },
      { _id: "member", count: 1 },
    ];
    const guestCounts = [{ _id: "member", count: 2 }];

    vi.mocked(Event.findById).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockEvent),
    } as any);
    // Mock occupancy to include guests for member role
    const occSpy = vi.spyOn(CapacityService, "getRoleOccupancy");
    occSpy.mockImplementation(async (_eventId: string, roleId: string) => {
      if (roleId === "leader")
        return { users: 1, guests: 0, total: 1, capacity: 2 } as any;
      if (roleId === "member")
        return { users: 1, guests: 2, total: 3, capacity: 3 } as any;
      return { users: 0, guests: 0, total: 0, capacity: null } as any;
    });

    const result = await RegistrationQueryService.getEventSignupCounts(
      mockEventId.toString()
    );

    expect(result).toEqual({
      eventId: mockEventId.toString(),
      totalSignups: 1 /*leader*/ + 1 /*member user*/ + 2 /*member guests*/,
      totalSlots: 5,
      roles: [
        expect.objectContaining({
          roleId: "leader",
          currentCount: 1,
          availableSpots: 1,
          isFull: false,
        }),
        expect.objectContaining({
          roleId: "member",
          currentCount: 3,
          availableSpots: 0,
          isFull: true,
        }),
      ],
    });
  });
});

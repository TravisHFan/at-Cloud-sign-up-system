import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { RegistrationQueryService } from "../../../src/services/RegistrationQueryService";
import {
  Registration,
  Event,
  User,
  GuestRegistration,
} from "../../../src/models";

// Narrow mock to only methods used here to keep intent clear
vi.mock("../../../src/models", () => ({
  Registration: {
    aggregate: vi.fn(),
  },
  Event: {
    findById: vi.fn(),
  },
  User: {
    findById: vi.fn(),
  },
  GuestRegistration: {
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));

describe("RegistrationQueryService - additional branches", () => {
  const mockEventId = new mongoose.Types.ObjectId();
  const mockUserId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getEventSignupCounts returns zeros when aggregate returns empty array", async () => {
    const mockEvent = {
      _id: mockEventId,
      roles: [
        { id: "leader", name: "Leader", maxParticipants: 2 },
        { id: "member", name: "Member", maxParticipants: 3 },
      ],
    };

    const mockEventQuery = { lean: vi.fn().mockResolvedValue(mockEvent) };
    vi.mocked(Event.findById).mockReturnValue(mockEventQuery as any);
    vi.mocked(Registration.aggregate).mockResolvedValue([]);
    vi.mocked(GuestRegistration.aggregate).mockResolvedValue([]);

    const result = await RegistrationQueryService.getEventSignupCounts(
      mockEventId.toString()
    );

    expect(result).toEqual({
      eventId: mockEventId.toString(),
      totalSignups: 0,
      totalSlots: 5,
      roles: [
        {
          roleId: "leader",
          roleName: "Leader",
          maxParticipants: 2,
          currentCount: 0,
          availableSpots: 2,
          isFull: false,
          waitlistCount: 0,
        },
        {
          roleId: "member",
          roleName: "Member",
          maxParticipants: 3,
          currentCount: 0,
          availableSpots: 3,
          isFull: false,
          waitlistCount: 0,
        },
      ],
    });
  });

  it("getUserSignupInfo applies Administrator max limit and canSignupForMore", async () => {
    const mockUser = { _id: mockUserId, role: "Administrator" };
    const mockUserQuery = { lean: vi.fn().mockResolvedValue(mockUser) };
    vi.mocked(User.findById).mockReturnValue(mockUserQuery as any);

    const mockRegistrations = [
      {
        eventId: mockEventId,
        roleId: "leader",
        eventSnapshot: { title: "Event A", roleName: "Leader" },
      },
    ];
    vi.mocked(Registration.aggregate).mockResolvedValue(mockRegistrations);

    const result = await RegistrationQueryService.getUserSignupInfo(
      mockUserId.toString()
    );

    expect(result).toEqual({
      userId: mockUserId.toString(),
      currentSignups: 1,
      maxAllowedSignups: 3,
      canSignupForMore: true,
      activeRegistrations: [
        {
          eventId: mockEventId.toString(),
          roleId: "leader",
          eventTitle: "Event A",
          roleName: "Leader",
        },
      ],
    });
  });
});

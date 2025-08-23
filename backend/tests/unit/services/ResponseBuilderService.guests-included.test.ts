import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { ResponseBuilderService } from "../../../src/services/ResponseBuilderService";
import { Event, Registration } from "../../../src/models";
import { RegistrationQueryService } from "../../../src/services/RegistrationQueryService";

vi.mock("../../../src/models", () => ({
  Event: { findById: vi.fn() },
  Registration: { find: vi.fn() },
  User: { findById: vi.fn() },
}));

vi.mock("../../../src/services/RegistrationQueryService", () => ({
  RegistrationQueryService: {
    getEventSignupCounts: vi.fn(),
  },
}));

describe("ResponseBuilderService - guests included in signedUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("buildEventWithRegistrations should use totalSignups (users+guests)", async () => {
    const eventId = new Types.ObjectId();
    const roleId = "r1";
    const mockEvent: any = {
      _id: eventId,
      title: "T",
      description: "d",
      location: "loc",
      date: "2025-01-01",
      endDate: "2025-01-01",
      time: "10:00",
      endTime: "11:00",
      status: "upcoming",
      createdBy: { _id: new Types.ObjectId(), username: "u" },
      roles: [
        { id: roleId, name: "Volunteer", description: "", maxParticipants: 3 },
      ],
      organizerDetails: [],
    };

    vi.mocked(Event.findById).mockReturnValue({
      populate: vi
        .fn()
        .mockReturnValue({ lean: vi.fn().mockResolvedValue(mockEvent) }),
    } as any);

    vi.mocked(Registration.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
      populate: vi
        .fn()
        .mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    } as any);

    // Simulate counts: users=1, guests=1 -> totalSignups=2
    vi.mocked(RegistrationQueryService.getEventSignupCounts).mockResolvedValue({
      eventId: eventId.toString(),
      totalSignups: 2,
      totalSlots: 3,
      roles: [
        {
          roleId: roleId,
          roleName: "Volunteer",
          maxParticipants: 3,
          currentCount: 2,
          availableSpots: 1,
          isFull: false,
          waitlistCount: 0,
        },
      ],
    } as any);

    const res = await ResponseBuilderService.buildEventWithRegistrations(
      eventId.toString()
    );
    expect(res).toBeTruthy();
    expect(res!.signedUp).toBe(2);
    expect(res!.totalSlots).toBe(3);
    expect(res!.roles[0].currentCount).toBe(2);
  });
});

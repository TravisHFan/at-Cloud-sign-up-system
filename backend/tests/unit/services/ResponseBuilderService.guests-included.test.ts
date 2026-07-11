import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { ResponseBuilderService } from "../../../src/services/ResponseBuilderService";
import { Event, GuestRegistration, Registration } from "../../../src/models";

vi.mock("../../../src/models", () => ({
  Event: { findById: vi.fn(), updateOne: vi.fn() },
  Registration: { find: vi.fn() },
  GuestRegistration: { aggregate: vi.fn() },
  User: { findById: vi.fn(), find: vi.fn() },
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
      select: vi.fn().mockReturnThis(),
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          eventId,
          roleId,
          userId: {
            _id: new Types.ObjectId(),
            username: "member",
            firstName: "Member",
            lastName: "One",
          },
        },
      ]),
    } as any);
    vi.mocked(GuestRegistration.aggregate).mockResolvedValue([
      { _id: roleId, count: 1 },
    ] as any);

    const res = await ResponseBuilderService.buildEventWithRegistrations(
      eventId.toString(),
    );
    expect(res).toBeTruthy();
    expect(res!.signedUp).toBe(2);
    expect(res!.totalSlots).toBe(3);
    expect(res!.roles[0].currentCount).toBe(2);
  });
});

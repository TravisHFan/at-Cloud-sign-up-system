import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { GuestController } from "../../../src/controllers/guestController";
import GuestRegistration from "../../../src/models/GuestRegistration";
import Event from "../../../src/models/Event";
import Registration from "../../../src/models/Registration";
import { socketService } from "../../../src/services/infrastructure/SocketService";

vi.mock("../../../src/models/GuestRegistration");
vi.mock("../../../src/models/Event");
vi.mock("../../../src/models/Registration");
vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: { emitEventUpdate: vi.fn() },
}));
vi.mock("../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventWithRegistrations: vi.fn(async () => ({ id: "e1", roles: [] })),
  },
}));
vi.mock("../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
  },
}));

describe("GuestController.moveGuestBetweenRoles", () => {
  const eventId = new mongoose.Types.ObjectId().toString();
  const guestId = new mongoose.Types.ObjectId().toString();

  let req: Partial<Request>;
  let res: Partial<Response> & { status: any; json: any };

  beforeEach(() => {
    vi.resetAllMocks();
    req = {
      params: { id: eventId },
      body: { guestRegistrationId: guestId, fromRoleId: "r1", toRoleId: "r2" },
    } as any;
    // Ensure chainable status(...).json(...) by explicitly returning res
    res = {} as any;
    (res as any).status = vi.fn(() => res);
    (res as any).json = vi.fn(() => res);
  });

  it("moves a guest when capacity allows", async () => {
    vi.mocked(Event.findById).mockResolvedValue({
      _id: eventId as any,
      roles: [
        { id: "r1", name: "A", maxParticipants: 2 },
        { id: "r2", name: "B", maxParticipants: 2 },
      ],
      save: vi.fn(),
    } as any);
    vi.mocked(GuestRegistration.findById).mockResolvedValue({
      _id: guestId as any,
      eventId: eventId as any,
      roleId: "r1",
      status: "active",
      fullName: "Guest One",
      save: vi.fn(),
    } as any);
    vi.mocked(Registration.countDocuments).mockResolvedValue(0 as any);
    (GuestRegistration as any).countActiveRegistrations = vi
      .fn()
      .mockResolvedValue(1);

    await GuestController.moveGuestBetweenRoles(
      req as Request,
      res as Response
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );

    // Assert both backward-compatible and explicit events are emitted
    expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
      eventId,
      "guest_updated",
      expect.objectContaining({
        roleId: "r2",
        guestName: "Guest One",
      })
    );
    expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
      eventId,
      "guest_moved",
      expect.objectContaining({
        fromRoleId: "r1",
        toRoleId: "r2",
        fromRoleName: "A",
        toRoleName: "B",
        guestName: "Guest One",
      })
    );
  });

  it("rejects when target role full", async () => {
    vi.mocked(Event.findById).mockResolvedValue({
      _id: eventId as any,
      roles: [
        { id: "r1", name: "A", maxParticipants: 2 },
        { id: "r2", name: "B", maxParticipants: 2 },
      ],
      save: vi.fn(),
    } as any);
    vi.mocked(GuestRegistration.findById).mockResolvedValue({
      _id: guestId as any,
      eventId: eventId as any,
      roleId: "r1",
      status: "active",
      fullName: "Guest One",
      save: vi.fn(),
    } as any);
    vi.mocked(Registration.countDocuments).mockResolvedValue(2 as any);
    (GuestRegistration as any).countActiveRegistrations = vi
      .fn()
      .mockResolvedValue(0);

    await GuestController.moveGuestBetweenRoles(
      req as Request,
      res as Response
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});

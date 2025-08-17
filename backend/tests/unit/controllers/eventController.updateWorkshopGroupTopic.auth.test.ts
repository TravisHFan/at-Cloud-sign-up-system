import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import mongoose from "mongoose";

// Mocks must be declared before importing the SUT
vi.mock("../../../src/models", () => ({
  Event: Object.assign(vi.fn(), {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  }),
  Registration: Object.assign(vi.fn(), {
    countDocuments: vi.fn(),
  }),
}));

vi.mock("../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
  },
}));

vi.mock("../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventWithRegistrations: vi.fn().mockResolvedValue({ id: "evt-1" }),
  },
}));

vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

// Import after mocks
import { EventController } from "../../../src/controllers/eventController";
import { Event, Registration } from "../../../src/models";
import { CachePatterns } from "../../../src/services";
import { ResponseBuilderService } from "../../../src/services/ResponseBuilderService";
import { socketService } from "../../../src/services/infrastructure/SocketService";

describe("EventController.updateWorkshopGroupTopic authorization", () => {
  let req: Partial<Request & { user: any }>;
  let res: Partial<Response> & { status: any; json: any };

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: { id: new mongoose.Types.ObjectId().toString(), group: "B" },
      body: { topic: "  New Topic  " },
      user: {
        _id: new mongoose.Types.ObjectId().toString(),
        role: "Member",
      },
    } as any;

    const json = vi.fn();
    const status = vi.fn().mockReturnThis();
    res = { json, status } as any;
  });

  it("allows event initiator (createdBy) to update", async () => {
    const initiatorId = req.user!._id;
    vi.mocked(Event.findById).mockResolvedValue({
      _id: req.params!.id,
      type: "Effective Communication Workshop",
      createdBy: new mongoose.Types.ObjectId(initiatorId),
      organizerDetails: [],
      roles: [],
    } as any);

    await EventController.updateWorkshopGroupTopic(
      req as Request,
      res as Response
    );

    expect(Event.findById).toHaveBeenCalledWith(req.params!.id);
    expect(Event.findByIdAndUpdate).toHaveBeenCalledWith(
      req.params!.id,
      { $set: { ["workshopGroupTopics.B"]: "New Topic" } },
      { new: true, runValidators: true, context: "query" }
    );
    expect(
      ResponseBuilderService.buildEventWithRegistrations
    ).toHaveBeenCalled();
    expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
      req.params!.id
    );
    expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
      req.params!.id,
      "workshop_topic_updated",
      expect.objectContaining({
        group: "B",
        topic: "  New Topic  ",
        userId: initiatorId,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Group topic updated" })
    );
  });

  it("allows co-organizer in organizerDetails to update", async () => {
    const userId = req.user!._id;
    vi.mocked(Event.findById).mockResolvedValue({
      _id: req.params!.id,
      type: "Effective Communication Workshop",
      createdBy: new mongoose.Types.ObjectId(), // someone else
      organizerDetails: [{ userId: new mongoose.Types.ObjectId(userId) }],
      roles: [],
    } as any);

    await EventController.updateWorkshopGroupTopic(
      req as Request,
      res as Response
    );

    expect(Event.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("allows specific Group Leader to update only their group", async () => {
    const userId = req.user!._id;
    // Authorized for group C as leader
    (req.params as any).group = "C";
    vi.mocked(Event.findById).mockResolvedValue({
      _id: req.params!.id,
      type: "Effective Communication Workshop",
      createdBy: new mongoose.Types.ObjectId(),
      organizerDetails: [],
      roles: [
        { id: "roleC", name: "Group C Leader" },
        { id: "roleD", name: "Group D Leader" },
      ],
    } as any);
    vi.mocked(Registration.countDocuments).mockResolvedValueOnce(1 as any);

    await EventController.updateWorkshopGroupTopic(
      req as Request,
      res as Response
    );
    expect(Event.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);

    // Now switch to group D where the user is NOT a leader
    (req.params as any).group = "D";
    vi.mocked(Registration.countDocuments).mockResolvedValueOnce(0 as any);

    await EventController.updateWorkshopGroupTopic(
      req as Request,
      res as Response
    );
    expect(res.status).toHaveBeenLastCalledWith(403);
    expect(res.json).toHaveBeenLastCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it("rejects when event is not Effective Communication Workshop", async () => {
    vi.mocked(Event.findById).mockResolvedValue({
      _id: req.params!.id,
      type: "Conference",
    } as any);

    await EventController.updateWorkshopGroupTopic(
      req as Request,
      res as Response
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});

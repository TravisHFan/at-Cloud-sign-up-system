/**
 * Unit tests for ProgramController facade
 * Tests delegation to sub-controllers
 */
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { Request, Response } from "express";
import { ProgramController } from "../../../src/controllers/programController";

// Mock all sub-controllers
vi.mock("../../../src/controllers/programs/CreationController", () => ({
  default: { create: vi.fn() },
}));
vi.mock("../../../src/controllers/programs/EventListController", () => ({
  default: { listEvents: vi.fn() },
}));
vi.mock("../../../src/controllers/programs/ListController", () => ({
  default: { list: vi.fn() },
}));
vi.mock("../../../src/controllers/programs/RetrievalController", () => ({
  default: { getById: vi.fn() },
}));
vi.mock("../../../src/controllers/programs/UpdateController", () => ({
  default: { update: vi.fn() },
}));
vi.mock("../../../src/controllers/programs/DeletionController", () => ({
  default: { remove: vi.fn() },
}));
vi.mock("../../../src/controllers/programs/ParticipantsController", () => ({
  default: { getParticipants: vi.fn() },
}));
vi.mock("../../../src/controllers/programs/AdminEnrollController", () => ({
  default: { adminEnroll: vi.fn() },
}));
vi.mock("../../../src/controllers/programs/AdminUnenrollController", () => ({
  default: { adminUnenroll: vi.fn() },
}));

describe("ProgramController", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      body: {},
      params: { id: "program123" },
      query: {},
      user: { _id: "user123", email: "admin@example.com", role: "Super Admin" },
    } as Partial<Request>;
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as Partial<Response>;
  });

  describe("create", () => {
    it("should delegate to CreationController.create", async () => {
      const CreationController = (
        await import("../../../src/controllers/programs/CreationController")
      ).default;
      (CreationController.create as Mock).mockResolvedValue(undefined);

      await ProgramController.create(mockReq as Request, mockRes as Response);

      expect(CreationController.create).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("listEvents", () => {
    it("should delegate to EventListController.listEvents", async () => {
      const EventListController = (
        await import("../../../src/controllers/programs/EventListController")
      ).default;
      (EventListController.listEvents as Mock).mockResolvedValue(undefined);

      await ProgramController.listEvents(
        mockReq as Request,
        mockRes as Response,
      );

      expect(EventListController.listEvents).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("list", () => {
    it("should delegate to ListController.list", async () => {
      const ListController = (
        await import("../../../src/controllers/programs/ListController")
      ).default;
      (ListController.list as Mock).mockResolvedValue(undefined);

      await ProgramController.list(mockReq as Request, mockRes as Response);

      expect(ListController.list).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("getById", () => {
    it("should delegate to RetrievalController.getById", async () => {
      const RetrievalController = (
        await import("../../../src/controllers/programs/RetrievalController")
      ).default;
      (RetrievalController.getById as Mock).mockResolvedValue(undefined);

      await ProgramController.getById(mockReq as Request, mockRes as Response);

      expect(RetrievalController.getById).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("update", () => {
    it("should delegate to UpdateController.update", async () => {
      const UpdateController = (
        await import("../../../src/controllers/programs/UpdateController")
      ).default;
      (UpdateController.update as Mock).mockResolvedValue(undefined);

      await ProgramController.update(mockReq as Request, mockRes as Response);

      expect(UpdateController.update).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("remove", () => {
    it("should delegate to DeletionController.remove", async () => {
      const DeletionController = (
        await import("../../../src/controllers/programs/DeletionController")
      ).default;
      (DeletionController.remove as Mock).mockResolvedValue(undefined);

      await ProgramController.remove(mockReq as Request, mockRes as Response);

      expect(DeletionController.remove).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("getParticipants", () => {
    it("should delegate to ParticipantsController.getParticipants", async () => {
      const ParticipantsController = (
        await import("../../../src/controllers/programs/ParticipantsController")
      ).default;
      (ParticipantsController.getParticipants as Mock).mockResolvedValue(
        undefined,
      );

      await ProgramController.getParticipants(
        mockReq as Request,
        mockRes as Response,
      );

      expect(ParticipantsController.getParticipants).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("adminEnroll", () => {
    it("should delegate to AdminEnrollController.adminEnroll", async () => {
      const AdminEnrollController = (
        await import("../../../src/controllers/programs/AdminEnrollController")
      ).default;
      (AdminEnrollController.adminEnroll as Mock).mockResolvedValue(undefined);

      await ProgramController.adminEnroll(
        mockReq as Request,
        mockRes as Response,
      );

      expect(AdminEnrollController.adminEnroll).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("adminUnenroll", () => {
    it("should delegate to AdminUnenrollController.adminUnenroll", async () => {
      const AdminUnenrollController = (
        await import("../../../src/controllers/programs/AdminUnenrollController")
      ).default;
      (AdminUnenrollController.adminUnenroll as Mock).mockResolvedValue(
        undefined,
      );

      await ProgramController.adminUnenroll(
        mockReq as Request,
        mockRes as Response,
      );

      expect(AdminUnenrollController.adminUnenroll).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });
});

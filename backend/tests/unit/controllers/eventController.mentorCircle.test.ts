import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { EventController } from "../../../src/controllers/eventController";
import { Event, Program, User } from "../../../src/models";
import mongoose from "mongoose";

// Mock mongoose for ObjectId validation
vi.mock("mongoose", async () => {
  const actual = await vi.importActual<typeof import("mongoose")>("mongoose");
  const isValidFn = vi.fn((id: string) => /^[0-9a-fA-F]{24}$/.test(id));
  return {
    ...actual,
    Types: {
      ...actual.Types,
      ObjectId: {
        ...actual.Types.ObjectId,
        isValid: isValidFn,
      },
    },
  };
});

// Mock roleUtils as named exports expected by controller and models (ROLES)
vi.mock("../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(() => true),
  PERMISSIONS: {
    CREATE_EVENT: "CREATE_EVENT",
  },
  ROLES: {
    PARTICIPANT: "Participant",
    LEADER: "Leader",
    ADMINISTRATOR: "Administrator",
    SUPER_ADMIN: "Super Admin",
    GUEST_EXPERT: "Guest Expert",
  },
}));

// Mock aggregated models module (controller imports from ../models)
vi.mock("../../../src/models", () => ({
  Event: Object.assign(vi.fn(), {
    findById: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    deleteMany: vi.fn(),
  }),
  Program: Object.assign(vi.fn(), {
    findById: vi.fn(),
    updateOne: vi.fn(),
  }),
  User: Object.assign(vi.fn(), {
    findById: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  }),
}));

// Mock other services
vi.mock("../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    success: vi.fn((data: any) => ({ success: true, data })),
    error: vi.fn((message: string, status: number) => ({
      success: false,
      message,
      status,
    })),
    // Keep it lightweight and deterministic for tests
    buildEventWithRegistrations: vi.fn(async (_id: string) => ({
      _id,
      organizerDetails: [],
      roles: [],
    })),
  },
}));

// Avoid exercising real system message controller during unit tests
vi.mock("../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue(true),
  },
}));

// Short-circuit email recipient utilities to empty results to avoid heavy flows
vi.mock("../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getActiveVerifiedUsers: vi.fn().mockResolvedValue([]),
    getEventCoOrganizers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

vi.mock("../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEventCreatedEmail: vi.fn().mockResolvedValue(true),
    sendGenericNotificationEmail: vi.fn().mockResolvedValue(true),
    sendCoOrganizerAssignedEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
  },
}));

describe("EventController - programLabels array handling", () => {
  let mockReq: any;
  let mockRes: any;
  // Base valid event data that would pass initial validation (match controller schema)
  const baseValidEventData = {
    title: "Test Event with Programs",
    type: "Workshop", // Required field
    purpose: "Test purpose",
    date: "2099-01-01",
    time: "10:00",
    endDate: "2099-01-01",
    endTime: "11:00",
    timeZone: "America/New_York",
    location: "Test Location", // Required field
    organizer: "Test Organizer",
    roles: [
      { name: "Attendee", description: "No special role", maxParticipants: 30 },
    ],
    format: "Online",
    agenda: "Test agenda with sufficient length for validation requirements",
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      body: { ...baseValidEventData, suppressNotifications: true },
      user: { _id: "creator-id", role: "Administrator" },
    };

    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };

    // Default successful mocks
    const mockEvent = {
      _id: "event-id",
      save: vi.fn().mockResolvedValue({ _id: "event-id" }),
      toObject: vi.fn().mockReturnValue({ id: "event-id" }),
    };

    vi.mocked(Event as unknown as any).mockImplementation(
      () => mockEvent as any
    );
    // When controller calls Event.find(...).select(...).lean(), return [] to avoid conflicts
    vi.mocked((Event as unknown as any).find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    } as any);
    vi.mocked((Program as unknown as any).updateOne).mockResolvedValue(
      {} as any
    );
  });

  it("should accept empty programLabels array", async () => {
    mockReq.body = {
      ...baseValidEventData,
      programLabels: [],
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    // Verify Event was created with empty programLabels
    const eventConstructorArgs = vi.mocked(Event as unknown as any).mock
      .calls[0][0] as any;
    expect(eventConstructorArgs.programLabels).toEqual([]);
    expect(mockRes.status).not.toHaveBeenCalledWith(400);
  });

  it("should accept single program in programLabels array", async () => {
    const programId = "507f1f77bcf86cd799439011";
    const mockProgram = { _id: programId };

    // Mock Program.findById to return valid program
    vi.mocked((Program as unknown as any).findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockProgram),
    } as any);

    mockReq.body = {
      ...baseValidEventData,
      programLabels: [programId],
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    // Verify Program was queried
    expect((Program as unknown as any).findById).toHaveBeenCalledWith(
      programId
    );

    // Verify Event was created with programLabels
    const eventConstructorArgs = vi.mocked(Event as unknown as any).mock
      .calls[0][0] as any;
    expect(eventConstructorArgs.programLabels).toHaveLength(1);
    expect(eventConstructorArgs.programLabels[0].toString()).toBe(programId);

    // Verify Program.events was updated
    expect((Program as unknown as any).updateOne).toHaveBeenCalledWith(
      { _id: programId },
      expect.objectContaining({
        $addToSet: expect.objectContaining({ events: "event-id" }),
      })
    );
  });

  it("should accept multiple programs in programLabels array", async () => {
    const programId1 = "507f1f77bcf86cd799439011";
    const programId2 = "507f1f77bcf86cd799439012";
    const programId3 = "507f1f77bcf86cd799439013";
    const mockProgram1 = { _id: programId1 };
    const mockProgram2 = { _id: programId2 };
    const mockProgram3 = { _id: programId3 };

    // Mock Program.findById for each program
    vi.mocked((Program as unknown as any).findById).mockImplementation(
      (id: string) => ({
        select: vi
          .fn()
          .mockResolvedValue(
            id === programId1
              ? mockProgram1
              : id === programId2
              ? mockProgram2
              : mockProgram3
          ),
      })
    );

    mockReq.body = {
      ...baseValidEventData,
      programLabels: [programId1, programId2, programId3],
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    // Verify all programs were queried
    expect((Program as unknown as any).findById).toHaveBeenCalledWith(
      programId1
    );
    expect((Program as unknown as any).findById).toHaveBeenCalledWith(
      programId2
    );
    expect((Program as unknown as any).findById).toHaveBeenCalledWith(
      programId3
    );

    // Verify Event was created with all programLabels
    const eventConstructorArgs = vi.mocked(Event as unknown as any).mock
      .calls[0][0] as any;
    expect(eventConstructorArgs.programLabels).toHaveLength(3);
    expect(
      eventConstructorArgs.programLabels.map((id: any) => id.toString())
    ).toEqual([programId1, programId2, programId3]);

    // Verify all Program.events were updated
    expect((Program as unknown as any).updateOne).toHaveBeenCalledTimes(3);
    expect((Program as unknown as any).updateOne).toHaveBeenCalledWith(
      { _id: programId1 },
      expect.objectContaining({
        $addToSet: expect.objectContaining({ events: "event-id" }),
      })
    );
    expect((Program as unknown as any).updateOne).toHaveBeenCalledWith(
      { _id: programId2 },
      expect.objectContaining({
        $addToSet: expect.objectContaining({ events: "event-id" }),
      })
    );
    expect((Program as unknown as any).updateOne).toHaveBeenCalledWith(
      { _id: programId3 },
      expect.objectContaining({
        $addToSet: expect.objectContaining({ events: "event-id" }),
      })
    );
  });

  it("should reject invalid program ID in programLabels array", async () => {
    // "invalid-id" is not a valid 24-character hex string, so it will be rejected
    mockReq.body = {
      ...baseValidEventData,
      programLabels: ["invalid-id"],
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/invalid/i),
      })
    );
  });

  it("should reject non-existent program ID in programLabels array", async () => {
    const nonExistentId = "507f1f77bcf86cd799439099";

    // Mock Program.findById to return null (program not found)
    vi.mocked((Program as unknown as any).findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as any);

    mockReq.body = {
      ...baseValidEventData,
      programLabels: [nonExistentId],
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/not found/i),
      })
    );
  });

  it("should filter out null/undefined/empty values from programLabels", async () => {
    const validProgramId = "507f1f77bcf86cd799439011";
    const mockProgram = { _id: validProgramId };

    vi.mocked((Program as unknown as any).findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockProgram),
    } as any);

    mockReq.body = {
      ...baseValidEventData,
      programLabels: [validProgramId, null, "", "none", undefined] as any,
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    // Verify only valid program was queried
    expect((Program as unknown as any).findById).toHaveBeenCalledTimes(1);
    expect((Program as unknown as any).findById).toHaveBeenCalledWith(
      validProgramId
    );

    // Verify Event was created with only valid programLabel
    const eventConstructorArgs = vi.mocked(Event as unknown as any).mock
      .calls[0][0] as any;
    expect(eventConstructorArgs.programLabels).toHaveLength(1);
    expect(eventConstructorArgs.programLabels[0].toString()).toBe(
      validProgramId
    );
  });

  it("should deduplicate program IDs in programLabels array", async () => {
    const programId = "507f1f77bcf86cd799439011";
    const mockProgram = { _id: programId };

    vi.mocked((Program as unknown as any).findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockProgram),
    } as any);

    mockReq.body = {
      ...baseValidEventData,
      programLabels: [programId, programId, programId], // Duplicates
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    // Verify Program was queried only once (deduplicated)
    expect((Program as unknown as any).findById).toHaveBeenCalledTimes(1);

    // Verify Event was created with deduplicated programLabels
    const eventConstructorArgs = vi.mocked(Event as unknown as any).mock
      .calls[0][0] as any;
    expect(eventConstructorArgs.programLabels).toHaveLength(1);
    expect(eventConstructorArgs.programLabels[0].toString()).toBe(programId);

    // Verify Program.events was updated only once
    expect((Program as unknown as any).updateOne).toHaveBeenCalledTimes(1);
  });
});

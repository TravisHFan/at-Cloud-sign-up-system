import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { EventController } from "../../../src/controllers/eventController";
import { Event, Program, User } from "../../../src/models";
import mongoose from "mongoose";

// Mock mongoose for ObjectId validation
vi.mock("mongoose", async () => {
  const actual = await vi.importActual("mongoose");
  return {
    ...actual,
    Types: {
      ObjectId: {
        isValid: vi.fn(() => true),
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

vi.mock("../../../src/services/infrastructure/emailService", () => ({
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

describe("EventController - Mentor Circle mentorIds merge and validation", () => {
  let mockReq: any;
  let mockRes: any;
  // Base valid event data that would pass initial validation (match controller schema)
  const baseValidEventData = {
    title: "Test Mentor Circle Event",
    purpose: "Test purpose",
    date: "2099-01-01",
    time: "10:00",
    endDate: "2099-01-01",
    endTime: "11:00",
    timeZone: "America/New_York",
    // location will be forced to "Online" by controller when format === "Online"
    organizer: "Test Organizer",
    roles: [
      { name: "Mentors", description: "", maxParticipants: 5 },
      { name: "Mentees", description: "", maxParticipants: 10 },
    ],
    format: "Online",
    agenda: "Test agenda",
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

  it("should require programId for Mentor Circle events", async () => {
    mockReq.body = {
      ...baseValidEventData,
      type: "Mentor Circle",
      // Missing programId
      mentorCircle: "E",
      mentorIds: ["mentor1"],
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: "Mentor Circle events must include programId.",
    });
  });

  it("should require mentorCircle for Mentor Circle events", async () => {
    mockReq.body = {
      ...baseValidEventData,
      type: "Mentor Circle",
      programId: "program-1",
      // Missing mentorCircle
      mentorIds: ["mentor1"],
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: "Mentor Circle events require mentorCircle (E/M/B/A).",
    });
  });

  it("should merge inherited mentors from program with event-level mentorIds", async () => {
    // Mock program with mentorsByCircle
    const programId = "507f1f77bcf86cd799439011";
    const eventMentorId = "507f1f77bcf86cd799439012";
    const mockProgram = {
      _id: programId,
      mentorsByCircle: {
        E: [
          {
            userId: "inherited-mentor-1",
            firstName: "Alice",
            lastName: "Leader",
            email: "alice@example.com",
            roleInAtCloud: "Leader",
            gender: "female",
            avatar: "alice.jpg",
          },
        ],
      },
    };

    // Mock event-level mentors
    const mockEventMentors = [
      {
        _id: eventMentorId,
        firstName: "Bob",
        lastName: "Admin",
        email: "bob@example.com",
        role: "Administrator", // This is what roleInAtCloud should map from
        gender: "male",
        avatar: "bob.jpg",
      },
    ];

    // Program.findById(...).select(...)
    vi.mocked((Program as unknown as any).findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockProgram),
    } as any);
    // User.find({...}).select(...)
    vi.mocked((User as unknown as any).find).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockEventMentors),
    } as any);

    mockReq.body = {
      ...baseValidEventData,
      type: "Mentor Circle",
      programId,
      mentorCircle: "E",
      mentorIds: [eventMentorId],
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    // Verify Program was queried
    expect((Program as unknown as any).findById).toHaveBeenCalledWith(
      programId
    );

    // Verify event-level mentors were queried
    expect((User as unknown as any).find).toHaveBeenCalledWith({
      _id: { $in: [eventMentorId] },
    });

    // Verify Event was created with merged mentors
    const eventConstructorArgs = vi.mocked(Event as unknown as any).mock
      .calls[0][0] as any;
    expect(eventConstructorArgs.mentors).toHaveLength(2); // 1 inherited + 1 event-level

    // Check merged mentors contain both inherited and event-level
    expect(eventConstructorArgs.mentors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "inherited-mentor-1",
          name: "Alice Leader",
          email: "alice@example.com",
        }),
        expect.objectContaining({
          userId: eventMentorId,
          name: "Bob Admin",
          email: "bob@example.com",
        }),
      ])
    );
  });

  it("should deduplicate mentors by userId", async () => {
    // Valid ObjectIds
    const programId = "507f1f77bcf86cd799439021";
    const duplicateId = "507f1f77bcf86cd799439022";
    // Mock program with mentor that will be duplicated in event-level
    const mockProgram = {
      _id: programId,
      mentorsByCircle: {
        E: [
          {
            userId: duplicateId,
            firstName: "Alice",
            lastName: "Leader",
            email: "alice@example.com",
            roleInAtCloud: "Leader",
          },
        ],
      },
    };

    // Mock event-level mentors with same userId
    const mockEventMentors = [
      {
        _id: duplicateId,
        firstName: "Alice",
        lastName: "Leader",
        email: "alice@example.com",
        role: "Leader",
      },
    ];

    vi.mocked((Program as unknown as any).findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockProgram),
    } as any);
    vi.mocked((User as unknown as any).find).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockEventMentors),
    } as any);

    mockReq.body = {
      ...baseValidEventData,
      type: "Mentor Circle",
      programId,
      mentorCircle: "E",
      mentorIds: [duplicateId], // Same as inherited
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    // Should have only 1 mentor after deduplication
    const eventConstructorArgs = vi.mocked(Event as unknown as any).mock
      .calls[0][0] as any;
    expect(eventConstructorArgs.mentors).toHaveLength(1);
    expect(String(eventConstructorArgs.mentors[0].userId)).toBe(duplicateId);
  });

  it("should filter mentors by eligible roles", async () => {
    const programId = "507f1f77bcf86cd799439031";
    const adminId = "507f1f77bcf86cd799439032";
    const participantId = "507f1f77bcf86cd799439033";
    const mockProgram = {
      _id: programId,
      mentorsByCircle: { E: [] },
    };

    // Mock mix of eligible and ineligible users
    const mockEventMentors = [
      {
        _id: adminId,
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Administrator", // Eligible
      },
      {
        _id: participantId,
        firstName: "Regular",
        lastName: "User",
        email: "regular@example.com",
        role: "Participant", // Not eligible
      },
    ];

    vi.mocked((Program as unknown as any).findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockProgram),
    } as any);
    vi.mocked((User as unknown as any).find).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockEventMentors),
    } as any);

    mockReq.body = {
      ...baseValidEventData,
      type: "Mentor Circle",
      programId,
      mentorCircle: "E",
      mentorIds: [adminId, participantId],
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    // Should only include eligible mentor
    const eventConstructorArgs = vi.mocked(Event as unknown as any).mock
      .calls[0][0] as any;
    expect(eventConstructorArgs.mentors).toHaveLength(1);
    expect(String(eventConstructorArgs.mentors[0].userId)).toBe(adminId);
  });

  it("should ignore mentorIds for non-Mentor Circle events", async () => {
    // Use valid roles for a non-Mentor Circle type to pass validation
    mockReq.body = {
      ...baseValidEventData,
      type: "Effective Communication Workshop", // Not Mentor Circle
      roles: [
        { name: "Zoom Host", description: "", maxParticipants: 1 },
        { name: "Zoom Co-host", description: "", maxParticipants: 1 },
      ],
      mentorIds: ["should-be-ignored"],
    };

    await EventController.createEvent(mockReq as Request, mockRes as Response);

    // Verify Event was created without mentors field
    const eventConstructorArgs = vi.mocked(Event as unknown as any).mock
      .calls[0][0] as any;
    expect(eventConstructorArgs.mentors).toBeNull();

    // Verify mentorIds was removed from eventData
    expect(eventConstructorArgs.mentorIds).toBeUndefined();
  });
});

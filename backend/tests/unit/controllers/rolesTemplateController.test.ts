import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { RolesTemplateController } from "../../../src/controllers/rolesTemplateController";
import RolesTemplate from "../../../src/models/RolesTemplate";
import { CorrelatedLogger } from "../../../src/services/CorrelatedLogger";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../src/models/RolesTemplate");
vi.mock("../../../src/services/CorrelatedLogger");

describe("RolesTemplateController", () => {
  let mockReq: Partial<Request> & { user?: any };
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup response mocks
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      params: {},
      body: {},
      user: undefined,
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Mock logger
    mockLogger = {
      error: vi.fn(),
    };
    vi.mocked(CorrelatedLogger.fromRequest).mockReturnValue(mockLogger as any);
  });

  describe("getAllTemplates", () => {
    it("should return all templates grouped by event type", async () => {
      const mockTemplates = [
        {
          _id: "template1",
          name: "Conference Template",
          eventType: "Conference",
          roles: [{ name: "Speaker", maxParticipants: 5 }],
          createdBy: {
            firstName: "John",
            lastName: "Doe",
            username: "johndoe",
            avatar: "avatar1.jpg",
          },
          createdAt: new Date("2024-01-01"),
        },
        {
          _id: "template2",
          name: "Workshop Template",
          eventType: "Workshop",
          roles: [{ name: "Instructor", maxParticipants: 3 }],
          createdBy: {
            firstName: "Jane",
            lastName: "Smith",
            username: "janesmith",
            avatar: "avatar2.jpg",
          },
          createdAt: new Date("2024-01-02"),
        },
        {
          _id: "template3",
          name: "Another Conference Template",
          eventType: "Conference",
          roles: [{ name: "Panelist", maxParticipants: 10 }],
          createdBy: {
            firstName: "Bob",
            lastName: "Wilson",
            username: "bobwilson",
            avatar: "avatar3.jpg",
          },
          createdAt: new Date("2024-01-03"),
        },
      ];

      vi.mocked(RolesTemplate.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockTemplates),
          }),
        }),
      } as any);

      await RolesTemplateController.getAllTemplates(
        mockReq as Request,
        mockRes as Response
      );

      expect(RolesTemplate.find).toHaveBeenCalledWith();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          Conference: [mockTemplates[0], mockTemplates[2]],
          Workshop: [mockTemplates[1]],
        },
      });
    });

    it("should return empty object when no templates exist", async () => {
      vi.mocked(RolesTemplate.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await RolesTemplateController.getAllTemplates(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {},
      });
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database connection failed");

      vi.mocked(RolesTemplate.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockRejectedValue(dbError),
          }),
        }),
      } as any);

      await RolesTemplateController.getAllTemplates(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to fetch role templates",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch role templates",
      });
    });

    it("should handle non-Error exceptions", async () => {
      vi.mocked(RolesTemplate.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockRejectedValue("Unexpected error"),
          }),
        }),
      } as any);

      await RolesTemplateController.getAllTemplates(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch role templates",
      });
    });
  });

  describe("getTemplatesByEventType", () => {
    it("should return templates for specified event type", async () => {
      mockReq.params = { eventType: "Conference" };

      const mockTemplates = [
        {
          _id: "template1",
          name: "Conference Template 1",
          eventType: "Conference",
          roles: [{ name: "Speaker", maxParticipants: 5 }],
          createdBy: {
            firstName: "John",
            lastName: "Doe",
          },
        },
        {
          _id: "template2",
          name: "Conference Template 2",
          eventType: "Conference",
          roles: [{ name: "Panelist", maxParticipants: 10 }],
          createdBy: {
            firstName: "Jane",
            lastName: "Smith",
          },
        },
      ];

      vi.mocked(RolesTemplate.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockTemplates),
          }),
        }),
      } as any);

      await RolesTemplateController.getTemplatesByEventType(
        mockReq as Request,
        mockRes as Response
      );

      expect(RolesTemplate.find).toHaveBeenCalledWith({
        eventType: "Conference",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockTemplates,
      });
    });

    it("should return empty array when no templates for event type", async () => {
      mockReq.params = { eventType: "Webinar" };

      vi.mocked(RolesTemplate.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await RolesTemplateController.getTemplatesByEventType(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it("should handle database errors", async () => {
      mockReq.params = { eventType: "Conference" };
      const dbError = new Error("Query failed");

      vi.mocked(RolesTemplate.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockRejectedValue(dbError),
          }),
        }),
      } as any);

      await RolesTemplateController.getTemplatesByEventType(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to fetch templates by event type",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch templates",
      });
    });
  });

  describe("getTemplateById", () => {
    const validId = new mongoose.Types.ObjectId().toString();

    it("should return template by ID", async () => {
      mockReq.params = { id: validId };

      const mockTemplate = {
        _id: validId,
        name: "Test Template",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
        createdBy: {
          firstName: "John",
          lastName: "Doe",
          username: "johndoe",
        },
      };

      vi.mocked(RolesTemplate.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockTemplate),
        }),
      } as any);

      await RolesTemplateController.getTemplateById(
        mockReq as Request,
        mockRes as Response
      );

      expect(RolesTemplate.findById).toHaveBeenCalledWith(validId);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockTemplate,
      });
    });

    it("should return 400 for invalid ObjectId", async () => {
      mockReq.params = { id: "invalid_id" };

      await RolesTemplateController.getTemplateById(
        mockReq as Request,
        mockRes as Response
      );

      expect(RolesTemplate.findById).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid template ID",
      });
    });

    it("should return 404 when template not found", async () => {
      mockReq.params = { id: validId };

      vi.mocked(RolesTemplate.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      } as any);

      await RolesTemplateController.getTemplateById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Template not found",
      });
    });

    it("should handle database errors", async () => {
      mockReq.params = { id: validId };
      const dbError = new Error("Database error");

      vi.mocked(RolesTemplate.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockRejectedValue(dbError),
        }),
      } as any);

      await RolesTemplateController.getTemplateById(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to fetch template by ID",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch template",
      });
    });
  });

  describe("createTemplate", () => {
    const userId = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("should return 403 if user lacks permissions (Member role)", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      } as any;

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to create role templates",
      });
    });

    it("should allow Super Admin to create template", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "New Template",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
      };

      const mockTemplate: any = {
        _id: "new_template_id",
        name: "New Template",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
        createdBy: userId,
        populate: vi.fn().mockResolvedValue({
          _id: "new_template_id",
          name: "New Template",
          eventType: "Conference",
          roles: [{ name: "Speaker", maxParticipants: 5 }],
          createdBy: {
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            avatar: "avatar.jpg",
          },
        }),
      };

      vi.mocked(RolesTemplate.create).mockResolvedValue(mockTemplate);

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(RolesTemplate.create).toHaveBeenCalledWith({
        name: "New Template",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
        createdBy: userId,
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Role template created successfully",
        data: expect.objectContaining({
          name: "New Template",
          eventType: "Conference",
        }),
      });
    });

    it("should allow Administrator to create template", async () => {
      mockReq.user = {
        _id: userId,
        role: "Administrator",
      } as any;

      mockReq.body = {
        name: "Admin Template",
        eventType: "Workshop",
        roles: [{ name: "Instructor", maxParticipants: 3 }],
      };

      const mockTemplate: any = {
        populate: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(RolesTemplate.create).mockResolvedValue(mockTemplate);

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should allow Leader to create template", async () => {
      mockReq.user = {
        _id: userId,
        role: "Leader",
      } as any;

      mockReq.body = {
        name: "Leader Template",
        eventType: "Webinar",
        roles: [{ name: "Host", maxParticipants: 1 }],
      };

      const mockTemplate: any = {
        populate: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(RolesTemplate.create).mockResolvedValue(mockTemplate);

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should return 400 if name is missing", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Template name is required",
      });
    });

    it("should return 400 if name is empty string", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Template name is required",
      });
    });

    it("should return 400 if name is only whitespace", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "   ",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Template name is required",
      });
    });

    it("should return 400 if eventType is missing", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event type is required",
      });
    });

    it("should return 400 if eventType is empty", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event type is required",
      });
    });

    it("should return 400 if eventType is only whitespace", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "   ",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event type is required",
      });
    });

    it("should return 400 if roles array is missing", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "Conference",
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "At least one role is required",
      });
    });

    it("should return 400 if roles array is empty", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "Conference",
        roles: [],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "At least one role is required",
      });
    });

    it("should return 400 if roles is not an array", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "Conference",
        roles: "invalid",
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "At least one role is required",
      });
    });

    it("should return 400 if role name is missing", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "Conference",
        roles: [{ maxParticipants: 5 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role name is required for all roles",
      });
    });

    it("should return 400 if role name is empty", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "Conference",
        roles: [{ name: "", maxParticipants: 5 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role name is required for all roles",
      });
    });

    it("should return 400 if role name is only whitespace", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "Conference",
        roles: [{ name: "   ", maxParticipants: 5 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role name is required for all roles",
      });
    });

    it("should return 400 if maxParticipants is not a number", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: "invalid" }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role maxParticipants must be a positive number",
      });
    });

    it("should return 400 if maxParticipants is zero", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: 0 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role maxParticipants must be a positive number",
      });
    });

    it("should return 400 if maxParticipants is negative", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: -1 }],
      };

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role maxParticipants must be a positive number",
      });
    });

    it("should trim name and eventType before saving", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "  Trimmed Template  ",
        eventType: "  Conference  ",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
      };

      const mockTemplate: any = {
        populate: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(RolesTemplate.create).mockResolvedValue(mockTemplate);

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(RolesTemplate.create).toHaveBeenCalledWith({
        name: "Trimmed Template",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
        createdBy: userId,
      });
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should create template with multiple roles", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      const roles = [
        { name: "Speaker", maxParticipants: 5 },
        { name: "Moderator", maxParticipants: 2 },
        { name: "Panelist", maxParticipants: 10 },
      ];

      mockReq.body = {
        name: "Multi-Role Template",
        eventType: "Conference",
        roles,
      };

      const mockTemplate: any = {
        populate: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(RolesTemplate.create).mockResolvedValue(mockTemplate);

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(RolesTemplate.create).toHaveBeenCalledWith({
        name: "Multi-Role Template",
        eventType: "Conference",
        roles,
        createdBy: userId,
      });
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle database errors", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;

      mockReq.body = {
        name: "Template Name",
        eventType: "Conference",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
      };

      const dbError = new Error("Database error");
      vi.mocked(RolesTemplate.create).mockRejectedValue(dbError);

      await RolesTemplateController.createTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to create role template",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to create role template",
      });
    });
  });

  describe("updateTemplate", () => {
    const userId = new mongoose.Types.ObjectId();
    const templateId = new mongoose.Types.ObjectId().toString();
    const creatorId = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { id: templateId };

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("should return 400 for invalid template ID", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;
      mockReq.params = { id: "invalid_id" };

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid template ID",
      });
    });

    it("should return 404 if template not found", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;
      mockReq.params = { id: templateId };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(null);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Template not found",
      });
    });

    it("should return 403 if user is not creator and not admin", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      } as any;
      mockReq.params = { id: templateId };

      const mockTemplate = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate as any);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You can only edit templates you created",
      });
    });

    it("should allow template creator to update their template", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        name: "Updated Template",
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
        name: "Old Template",
        roles: [{ name: "Speaker", maxParticipants: 5 }],
        save: vi.fn().mockResolvedValue({}),
        populate: vi.fn().mockResolvedValue({
          _id: templateId,
          name: "Updated Template",
          createdBy: { firstName: "Creator", lastName: "User" },
        }),
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockTemplate.name).toBe("Updated Template");
      expect(mockTemplate.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Role template updated successfully",
        data: expect.objectContaining({
          name: "Updated Template",
        }),
      });
    });

    it("should allow Super Admin to update any template", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        name: "Admin Updated",
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
        name: "Old Template",
        save: vi.fn().mockResolvedValue({}),
        populate: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockTemplate.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should allow Administrator to update any template", async () => {
      mockReq.user = {
        _id: userId,
        role: "Administrator",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        name: "Admin Updated",
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
        name: "Old Template",
        save: vi.fn().mockResolvedValue({}),
        populate: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockTemplate.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should return 400 if name is empty string", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        name: "",
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Template name cannot be empty",
      });
    });

    it("should return 400 if name is only whitespace", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        name: "   ",
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Template name cannot be empty",
      });
    });

    it("should trim name before updating", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        name: "  Trimmed Name  ",
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
        name: "Old Name",
        save: vi.fn().mockResolvedValue({}),
        populate: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockTemplate.name).toBe("Trimmed Name");
      expect(mockTemplate.save).toHaveBeenCalled();
    });

    it("should return 400 if roles array is empty", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        roles: [],
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "At least one role is required",
      });
    });

    it("should return 400 if roles is not an array", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        roles: "invalid",
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "At least one role is required",
      });
    });

    it("should return 400 if role name is missing in roles update", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        roles: [{ maxParticipants: 5 }],
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role name is required for all roles",
      });
    });

    it("should return 400 if role name is empty in roles update", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        roles: [{ name: "", maxParticipants: 5 }],
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role name is required for all roles",
      });
    });

    it("should return 400 if role name is whitespace in roles update", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        roles: [{ name: "   ", maxParticipants: 5 }],
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role name is required for all roles",
      });
    });

    it("should return 400 if maxParticipants is not a number in roles update", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        roles: [{ name: "Speaker", maxParticipants: "invalid" }],
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role maxParticipants must be a positive number",
      });
    });

    it("should return 400 if maxParticipants is zero in roles update", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        roles: [{ name: "Speaker", maxParticipants: 0 }],
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role maxParticipants must be a positive number",
      });
    });

    it("should return 400 if maxParticipants is negative in roles update", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        roles: [{ name: "Speaker", maxParticipants: -1 }],
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role maxParticipants must be a positive number",
      });
    });

    it("should update roles successfully", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };

      const newRoles = [
        { name: "Speaker", maxParticipants: 10 },
        { name: "Moderator", maxParticipants: 2 },
      ];

      mockReq.body = {
        roles: newRoles,
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
        roles: [{ name: "Old Role", maxParticipants: 5 }],
        save: vi.fn().mockResolvedValue({}),
        populate: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockTemplate.roles).toEqual(newRoles);
      expect(mockTemplate.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should update both name and roles together", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };

      const newRoles = [{ name: "Speaker", maxParticipants: 10 }];

      mockReq.body = {
        name: "Updated Name",
        roles: newRoles,
      };

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
        name: "Old Name",
        roles: [{ name: "Old Role", maxParticipants: 5 }],
        save: vi.fn().mockResolvedValue({}),
        populate: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockTemplate.name).toBe("Updated Name");
      expect(mockTemplate.roles).toEqual(newRoles);
      expect(mockTemplate.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle database errors", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };
      mockReq.body = {
        name: "Updated Name",
      };

      const dbError = new Error("Database error");

      const mockTemplate: any = {
        _id: templateId,
        createdBy: creatorId,
        name: "Old Name",
        save: vi.fn().mockRejectedValue(dbError),
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate);

      await RolesTemplateController.updateTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to update role template",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to update role template",
      });
    });
  });

  describe("deleteTemplate", () => {
    const userId = new mongoose.Types.ObjectId();
    const templateId = new mongoose.Types.ObjectId().toString();
    const creatorId = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { id: templateId };

      await RolesTemplateController.deleteTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("should return 400 for invalid template ID", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;
      mockReq.params = { id: "invalid_id" };

      await RolesTemplateController.deleteTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid template ID",
      });
    });

    it("should return 404 if template not found", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;
      mockReq.params = { id: templateId };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(null);

      await RolesTemplateController.deleteTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Template not found",
      });
    });

    it("should return 403 if user is not creator and not admin", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      } as any;
      mockReq.params = { id: templateId };

      const mockTemplate = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate as any);

      await RolesTemplateController.deleteTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You can only delete templates you created",
      });
    });

    it("should allow template creator to delete their template", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };

      const mockTemplate = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate as any);
      vi.mocked(RolesTemplate.findByIdAndDelete).mockResolvedValue({} as any);

      await RolesTemplateController.deleteTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(RolesTemplate.findByIdAndDelete).toHaveBeenCalledWith(templateId);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Role template deleted successfully",
      });
    });

    it("should allow Super Admin to delete any template", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      } as any;
      mockReq.params = { id: templateId };

      const mockTemplate = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate as any);
      vi.mocked(RolesTemplate.findByIdAndDelete).mockResolvedValue({} as any);

      await RolesTemplateController.deleteTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(RolesTemplate.findByIdAndDelete).toHaveBeenCalledWith(templateId);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should allow Administrator to delete any template", async () => {
      mockReq.user = {
        _id: userId,
        role: "Administrator",
      } as any;
      mockReq.params = { id: templateId };

      const mockTemplate = {
        _id: templateId,
        createdBy: creatorId,
      };

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate as any);
      vi.mocked(RolesTemplate.findByIdAndDelete).mockResolvedValue({} as any);

      await RolesTemplateController.deleteTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(RolesTemplate.findByIdAndDelete).toHaveBeenCalledWith(templateId);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle database errors", async () => {
      mockReq.user = {
        _id: creatorId,
        role: "Leader",
      } as any;
      mockReq.params = { id: templateId };

      const mockTemplate = {
        _id: templateId,
        createdBy: creatorId,
      };

      const dbError = new Error("Database error");

      vi.mocked(RolesTemplate.findById).mockResolvedValue(mockTemplate as any);
      vi.mocked(RolesTemplate.findByIdAndDelete).mockRejectedValue(dbError);

      await RolesTemplateController.deleteTemplate(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to delete role template",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to delete role template",
      });
    });
  });
});

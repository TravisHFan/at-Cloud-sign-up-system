import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";

// Simple mock to test if mocking works at all
vi.mock("../../../src/models", () => ({
  Message: Object.assign(vi.fn(), {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
  }),
  User: Object.assign(vi.fn(), {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    }),
  }),
}));

// IMPORTANT: Also mock the direct Message import path used by unifiedMessageController
vi.mock("../../../src/models/Message", () => ({
  default: Object.assign(vi.fn(), {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue([]), // Return array directly, not chained
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
  }),
}));

// Import after mocking
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";
import { Message } from "../../../src/models";
import MessageModel from "../../../src/models/Message";

describe("UnifiedMessageController Simple Test", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: any;
  let jsonMock: any;

  beforeEach(() => {
    statusMock = vi.fn().mockReturnThis();
    jsonMock = vi.fn().mockReturnThis();

    mockRequest = {
      user: {
        id: "user123",
        _id: "user123",
      } as any,
      query: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    } as any;

    vi.clearAllMocks();
  });

  it("should call Message.find when mocked properly", async () => {
    await UnifiedMessageController.getSystemMessages(
      mockRequest as Request,
      mockResponse as Response
    );

    console.log(
      "MessageModel.find calls:",
      (MessageModel.find as any).mock.calls.length
    );
    expect(MessageModel.find).toHaveBeenCalled();
  });
});

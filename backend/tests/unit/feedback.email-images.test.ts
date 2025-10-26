import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { FeedbackController } from "../../src/controllers/feedbackController";
import * as EmailServiceModule from "../../src/services/infrastructure/EmailServiceFacade";

// Minimal mock response helper
const makeRes = () => {
  const res: Partial<Response> = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this as Response;
    },
    json(payload: any) {
      (this as any)._json = payload;
      return this as Response;
    },
  };
  return res as Response & { _json?: any };
};

describe("FeedbackController.submitFeedback - image handling", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SYSTEM_EMAIL = "admin@example.com";
    process.env.SMTP_USER = "admin@example.com";
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("rewrites img src to cid and includes attachments", async () => {
    // Mock global fetch to return a small png buffer
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([["content-type", "image/png"]]),
      arrayBuffer: async () => pngBytes.buffer,
    });
    // @ts-ignore
    global.fetch = mockFetch;

    const sendSpy = vi
      .spyOn(EmailServiceModule.EmailService, "sendGenericNotificationEmail")
      .mockResolvedValue(true);

    const req = {
      body: {
        type: "bug",
        subject: "S1",
        message:
          '<p>Hi</p><img src="/uploads/images/test-1.png"/><img src="http://example.com/img.png"/>',
        includeContact: false,
      },
      user: {
        _id: "u1",
        firstName: "A",
        lastName: "B",
        email: "u@example.com",
        role: "member",
      },
      protocol: "http",
      headers: {},
      get: (h: string) =>
        h.toLowerCase() === "host" ? "localhost:5001" : undefined,
    } as unknown as Request;

    const res = makeRes();

    await FeedbackController.submitFeedback(req, res);

    expect(res.statusCode).toBe(200);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const payload = sendSpy.mock.calls[0][2];
    expect(payload.attachments?.length).toBeGreaterThanOrEqual(1);
    // Ensure message HTML now references cid:
    const html: string = payload.contentHtml;
    expect(html).toMatch(/src=["']cid:/);
    // Ensure relative URL was resolved and fetched
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5001/uploads/images/test-1.png"
    );
  });
});

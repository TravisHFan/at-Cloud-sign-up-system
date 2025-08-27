import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleValidationErrors,
  sanitizeGuestBody,
  sanitizeCancellationBody,
} from "../../../src/middleware/guestValidation";
import { validationResult, body } from "express-validator";

// Minimal mocks for req/res/next
const makeReq = (body: any = {}) => ({ body } as any);
const makeRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const next = vi.fn();

describe("guestValidation shared middlewares", () => {
  beforeEach(() => {
    next.mockClear();
  });

  it("sanitizeGuestBody trims and normalizes case", () => {
    const req = makeReq({
      fullName: "  John Doe  ",
      gender: "FEMALE",
      email: "  USER+tag@Example.COM  ",
      phone: "  +1 (555) 123-4567  ",
      notes: "  hello  ",
    });
    const res = makeRes();
    sanitizeGuestBody(req as any, res as any, next);

    expect(req.body.fullName).toBe("John Doe");
    expect(req.body.gender).toBe("female");
    expect(req.body.email).toBe("user+tag@example.com");
    expect(req.body.phone).toBe("+1 (555) 123-4567");
    expect(req.body.notes).toBe("hello");
    expect(next).toHaveBeenCalled();
  });

  it("sanitizeCancellationBody trims reason when present", () => {
    const req = makeReq({ reason: "  changed mind  " });
    const res = makeRes();
    sanitizeCancellationBody(req as any, res as any, next);
    expect(req.body.reason).toBe("changed mind");
    expect(next).toHaveBeenCalled();
  });

  it("handleValidationErrors forwards when no errors context is present", () => {
    const req = makeReq({});
    const res = makeRes();
    handleValidationErrors(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
  });

  it("handleValidationErrors returns 400 when validator reports errors", async () => {
    // Build a req that fails a simple validation
    const req: any = { body: { email: "not-an-email" } };
    const res = makeRes();

    // Run a real validator on the same req to populate the context
    const validations = [body("email").isEmail().withMessage("invalid")];
    for (const v of validations) {
      await v.run(req);
    }

    handleValidationErrors(req as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Validation failed" })
    );
  });
});

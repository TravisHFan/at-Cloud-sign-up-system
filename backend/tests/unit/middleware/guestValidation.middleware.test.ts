import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleValidationErrors,
  sanitizeGuestBody,
  sanitizeCancellationBody,
  guestUpdateValidation,
  guestCancellationValidation,
  sanitizeGuestInput,
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

  it("sanitizeGuestInput handles edge cases", () => {
    // null/undefined
    expect(sanitizeGuestInput(null)).toEqual({
      fullName: undefined,
      gender: undefined,
      email: undefined,
      phone: undefined,
      notes: undefined,
    });

    // empty notes become undefined
    expect(sanitizeGuestInput({ notes: "   " })).toEqual(
      expect.objectContaining({ notes: undefined })
    );
  });

  it("sanitizeGuestBody handles missing body gracefully", () => {
    const req: any = {};
    const res = makeRes();
    sanitizeGuestBody(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("sanitizeCancellationBody handles non-string reason gracefully", () => {
    const req = makeReq({ reason: 123 });
    const res = makeRes();
    sanitizeCancellationBody(req as any, res as any, next);
    expect(req.body.reason).toBe(123); // unchanged
    expect(next).toHaveBeenCalled();
  });
});

describe("guestUpdateValidation rules", () => {
  it("should pass when all optional fields are valid", async () => {
    const req: any = {
      body: {
        fullName: "John Doe",
        gender: "male",
        phone: "+1 555-123-4567",
        notes: "Some notes here",
      },
    };

    for (const v of guestUpdateValidation) {
      await v.run(req);
    }

    const errors = validationResult(req);
    expect(errors.isEmpty()).toBe(true);
  });

  it("should fail for invalid name format", async () => {
    const req: any = {
      body: {
        fullName: "John123", // Contains numbers
      },
    };

    for (const v of guestUpdateValidation) {
      await v.run(req);
    }

    const errors = validationResult(req);
    expect(errors.isEmpty()).toBe(false);
    expect(errors.array()[0].msg).toContain("letters");
  });

  it("should fail for invalid gender", async () => {
    const req: any = {
      body: {
        gender: "invalid",
      },
    };

    for (const v of guestUpdateValidation) {
      await v.run(req);
    }

    const errors = validationResult(req);
    expect(errors.isEmpty()).toBe(false);
    expect(errors.array()[0].msg).toContain("male");
  });

  it("should fail for phone number too short", async () => {
    const req: any = {
      body: {
        phone: "123",
      },
    };

    for (const v of guestUpdateValidation) {
      await v.run(req);
    }

    const errors = validationResult(req);
    expect(errors.isEmpty()).toBe(false);
    expect(errors.array()[0].msg).toContain("10 and 20");
  });

  it("should fail for notes exceeding 500 characters", async () => {
    const req: any = {
      body: {
        notes: "x".repeat(501),
      },
    };

    for (const v of guestUpdateValidation) {
      await v.run(req);
    }

    const errors = validationResult(req);
    expect(errors.isEmpty()).toBe(false);
    expect(errors.array()[0].msg).toContain("500");
  });
});

describe("guestCancellationValidation rules", () => {
  it("should pass when reason is valid", async () => {
    const req: any = {
      body: {
        reason: "I can no longer attend",
      },
    };

    for (const v of guestCancellationValidation) {
      await v.run(req);
    }

    const errors = validationResult(req);
    expect(errors.isEmpty()).toBe(true);
  });

  it("should pass when reason is omitted", async () => {
    const req: any = { body: {} };

    for (const v of guestCancellationValidation) {
      await v.run(req);
    }

    const errors = validationResult(req);
    expect(errors.isEmpty()).toBe(true);
  });

  it("should fail for reason exceeding 500 characters", async () => {
    const req: any = {
      body: {
        reason: "x".repeat(501),
      },
    };

    for (const v of guestCancellationValidation) {
      await v.run(req);
    }

    const errors = validationResult(req);
    expect(errors.isEmpty()).toBe(false);
    expect(errors.array()[0].msg).toContain("500");
  });
});

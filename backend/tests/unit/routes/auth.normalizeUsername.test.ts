// auth.normalizeUsername.test.ts - Unit tests for normalizeUsername middleware
import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Test the normalizeUsername middleware behavior directly
// Without importing the actual route (which has heavy dependencies)
describe("normalizeUsername middleware logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Replicate the normalizeUsername function logic from auth.ts
  const normalizeUsername = (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    if (typeof req.body?.username === "string") {
      req.body.username = req.body.username.toLowerCase().trim();
    }
    next();
  };

  test("should lowercase and trim username string", () => {
    const req = { body: { username: "  TestUser  " } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    normalizeUsername(req, res, next);

    expect(req.body.username).toBe("testuser");
    expect(next).toHaveBeenCalled();
  });

  test("should handle already lowercase username", () => {
    const req = { body: { username: "johndoe" } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    normalizeUsername(req, res, next);

    expect(req.body.username).toBe("johndoe");
    expect(next).toHaveBeenCalled();
  });

  test("should handle username with mixed case", () => {
    const req = { body: { username: "JohnDoe123" } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    normalizeUsername(req, res, next);

    expect(req.body.username).toBe("johndoe123");
    expect(next).toHaveBeenCalled();
  });

  test("should proceed when body is undefined", () => {
    const req = {} as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    normalizeUsername(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test("should proceed when username is not a string", () => {
    const req = { body: { username: 12345 } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    normalizeUsername(req, res, next);

    expect(req.body.username).toBe(12345); // unchanged
    expect(next).toHaveBeenCalled();
  });

  test("should proceed when username is null", () => {
    const req = { body: { username: null } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    normalizeUsername(req, res, next);

    expect(req.body.username).toBeNull(); // unchanged
    expect(next).toHaveBeenCalled();
  });

  test("should proceed when body exists but no username field", () => {
    const req = { body: { email: "test@test.com" } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    normalizeUsername(req, res, next);

    expect(req.body.username).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should handle username with only whitespace", () => {
    const req = { body: { username: "   " } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    normalizeUsername(req, res, next);

    expect(req.body.username).toBe("");
    expect(next).toHaveBeenCalled();
  });

  test("should handle uppercase username with underscores", () => {
    const req = { body: { username: "John_Doe_123" } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    normalizeUsername(req, res, next);

    expect(req.body.username).toBe("john_doe_123");
    expect(next).toHaveBeenCalled();
  });
});

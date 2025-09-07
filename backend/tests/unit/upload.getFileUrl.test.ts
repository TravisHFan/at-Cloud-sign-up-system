import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import { getFileUrl } from "../../src/middleware/upload";

describe("getFileUrl", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    jestResetEnv();
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  function jestResetEnv() {
    for (const k of Object.keys(process.env)) {
      if (k === "NODE_ENV") continue; // keep test env
      delete (process.env as any)[k];
    }
  }

  const makeReq = (opts?: { proto?: string; host?: string }): Request => {
    const protocol = opts?.proto || "http";
    const host = opts?.host || "localhost:5001";
    return {
      protocol,
      headers: {},
      get: (h: string) => (h.toLowerCase() === "host" ? host : undefined),
    } as unknown as Request;
  };

  it("uses BACKEND_URL when set (absolute option)", () => {
    process.env.BACKEND_URL = "https://api.example.com";
    const req = makeReq({ proto: "http", host: "dev.local:5001" });
    const url = getFileUrl(req, "avatars/avatar-123.png", { absolute: true });
    expect(url).toBe("https://api.example.com/uploads/avatars/avatar-123.png");
  });

  it("falls back to request proto+host when BACKEND_URL not set (absolute option)", () => {
    delete process.env.BACKEND_URL;
    const req = makeReq({ proto: "http", host: "dev.local:5001" });
    const url = getFileUrl(req, "images/img-1.jpg", { absolute: true });
    expect(url).toBe("http://dev.local:5001/uploads/images/img-1.jpg");
  });
});

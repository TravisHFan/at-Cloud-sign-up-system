import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  DEFAULT_BACKEND_ORIGINS,
  getBackendOrigins,
} from "./contentSecurityPolicy";

describe("content security policy", () => {
  it("allows the configured API origin for fetches and images", () => {
    const policy = buildContentSecurityPolicy("https://api.example.com/api");

    expect(policy).toContain("connect-src");
    expect(policy).toContain("img-src");
    expect(policy).toContain("https://api.example.com");
    expect(policy).not.toContain("https://api.example.com/api");
  });

  it("keeps known Render backend origins in the allow-list", () => {
    const origins = getBackendOrigins("https://api.example.com/api");

    DEFAULT_BACKEND_ORIGINS.forEach((origin) => {
      expect(origins).toContain(origin);
    });
  });
});

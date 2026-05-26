import { describe, expect, it } from "vitest";
import {
  getApiOrigin,
  resolveApiBaseURL,
  resolveSocketURL,
  sanitizeBaseURL,
} from "./apiUrl";

describe("api URL configuration", () => {
  it("normalizes configured Render hosts into API URLs", () => {
    expect(resolveApiBaseURL("atcloud-erp-backend-staging.onrender.com")).toBe(
      "https://atcloud-erp-backend-staging.onrender.com/api",
    );
  });

  it("preserves explicit local HTTP API URLs", () => {
    expect(sanitizeBaseURL("http://localhost:5001/api/")).toBe(
      "http://localhost:5001/api",
    );
  });

  it("normalizes legacy API path variants", () => {
    expect(sanitizeBaseURL("https://example.com/api/v1")).toBe(
      "https://example.com/api",
    );
    expect(sanitizeBaseURL("https://example.com/api/api")).toBe(
      "https://example.com/api",
    );
  });

  it("derives socket origins from API URLs", () => {
    expect(getApiOrigin("https://example.com/api")).toBe("https://example.com");
    expect(resolveSocketURL("https://example.com/api")).toBe(
      "https://example.com",
    );
  });

  it("lets explicit socket URLs override the API URL", () => {
    expect(
      resolveSocketURL("https://api.example.com/api", "socket.example.com"),
    ).toBe("https://socket.example.com");
  });
});

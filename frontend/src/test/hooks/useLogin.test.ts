import { describe, it, expect } from "vitest";
import { buildLoginFailureBaseMessage } from "../../hooks/useLogin";

describe("buildLoginFailureBaseMessage", () => {
  it("returns email specific message when input is email and no backend error", () => {
    expect(buildLoginFailureBaseMessage(true)).toBe(
      "Invalid email or password"
    );
  });

  it("returns username specific message when input is username-like and no backend error", () => {
    expect(buildLoginFailureBaseMessage(false)).toBe(
      "Invalid username or password"
    );
  });

  it("overrides generic backend 'Invalid' error with email message", () => {
    expect(
      buildLoginFailureBaseMessage(true, "Invalid credentials provided")
    ).toBe("Invalid email or password");
  });

  it("keeps non-'Invalid' backend error verbatim (email input)", () => {
    expect(buildLoginFailureBaseMessage(true, "Account locked")).toBe(
      "Account locked"
    );
  });

  it("keeps non-'Invalid' backend error verbatim (username input)", () => {
    expect(buildLoginFailureBaseMessage(false, "Account locked")).toBe(
      "Account locked"
    );
  });
});

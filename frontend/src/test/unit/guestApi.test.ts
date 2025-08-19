import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/api", () => {
  return {
    apiClient: {
      guestSignup: vi.fn(),
      getEventGuests: vi.fn(),
    },
  };
});

import { apiClient } from "../../services/api";
import { GuestApi } from "../../services/guestApi";

describe("GuestApi", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls POST /events/:id/guest-signup with payload", async () => {
    (apiClient.guestSignup as any).mockResolvedValue({
      registrationId: "abc123",
    });

    const data = await GuestApi.signup("evt1", {
      roleId: "r1",
      fullName: "Jane Guest",
      gender: "female",
      email: "jane@example.com",
    });

    expect(apiClient.guestSignup).toHaveBeenCalledWith(
      "evt1",
      expect.any(Object)
    );
    expect(data).toEqual({ registrationId: "abc123" });
  });

  it("fetches event guests", async () => {
    (apiClient.getEventGuests as any).mockResolvedValue({
      guests: [{ id: "g1" }],
    });

    const data = await GuestApi.getEventGuests("evt2");

    expect(apiClient.getEventGuests).toHaveBeenCalledWith("evt2");
    expect(data).toEqual({ guests: [{ id: "g1" }] });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUserData } from "../../hooks/useUserData";

const getUsersMock = vi.fn();

vi.mock("../../services/api", async () => {
  const mod = await import("../../services/api");
  return {
    ...mod,
    userService: {
      ...mod.userService,
      getUsers: (...args: any[]) => getUsersMock(...args),
    },
  };
});

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({ success: vi.fn(), error: vi.fn() }),
}));

describe("useUserData fetchAll", () => {
  beforeEach(() => {
    getUsersMock.mockReset();
  });

  it("aggregates users from all pages", async () => {
    const makeUser = (i: number) => ({
      id: `u${i}`,
      username: `user${i}`,
      email: `u${i}@ex.com`,
      role: "Participant",
      firstName: "F",
      lastName: String(i),
      isActive: true,
    });

    const page1 = Array.from({ length: 10 }, (_, i) => makeUser(i + 1));
    const page2 = Array.from({ length: 7 }, (_, i) => makeUser(i + 11));

    getUsersMock.mockImplementation(async ({ page }: any) => {
      if (!page || page === 1) {
        return {
          users: page1,
          pagination: {
            currentPage: 1,
            totalPages: 2,
            totalUsers: 17,
            hasNext: true,
            hasPrev: false,
          },
        };
      }
      return {
        users: page2,
        pagination: {
          currentPage: 2,
          totalPages: 2,
          totalUsers: 17,
          hasNext: false,
          hasPrev: true,
        },
      };
    });

    const { result } = renderHook(() =>
      useUserData({ fetchAll: true, limit: 10 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.users.length).toBe(17);
  });
});

/**
 * MyPromoCodes Page Tests
 *
 * Tests user promo code listing, filtering, search, and display functionality
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

// Mock Auth Context
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "user1",
      role: "Participant",
      firstName: "Test",
      lastName: "User",
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

describe("MyPromoCodes Page", () => {
  const mockActiveCodes = [
    {
      _id: "code1",
      code: "BUNDLE01",
      type: "bundle_discount" as const,
      discountAmount: 5000, // $50
      isUsed: false,
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      _id: "code2",
      code: "STAFF100",
      type: "staff_access" as const,
      discountPercent: 100,
      isUsed: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];

  const mockUsedCode = {
    _id: "code3",
    code: "USED1234",
    type: "bundle_discount" as const,
    discountAmount: 3000,
    isUsed: true,
    isActive: true,
    usedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  const mockExpiredCode = {
    _id: "code4",
    code: "EXPIRED1",
    type: "bundle_discount" as const,
    discountAmount: 2000,
    isUsed: false,
    isActive: true,
    expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Loading", () => {
    it("shows loading state initially", async () => {
      const mockGetMyCodes = vi.fn(
        () => new Promise(() => {}) // Never resolves
      );

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("fetches and displays promo codes", async () => {
      const mockGetMyCodes = vi
        .fn()
        .mockResolvedValue([...mockActiveCodes, mockUsedCode, mockExpiredCode]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("BUNDLE01")).toBeInTheDocument();
      });

      expect(screen.getByText("STAFF100")).toBeInTheDocument();
      expect(screen.getByText("USED1234")).toBeInTheDocument();
      expect(screen.getByText("EXPIRED1")).toBeInTheDocument();
    });
  });

  describe("Empty States", () => {
    it("shows empty state when user has no codes", async () => {
      const mockGetMyCodes = vi.fn().mockResolvedValue([]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByText(/no promo codes|you don't have any promo codes/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Filtering", () => {
    it("filters to show only active codes", async () => {
      const user = userEvent.setup();
      const mockGetMyCodes = vi
        .fn()
        .mockResolvedValue([...mockActiveCodes, mockUsedCode, mockExpiredCode]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      // Wait for codes to load
      await waitFor(() => {
        expect(screen.getByText("BUNDLE01")).toBeInTheDocument();
      });

      // Click active filter
      const activeButton = screen.getByRole("button", {
        name: /active/i,
      });
      await user.click(activeButton);

      // Should show active codes
      expect(screen.getByText("BUNDLE01")).toBeInTheDocument();
      expect(screen.getByText("STAFF100")).toBeInTheDocument();

      // Should not show used or expired
      expect(screen.queryByText("USED1234")).not.toBeInTheDocument();
      expect(screen.queryByText("EXPIRED1")).not.toBeInTheDocument();
    });

    it("filters to show only used codes", async () => {
      const user = userEvent.setup();
      const mockGetMyCodes = vi
        .fn()
        .mockResolvedValue([...mockActiveCodes, mockUsedCode, mockExpiredCode]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("USED1234")).toBeInTheDocument();
      });

      const usedButton = screen.getByRole("button", {
        name: /used/i,
      });
      await user.click(usedButton);

      // Should only show used code
      expect(screen.getByText("USED1234")).toBeInTheDocument();
      expect(screen.queryByText("BUNDLE01")).not.toBeInTheDocument();
      expect(screen.queryByText("STAFF100")).not.toBeInTheDocument();
      expect(screen.queryByText("EXPIRED1")).not.toBeInTheDocument();
    });

    it("filters to show only expired codes", async () => {
      const user = userEvent.setup();
      const mockGetMyCodes = vi
        .fn()
        .mockResolvedValue([...mockActiveCodes, mockUsedCode, mockExpiredCode]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("EXPIRED1")).toBeInTheDocument();
      });

      const expiredButton = screen.getByRole("button", {
        name: /expired/i,
      });
      await user.click(expiredButton);

      // Should only show expired code
      expect(screen.getByText("EXPIRED1")).toBeInTheDocument();
      expect(screen.queryByText("BUNDLE01")).not.toBeInTheDocument();
      expect(screen.queryByText("STAFF100")).not.toBeInTheDocument();
      expect(screen.queryByText("USED1234")).not.toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("filters codes by search query", async () => {
      const user = userEvent.setup();
      const mockGetMyCodes = vi
        .fn()
        .mockResolvedValue([...mockActiveCodes, mockUsedCode, mockExpiredCode]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("BUNDLE01")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "BUNDLE");

      // Should only show codes matching "BUNDLE"
      await waitFor(() => {
        expect(screen.getByText("BUNDLE01")).toBeInTheDocument();
        expect(screen.queryByText("STAFF100")).not.toBeInTheDocument();
      });
    });

    it("search is case-insensitive", async () => {
      const user = userEvent.setup();
      const mockGetMyCodes = vi.fn().mockResolvedValue([mockActiveCodes[0]]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("BUNDLE01")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "bundle");

      await waitFor(() => {
        expect(screen.getByText("BUNDLE01")).toBeInTheDocument();
      });
    });
  });

  describe("Code Display", () => {
    it("displays bundle discount codes correctly", async () => {
      const mockGetMyCodes = vi.fn().mockResolvedValue([mockActiveCodes[0]]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("BUNDLE01")).toBeInTheDocument();
      });

      // Should show discount amount
      expect(screen.getByText(/\$50/i)).toBeInTheDocument();
    });

    it("displays staff access codes correctly", async () => {
      const mockGetMyCodes = vi.fn().mockResolvedValue([mockActiveCodes[1]]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("STAFF100")).toBeInTheDocument();
      });

      // Should show percentage
      expect(screen.getByText(/100%/i)).toBeInTheDocument();
    });

    it("shows used status for used codes", async () => {
      const mockGetMyCodes = vi.fn().mockResolvedValue([mockUsedCode]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("USED1234")).toBeInTheDocument();
      });

      expect(screen.getByText(/used/i)).toBeInTheDocument();
    });

    it("shows expiration date for codes with expiry", async () => {
      const mockGetMyCodes = vi.fn().mockResolvedValue([mockActiveCodes[0]]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("BUNDLE01")).toBeInTheDocument();
      });

      // Should show expiration date or "expires"
      expect(screen.getByText(/expires|expiration/i)).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      const mockGetMyCodes = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should show empty state or error
        expect(
          screen.getByText(/no promo codes|error|failed/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Filter Counts", () => {
    it("displays correct counts for each filter", async () => {
      const mockGetMyCodes = vi
        .fn()
        .mockResolvedValue([...mockActiveCodes, mockUsedCode, mockExpiredCode]);

      vi.doMock("../../services/promoCodeService", () => ({
        promoCodeService: {
          getMyPromoCodes: mockGetMyCodes,
        },
      }));

      const { default: MyPromoCodes } = await import(
        "../../pages/MyPromoCodes"
      );

      render(
        <MemoryRouter>
          <MyPromoCodes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("BUNDLE01")).toBeInTheDocument();
      });

      // Should show counts in filter buttons
      // All: 4, Active: 2, Used: 1, Expired: 1
      const allButton = screen.getByRole("button", { name: /all.*4/i });
      const activeButton = screen.getByRole("button", { name: /active.*2/i });
      const usedButton = screen.getByRole("button", { name: /used.*1/i });
      const expiredButton = screen.getByRole("button", { name: /expired.*1/i });

      expect(allButton).toBeInTheDocument();
      expect(activeButton).toBeInTheDocument();
      expect(usedButton).toBeInTheDocument();
      expect(expiredButton).toBeInTheDocument();
    });
  });
});

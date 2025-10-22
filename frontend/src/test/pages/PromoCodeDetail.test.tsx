import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import PromoCodeDetail from "../../pages/PromoCodeDetail";
import * as api from "../../services/api";

/**
 * PromoCodeDetail Page - Component Tests
 *
 * Tests the PromoCodeDetail page component:
 * - Loading states
 * - Error handling
 * - General vs Personal code display
 * - Usage history table rendering
 * - Empty states
 * - Navigation
 */

// Mock API client
vi.mock("../../services/api");

// Mock useParams from react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: () => mockNavigate,
  };
});

describe("PromoCodeDetail Page - Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  describe("Loading state", () => {
    it("displays loading spinner while fetching data", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      render(<PromoCodeDetail />);

      // Should show loading spinner initially (check for SVG with animate-spin class)
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ERROR STATES
  // ============================================================================

  describe("Error handling", () => {
    it("displays error message when API call fails", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      const errorMessage = "Failed to load promo code data";
      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockRejectedValue(
        new Error(errorMessage)
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Should show back button
      const backButton = screen.getByRole("button", {
        name: /back to promo codes/i,
      });
      expect(backButton).toBeInTheDocument();
    });

    it("displays 'Code not found' when no data returned", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        null as any
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/code not found/i)).toBeInTheDocument();
      });
    });

    it("handles missing code ID in URL params", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({}); // No id

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      // Should not call API without ID
      expect(api.apiClient.getPromoCodeUsageHistory).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // GENERAL CODE DISPLAY
  // ============================================================================

  describe("General code display", () => {
    it("displays general code details correctly", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      const mockGeneralCode = {
        code: "GENERAL1",
        type: "staff_access",
        isGeneral: true,
        description: "General Staff Access 2025",
        usageHistory: [
          {
            userId: "user1",
            userName: "John Doe",
            userEmail: "john@example.com",
            usedAt: "2025-01-15T10:00:00Z",
            programId: "prog1",
            programTitle: "Test Program 1",
          },
          {
            userId: "user2",
            userName: "Jane Smith",
            userEmail: "jane@example.com",
            usedAt: "2025-01-16T14:30:00Z",
            programId: "prog2",
            programTitle: "Test Program 2",
          },
        ],
        usageCount: 2,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockGeneralCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Title
        expect(screen.getByText(/Promo Code: GENERAL1/i)).toBeInTheDocument();

        // Subtitle
        expect(
          screen.getByText(/General Staff Code - Usage History/i)
        ).toBeInTheDocument();

        // General Staff badge - "General Staff" appears in multiple places (subtitle, badge, description)
        const generalStaffElements = screen.getAllByText(/General Staff/i);
        expect(generalStaffElements.length).toBeGreaterThan(0);

        // Description
        expect(
          screen.getByText("General Staff Access 2025")
        ).toBeInTheDocument();

        // Usage history table
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("john@example.com")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
        expect(screen.getByText("jane@example.com")).toBeInTheDocument();
        expect(screen.getByText("Test Program 1")).toBeInTheDocument();
        expect(screen.getByText("Test Program 2")).toBeInTheDocument();
      });
    });

    it("displays usage count for general code", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      const mockGeneralCode = {
        code: "GENERAL2",
        type: "staff_access",
        isGeneral: true,
        description: "Test Code",
        usageHistory: [
          {
            userId: "user1",
            userName: "User One",
            userEmail: "user1@example.com",
            usedAt: "2025-01-15T10:00:00Z",
          },
          {
            userId: "user2",
            userName: "User Two",
            userEmail: "user2@example.com",
            usedAt: "2025-01-16T10:00:00Z",
          },
          {
            userId: "user3",
            userName: "User Three",
            userEmail: "user3@example.com",
            usedAt: "2025-01-17T10:00:00Z",
          },
        ],
        usageCount: 3,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockGeneralCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Should show usage count in "Total Uses" field
        expect(screen.getByText(/Total Uses/i)).toBeInTheDocument();
        const usageCountElements = screen.getAllByText("3");
        expect(usageCountElements.length).toBeGreaterThan(0);
      });
    });

    it("displays empty state for general code with no usage", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      const mockGeneralCode = {
        code: "GENERAL3",
        type: "staff_access",
        isGeneral: true,
        description: "Unused Code",
        usageHistory: [],
        usageCount: 0,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockGeneralCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByText(/This code has not been used yet/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // PERSONAL CODE DISPLAY
  // ============================================================================

  describe("Personal code display", () => {
    it("displays personal code details correctly", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code456" });

      const mockPersonalCode = {
        code: "PERSONAL",
        type: "staff_access",
        isGeneral: false,
        usageHistory: [],
        usageCount: 0,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockPersonalCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Title
        expect(screen.getByText(/Promo Code: PERSONAL/i)).toBeInTheDocument();

        // Subtitle for personal code
        expect(screen.getByText(/Personal Staff Code/i)).toBeInTheDocument();

        // Personal Staff badge - use getAllByText since it appears in multiple places
        const badges = screen.getAllByText(/Personal Staff/i);
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it("does not display usage history table for personal codes", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code456" });

      const mockPersonalCode = {
        code: "PERSONAL2",
        type: "staff_access",
        isGeneral: false,
        usageHistory: [],
        usageCount: 0,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockPersonalCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Should show Personal Staff badge
        const badges = screen.getAllByText(/Personal Staff/i);
        expect(badges.length).toBeGreaterThan(0);

        // Should NOT show Usage History section for personal codes
        expect(screen.queryByText(/Usage History/i)).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // USAGE HISTORY TABLE
  // ============================================================================

  describe("Usage history table", () => {
    it("renders all usage history entries", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code789" });

      const mockCode = {
        code: "GENERAL4",
        type: "staff_access",
        isGeneral: true,
        description: "Test",
        usageHistory: [
          {
            userId: "user1",
            userName: "Alice Johnson",
            userEmail: "alice@example.com",
            usedAt: "2025-01-15T10:00:00Z",
            programId: "prog1",
            programTitle: "Workshop A",
          },
          {
            userId: "user2",
            userName: "Bob Williams",
            userEmail: "bob@example.com",
            usedAt: "2025-01-16T11:00:00Z",
            programId: "prog2",
            programTitle: "Workshop B",
          },
          {
            userId: "user3",
            userName: "Charlie Brown",
            userEmail: "charlie@example.com",
            usedAt: "2025-01-17T12:00:00Z",
            programId: "prog3",
            programTitle: "Workshop C",
          },
        ],
        usageCount: 3,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Table headers
        expect(screen.getByText(/User/i)).toBeInTheDocument();
        expect(screen.getByText(/Email/i)).toBeInTheDocument();
        expect(screen.getByText(/Program/i)).toBeInTheDocument();
        // The actual header text is "Used", not "Used At"
        expect(screen.getByText(/^Used$/i)).toBeInTheDocument();

        // All users
        expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
        expect(screen.getByText("Bob Williams")).toBeInTheDocument();
        expect(screen.getByText("Charlie Brown")).toBeInTheDocument();

        // All emails
        expect(screen.getByText("alice@example.com")).toBeInTheDocument();
        expect(screen.getByText("bob@example.com")).toBeInTheDocument();
        expect(screen.getByText("charlie@example.com")).toBeInTheDocument();

        // All programs
        expect(screen.getByText("Workshop A")).toBeInTheDocument();
        expect(screen.getByText("Workshop B")).toBeInTheDocument();
        expect(screen.getByText("Workshop C")).toBeInTheDocument();
      });
    });

    it("handles missing program information gracefully", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code789" });

      const mockCode = {
        code: "GENERAL5",
        type: "staff_access",
        isGeneral: true,
        description: "Test",
        usageHistory: [
          {
            userId: "user1",
            userName: "Test User",
            userEmail: "test@example.com",
            usedAt: "2025-01-15T10:00:00Z",
            // No programId or programTitle
          },
        ],
        usageCount: 1,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
        expect(screen.getByText("test@example.com")).toBeInTheDocument();
        // Should show placeholder or N/A for missing program
      });
    });

    it("formats dates relative to now", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code789" });

      // Create a date 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const mockCode = {
        code: "GENERAL6",
        type: "staff_access",
        isGeneral: true,
        description: "Test",
        usageHistory: [
          {
            userId: "user1",
            userName: "Test User",
            userEmail: "test@example.com",
            usedAt: twoDaysAgo.toISOString(),
            programTitle: "Test Program",
          },
        ],
        usageCount: 1,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Should show relative time like "2 days ago"
        expect(screen.getByText(/days ago/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  describe("Navigation", () => {
    it("navigates back when back button is clicked", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      const mockCode = {
        code: "GENERAL7",
        type: "staff_access",
        isGeneral: true,
        description: "Test",
        usageHistory: [],
        usageCount: 0,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Promo Code: GENERAL7/i)).toBeInTheDocument();
      });

      // Find and click back arrow button
      const backButtons = screen.getAllByRole("button");
      const backArrowButton = backButtons[0]; // First button is the arrow

      backArrowButton.click();

      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/promo-codes");
    });

    it("navigates back from error state", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockRejectedValue(
        new Error("Not found")
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Not found/i)).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", {
        name: /back to promo codes/i,
      });
      backButton.click();

      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/promo-codes");
    });
  });

  // ============================================================================
  // API INTEGRATION
  // ============================================================================

  describe("API integration", () => {
    it("calls API with correct code ID", async () => {
      const { useParams } = await import("react-router-dom");
      const codeId = "abc123def456";
      vi.mocked(useParams).mockReturnValue({ id: codeId });

      const mockCode = {
        code: "TESTCODE",
        type: "staff_access",
        isGeneral: true,
        description: "Test",
        usageHistory: [],
        usageCount: 0,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.apiClient.getPromoCodeUsageHistory).toHaveBeenCalledWith(
          codeId
        );
      });
    });

    it("handles network errors gracefully", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockRejectedValue(
        new Error("Network error")
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge cases", () => {
    it("handles very long code names", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      const mockCode = {
        code: "VERYLONGCODENAME12345",
        type: "staff_access",
        isGeneral: true,
        description: "Test",
        usageHistory: [],
        usageCount: 0,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/VERYLONGCODENAME12345/i)).toBeInTheDocument();
      });
    });

    it("handles very long descriptions", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      const longDescription =
        "This is a very long description that goes on and on and might wrap to multiple lines in the UI and we want to make sure it displays correctly without breaking the layout.";

      const mockCode = {
        code: "GENERAL8",
        type: "staff_access",
        isGeneral: true,
        description: longDescription,
        usageHistory: [],
        usageCount: 0,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(longDescription)).toBeInTheDocument();
      });
    });

    it("handles large usage history (100+ entries)", async () => {
      const { useParams } = await import("react-router-dom");
      vi.mocked(useParams).mockReturnValue({ id: "code123" });

      // Generate 150 usage entries
      const usageHistory = Array.from({ length: 150 }, (_, i) => ({
        userId: `user${i}`,
        userName: `User ${i}`,
        userEmail: `user${i}@example.com`,
        usedAt: new Date(2025, 0, 1 + i).toISOString(),
        programTitle: `Program ${i}`,
      }));

      const mockCode = {
        code: "POPULAR1",
        type: "staff_access",
        isGeneral: true,
        description: "Popular Code",
        usageHistory,
        usageCount: 150,
      };

      vi.mocked(api.apiClient.getPromoCodeUsageHistory).mockResolvedValue(
        mockCode
      );

      render(
        <BrowserRouter>
          <PromoCodeDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/150/)).toBeInTheDocument();
        // Should render all entries (or implement pagination if needed)
        expect(screen.getByText("User 0")).toBeInTheDocument();
        expect(screen.getByText("User 149")).toBeInTheDocument();
      });
    });
  });
});

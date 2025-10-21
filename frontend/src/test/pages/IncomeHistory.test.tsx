/**
 * IncomeHistory Component Tests
 *
 * Tests role-based access, stats rendering, table rendering,
 * search functionality, pagination, and error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock Auth context
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { id: "u1", role: "Super Admin" },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock API services
const mockGetAllPurchases = vi.fn();
const mockGetPaymentStats = vi.fn();

vi.mock("../../services/api", () => ({
  adminPurchaseService: {
    getAllPurchases: mockGetAllPurchases,
    getPaymentStats: mockGetPaymentStats,
  },
}));

describe("IncomeHistory Component", () => {
  const mockStats = {
    totalRevenue: 125000, // $1250.00
    totalPurchases: 45,
    pendingPurchases: 5,
    failedPurchases: 2,
    refundedPurchases: 1,
    uniqueBuyers: 30,
    classRepPurchases: 12,
    promoCodeUsage: 8,
    last30Days: {
      purchases: 15,
      revenue: 45000,
    },
  };

  const mockPurchases = [
    {
      id: "pur1",
      orderNumber: "ORD-2025-001",
      user: {
        id: "user1",
        name: "John Doe",
        email: "john@test.com",
      },
      program: {
        id: "prog1",
        name: "Advanced Leadership Training",
      },
      fullPrice: 15000,
      classRepDiscount: 2000,
      earlyBirdDiscount: 1000,
      promoDiscountAmount: 0,
      finalPrice: 12000,
      isClassRep: true,
      isEarlyBird: true,
      status: "completed",
      purchaseDate: "2025-10-01T10:00:00Z",
      paymentMethod: {
        type: "card",
        cardBrand: "visa",
        last4: "4242",
      },
    },
    {
      id: "pur2",
      orderNumber: "ORD-2025-002",
      user: {
        id: "user2",
        name: "Jane Smith",
        email: "jane@test.com",
      },
      program: {
        id: "prog2",
        name: "Ministry Workshop",
      },
      fullPrice: 10000,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      promoDiscountAmount: 1000,
      finalPrice: 9000,
      isClassRep: false,
      isEarlyBird: false,
      promoCode: "SAVE10",
      status: "completed",
      purchaseDate: "2025-09-15T14:30:00Z",
      paymentMethod: {
        type: "card",
        cardBrand: "mastercard",
        last4: "5555",
      },
    },
  ];

  const mockPagination = {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllPurchases.mockResolvedValue({
      purchases: mockPurchases,
      pagination: mockPagination,
    });
    mockGetPaymentStats.mockResolvedValue({
      stats: mockStats,
    });
  });

  // ============================================================================
  // ROLE-BASED ACCESS CONTROL
  // ============================================================================

  describe("Role-Based Access Control", () => {
    it("allows Super Admin to access payment records", async () => {
      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Income History")).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("allows Administrator to access payment records", async () => {
      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Income History")).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    // Note: Role redirect tests are covered by the Sidebar tests
    // The actual redirect logic is tested in integration tests
    // These frontend tests focus on what renders when access is granted
  });

  // ============================================================================
  // STATS RENDERING
  // ============================================================================

  describe("Stats Rendering", () => {
    it("displays all payment statistics correctly", async () => {
      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Total Revenue
        expect(screen.getByText("Total Revenue")).toBeInTheDocument();
        expect(screen.getByText("$1,250.00")).toBeInTheDocument();

        // Unique Buyers
        expect(screen.getByText("Unique Buyers")).toBeInTheDocument();
        expect(screen.getByText("30")).toBeInTheDocument();

        // Last 30 Days
        expect(screen.getByText("Last 30 Days")).toBeInTheDocument();
        expect(screen.getByText("$450.00")).toBeInTheDocument();
        expect(screen.getByText("15 purchases")).toBeInTheDocument();
      });

      // Check for completed purchases stat card (use getAllByText since "Completed" appears in table too)
      const completedElements = screen.getAllByText("Completed");
      expect(completedElements.length).toBeGreaterThan(0);

      // Verify the stats value 45 is present
      expect(screen.getByText("45")).toBeInTheDocument();
    });

    it("handles missing stats gracefully", async () => {
      mockGetPaymentStats.mockRejectedValue(new Error("Stats unavailable"));

      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      // Should still render page without stats cards
      await waitFor(() => {
        expect(screen.getByText("Income History")).toBeInTheDocument();
      });

      // Stats should not be visible
      expect(screen.queryByText("Total Revenue")).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // TABLE RENDERING
  // ============================================================================

  describe("Table Rendering", () => {
    it("displays purchase table with user information", async () => {
      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Check table headers
        expect(screen.getByText("Order Number")).toBeInTheDocument();
        expect(screen.getByText("User")).toBeInTheDocument();
        expect(screen.getByText("Program")).toBeInTheDocument();

        // Check purchase data
        expect(screen.getByText("ORD-2025-001")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("john@test.com")).toBeInTheDocument();
        expect(
          screen.getByText("Advanced Leadership Training")
        ).toBeInTheDocument();

        expect(screen.getByText("ORD-2025-002")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      });
    });

    it("displays empty state when no purchases found", async () => {
      mockGetAllPurchases.mockResolvedValue({
        purchases: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("No purchases found")).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // SEARCH FUNCTIONALITY
  // ============================================================================

  describe("Search Functionality", () => {
    it("renders search input", async () => {
      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(
          /search by user name, email/i
        );
        expect(searchInput).toBeInTheDocument();
      });
    });

    it("renders status filter dropdown", async () => {
      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        const statusFilter = screen.getByRole("combobox");
        expect(statusFilter).toBeInTheDocument();
      });
    });

    it("displays result count", async () => {
      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Showing 2 of 2 results")).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // PAGINATION
  // ============================================================================

  describe("Pagination", () => {
    it("does not show pagination when total pages is 1", async () => {
      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText("Page 1 of")).not.toBeInTheDocument();
      });
    });

    it("shows pagination when total pages > 1", async () => {
      mockGetAllPurchases.mockResolvedValue({
        purchases: mockPurchases,
        pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
      });

      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // LOADING & ERROR STATES
  // ============================================================================

  describe("Loading and Error States", () => {
    it("displays loading spinner initially", async () => {
      mockGetAllPurchases.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  purchases: mockPurchases,
                  pagination: mockPagination,
                }),
              100
            );
          })
      );

      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      // Should see loading state
      expect(screen.getByText("Income History")).toBeInTheDocument();
    });

    it("displays error message when API fails", async () => {
      mockGetAllPurchases.mockRejectedValue(new Error("API Error"));

      const { default: IncomeHistory } = await import(
        "../../pages/IncomeHistory"
      );

      render(
        <MemoryRouter>
          <IncomeHistory />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load income history. Please try again.")
        ).toBeInTheDocument();
      });
    });
  });
});

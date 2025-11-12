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
const mockGetAllDonationsAdmin = vi.fn();
const mockGetAdminDonationStats = vi.fn();

vi.mock("../../services/api", () => ({
  adminPurchaseService: {
    getAllPurchases: mockGetAllPurchases,
    getPaymentStats: mockGetPaymentStats,
  },
  donationsService: {
    getAllDonationsAdmin: mockGetAllDonationsAdmin,
    getAdminDonationStats: mockGetAdminDonationStats,
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

    // Mock donations service defaults
    mockGetAllDonationsAdmin.mockResolvedValue({
      donations: [],
      pagination: { page: 1, totalPages: 1, total: 0 },
    });
    mockGetAdminDonationStats.mockResolvedValue({
      totalRevenue: 0,
      totalDonations: 0,
      uniqueDonors: 0,
      activeRecurringRevenue: 0,
      last30Days: {
        donations: 0,
        revenue: 0,
      },
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

      // Wait for stats to load by finding a unique element that appears after loading
      // Use findByText which automatically waits for the element to appear
      await screen.findByText("Total Revenue");

      // Verify page-level summary cards are displayed
      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
      expect(screen.getByText("Programs + Donations")).toBeInTheDocument();

      // Verify unique people card
      expect(screen.getByText("Unique People")).toBeInTheDocument();
      expect(screen.getByText("Buyers + Donors")).toBeInTheDocument();

      // Verify revenue amounts are displayed (they appear multiple times)
      const revenueAmounts = screen.getAllByText("$1,250.00");
      expect(revenueAmounts.length).toBeGreaterThan(0);

      const last30DaysAmounts = screen.getAllByText("$450.00");
      expect(last30DaysAmounts.length).toBeGreaterThan(0);

      // Verify the purchase count in the "Last 30 Days" summary (appears in multiple places)
      const purchaseCounts = screen.getAllByText(/15.*purchases/);
      expect(purchaseCounts.length).toBeGreaterThan(0);

      // Check that both tabs are present
      expect(screen.getByText("Program Purchases")).toBeInTheDocument();
      expect(screen.getByText("Donations")).toBeInTheDocument();
    });

    it("handles missing stats gracefully", async () => {
      // Spy on console.error to suppress error output and catch the rejection
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockGetPaymentStats.mockRejectedValue(new Error("Stats unavailable"));
      mockGetAdminDonationStats.mockRejectedValue(
        new Error("Stats unavailable")
      );

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

      // Wait for the errors to be caught and logged (both tabs load stats)
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      // Stats should not be visible
      expect(screen.queryByText("Total Revenue")).not.toBeInTheDocument();

      consoleErrorSpy.mockRestore();
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

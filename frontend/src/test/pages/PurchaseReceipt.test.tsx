/**
 * PurchaseReceipt Component Tests
 *
 * Tests receipt display, print functionality, and discount breakdown
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";

// Mock Auth context
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { id: "u1", role: "Participant" },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

describe("PurchaseReceipt Component", () => {
  const mockReceipt = {
    orderNumber: "ORD-2025-001",
    purchaseDate: "2025-10-01T10:00:00Z",
    program: {
      title: "Advanced Leadership Training",
      programType: "Leadership Training",
    },
    user: {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
    },
    fullPrice: 19,
    classRepDiscount: 5,
    earlyBirdDiscount: 4,
    finalPrice: 10,
    isClassRep: true,
    isEarlyBird: true,
    paymentInfo: {
      cardBrand: "visa",
      last4: "4242",
      paymentMethod: "card",
    },
    billingInfo: {
      name: "Test User",
      email: "test@example.com",
      address: {
        line1: "123 Main St",
        line2: undefined,
        city: "Springfield",
        state: "IL",
        postalCode: "62701",
        country: "US",
      },
    },
    status: "completed" as const,
  };

  const mockPurchaseService = {
    getPurchaseReceipt: vi.fn().mockResolvedValue(mockReceipt),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPurchaseService.getPurchaseReceipt.mockResolvedValue(mockReceipt);

    vi.doMock("../../services/api", () => ({
      purchaseService: mockPurchaseService,
    }));

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom"
      );
      return {
        ...actual,
        useNavigate: () => vi.fn(),
        useParams: () => ({ id: "pur1" }),
      };
    });
  });

  it("displays receipt header with order number and date", async () => {
    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/ORD-2025-001/)).toBeInTheDocument();
    });

    expect(screen.getByText(/payment receipt/i)).toBeInTheDocument();
    expect(screen.getByText(/October 1, 2025/)).toBeInTheDocument();
  });

  it("displays program information", async () => {
    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Advanced Leadership Training")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Leadership Training")).toBeInTheDocument();
  });

  it("displays pricing breakdown with discounts", async () => {
    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Advanced Leadership Training")
      ).toBeInTheDocument();
    });

    // Full price
    expect(screen.getByText(/\$19\.00/)).toBeInTheDocument();

    // Discounts
    expect(
      screen.getByText(/Class Representative Discount/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/-\$5\.00/)).toBeInTheDocument();

    expect(screen.getByText(/Early Bird Discount/i)).toBeInTheDocument();
    expect(screen.getByText(/-\$4\.00/)).toBeInTheDocument();

    // Final price
    expect(screen.getByText(/\$10\.00/)).toBeInTheDocument();
  });

  it("displays payment method information", async () => {
    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Advanced Leadership Training")
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/visa/i)).toBeInTheDocument();
    expect(screen.getByText(/4242/)).toBeInTheDocument();
    const testUserElements = screen.getAllByText("Test User");
    expect(testUserElements.length).toBeGreaterThan(0);
  });

  it("displays billing information", async () => {
    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Advanced Leadership Training")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText(/Springfield, IL 62701/)).toBeInTheDocument();
  });

  it("triggers print functionality", async () => {
    const mockPrint = vi.fn();
    window.print = mockPrint;

    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    const user = userEvent.setup();

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Advanced Leadership Training")
      ).toBeInTheDocument();
    });

    const printButton = screen.getByRole("button", { name: /print receipt/i });
    await user.click(printButton);

    expect(mockPrint).toHaveBeenCalled();
  });

  it("displays completed status badge", async () => {
    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Advanced Leadership Training")
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it("handles receipt without discounts", async () => {
    mockPurchaseService.getPurchaseReceipt.mockResolvedValueOnce({
      ...mockReceipt,
      fullPrice: 19,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 19,
      isClassRep: false,
      isEarlyBird: false,
    });

    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Advanced Leadership Training")
      ).toBeInTheDocument();
    });

    // Should not show discount rows
    expect(screen.queryByText(/Class Rep Discount/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Early Bird Discount/i)).not.toBeInTheDocument();

    // Should show full price as final price (may appear multiple times)
    const prices = screen.getAllByText(/\$19\.00/);
    expect(prices.length).toBeGreaterThan(0);
  });

  it("handles loading state", async () => {
    let resolvePromise: any;
    const hangingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockPurchaseService.getPurchaseReceipt.mockReturnValueOnce(hangingPromise);

    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Initially, receipt content shouldn't be there (still loading)
    expect(
      screen.queryByText("Advanced Leadership Training")
    ).not.toBeInTheDocument();

    resolvePromise(mockReceipt);

    await waitFor(() => {
      expect(
        screen.getByText("Advanced Leadership Training")
      ).toBeInTheDocument();
    });
  });

  it("handles error state", async () => {
    mockPurchaseService.getPurchaseReceipt.mockRejectedValueOnce(
      new Error("Receipt not found")
    );

    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load receipt/i)).toBeInTheDocument();
    });
  });

  // TODO: Navigation mock test - Vitest limitation with vi.doMock + dynamic imports
  // The useNavigate mock doesn't get intercepted properly with current test setup
  // Navigation works in actual app - consider E2E test or refactoring test approach
  it.skip("navigates back to purchase history", async () => {
    const mockNavigate = vi.fn();

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom"
      );
      return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ id: "pur1" }),
      };
    });

    const { default: PurchaseReceipt } = await import(
      "../../pages/PurchaseReceipt"
    );
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    const user = userEvent.setup();

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/purchase-receipt/pur1"]}>
          <Routes>
            <Route
              path="/dashboard/purchase-receipt/:id"
              element={<PurchaseReceipt />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Advanced Leadership Training")
      ).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", {
      name: /back to purchase history/i,
    });
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/purchase-history");
  });
});

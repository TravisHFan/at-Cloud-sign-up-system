import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PurchaseSuccess from "../../pages/PurchaseSuccess";
import { purchaseService } from "../../services/api";

vi.mock("../../services/api", () => ({
  purchaseService: {
    verifySession: vi.fn(),
  },
}));

vi.mock("../../components/promo/BundlePromoCodeCard", () => ({
  default: ({ code }: { code: string }) => (
    <div data-testid="bundle-promo-card">Bundle Code: {code}</div>
  ),
}));

describe("PurchaseSuccess page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock alert
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("shows loading state initially", () => {
    vi.mocked(purchaseService.verifySession).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <MemoryRouter initialEntries={["/?session_id=test123"]}>
        <Routes>
          <Route path="/" element={<PurchaseSuccess />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/loading your purchase/i)).toBeInTheDocument();
  });

  it("shows success message with purchase details", async () => {
    const mockPurchase = {
      id: "purchase123",
      orderNumber: "ORD-123456",
      programId: {
        id: "prog123",
        title: "Advanced Programming Course",
        programType: "Training",
      },
      fullPrice: 10000,
      classRepDiscount: 500,
      earlyBirdDiscount: 1000,
      finalPrice: 8500,
      isClassRep: true,
      isEarlyBird: true,
      purchaseDate: "2024-01-15T10:00:00Z",
      status: "completed",
    };

    vi.mocked(purchaseService.verifySession).mockResolvedValue(mockPurchase);

    render(
      <MemoryRouter initialEntries={["/?session_id=test123"]}>
        <Routes>
          <Route path="/" element={<PurchaseSuccess />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/payment successful/i)).toBeInTheDocument();
    });

    expect(screen.getByText("ORD-123456")).toBeInTheDocument();
    expect(screen.getByText("Advanced Programming Course")).toBeInTheDocument();
  });

  it("shows bundle promo code when present", async () => {
    const mockPurchase = {
      id: "purchase123",
      orderNumber: "ORD-123456",
      programId: {
        id: "prog123",
        title: "Advanced Programming Course",
      },
      fullPrice: 10000,
      finalPrice: 10000,
      isClassRep: false,
      isEarlyBird: false,
      purchaseDate: "2024-01-15T10:00:00Z",
      status: "completed",
      bundlePromoCode: "BUNDLE50",
      bundleDiscountAmount: 5000,
      bundleExpiresAt: "2024-04-15T10:00:00Z",
    };

    vi.mocked(purchaseService.verifySession).mockResolvedValue(mockPurchase);

    render(
      <MemoryRouter initialEntries={["/?session_id=test123"]}>
        <Routes>
          <Route path="/" element={<PurchaseSuccess />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("bundle-promo-card")).toBeInTheDocument();
    });

    expect(screen.getByText(/Bundle Code: BUNDLE50/i)).toBeInTheDocument();
  });

  it("shows error message after retries fail", async () => {
    vi.mocked(purchaseService.verifySession).mockRejectedValue(
      new Error("Session not found")
    );

    render(
      <MemoryRouter initialEntries={["/?session_id=test123"]}>
        <Routes>
          <Route path="/" element={<PurchaseSuccess />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for error message to appear after retries
    await waitFor(
      () => {
        expect(
          screen.getByText(/your payment was successful/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/still processing your purchase/i)
        ).toBeInTheDocument();
      },
      { timeout: 15000 }
    );
  });

  it("redirects to programs when session_id is missing", () => {
    const alertSpy = vi.spyOn(window, "alert");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<PurchaseSuccess />} />
          <Route path="/dashboard/programs" element={<div>Programs</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(alertSpy).toHaveBeenCalledWith("Invalid payment session");
  });
});

/**
 * PurchaseHistory Refund UI Tests
 *
 * Tests the refund functionality in PurchaseHistory component:
 * - Refund dropdown menu visibility and interactions
 * - Refund eligibility checks
 * - Refund confirmation modal
 * - Refund initiation flow
 * - Status badges for refund states
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import PurchaseHistory from "../pages/PurchaseHistory";

// Mock the API service module
vi.mock("../services/api", async () => {
  const actual = await vi.importActual("../services/api");
  return {
    ...actual,
    purchaseService: {
      getMyPurchases: vi.fn(),
      getMyPendingPurchases: vi.fn(),
      checkRefundEligibility: vi.fn(),
      initiateRefund: vi.fn(),
      retryPurchase: vi.fn(),
      cancelPendingPurchase: vi.fn(),
    },
  };
});

// Import after mock to get mocked version
import { purchaseService } from "../services/api";

// Helper to render component with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

// Mock data
const mockCompletedPurchase = {
  id: "purchase-1",
  orderNumber: "ORD-20250110-00001",
  programId: {
    id: "program-1",
    title: "Test Program",
    programType: "EMBA Mentor Circles",
  },
  fullPrice: 10000,
  classRepDiscount: 0,
  earlyBirdDiscount: 0,
  finalPrice: 10000,
  isClassRep: false,
  isEarlyBird: false,
  purchaseDate: new Date().toISOString(),
  status: "completed" as const,
  createdAt: new Date().toISOString(),
};

const mockRefundProcessingPurchase = {
  ...mockCompletedPurchase,
  id: "purchase-2",
  status: "refund_processing" as const,
  refundInitiatedAt: new Date().toISOString(),
};

const mockRefundedPurchase = {
  ...mockCompletedPurchase,
  id: "purchase-3",
  status: "refunded" as const,
  refundInitiatedAt: new Date(Date.now() - 86400000).toISOString(),
  refundedAt: new Date().toISOString(),
};

const mockRefundFailedPurchase = {
  ...mockCompletedPurchase,
  id: "purchase-4",
  status: "refund_failed" as const,
  refundInitiatedAt: new Date(Date.now() - 86400000).toISOString(),
  refundFailureReason: "Insufficient funds in merchant account",
};

const mockEligibleResponse = {
  isEligible: true,
  daysRemaining: 25,
  purchaseDate: new Date().toISOString(),
  refundDeadline: new Date(Date.now() + 25 * 86400000).toISOString(),
};

const mockIneligibleResponse = {
  isEligible: false,
  reason:
    "Refund window has expired. Refunds are only available within 30 days of purchase.",
  purchaseDate: new Date(Date.now() - 31 * 86400000).toISOString(),
  refundDeadline: new Date(Date.now() - 1 * 86400000).toISOString(),
};

describe("PurchaseHistory - Refund UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Status Badge Rendering", () => {
    it("should display 'Completed' badge for completed purchases", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Completed")).toBeInTheDocument();
      });

      const badge = screen.getByText("Completed");
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });

    it("should display 'Refund Processing' badge for refund_processing status", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockRefundProcessingPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Refund Processing")).toBeInTheDocument();
      });

      const badge = screen.getByText("Refund Processing");
      expect(badge).toHaveClass("bg-purple-100", "text-purple-800");
    });

    it("should display 'Refunded' badge for refunded purchases", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockRefundedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Refunded")).toBeInTheDocument();
      });

      const badge = screen.getByText("Refunded");
      expect(badge).toHaveClass("bg-blue-100", "text-blue-800");
    });

    it("should display 'Refund Failed' badge for refund_failed status", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockRefundFailedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Refund Failed")).toBeInTheDocument();
      });

      const badge = screen.getByText("Refund Failed");
      expect(badge).toHaveClass("bg-red-100", "text-red-800");
    });
  });

  describe("Refund Dropdown Menu", () => {
    it("should show Actions button for completed purchases", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Should have an Actions button
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      expect(actionsButton).toBeInTheDocument();
    });

    it("should open dropdown menu when Actions button is clicked", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);

      // Dropdown should be visible
      await waitFor(() => {
        expect(screen.getByText("Request Refund")).toBeInTheDocument();
      });
    });

    it("should show Actions button for refunded purchases but not Request Refund option", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockRefundedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Should have an Actions button (for View Receipt)
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      expect(actionsButton).toBeInTheDocument();

      // Open dropdown
      fireEvent.click(actionsButton);

      // Should NOT have Request Refund option
      await waitFor(() => {
        expect(screen.queryByText("Request Refund")).not.toBeInTheDocument();
      });
    });

    it("should show Actions button for refund_processing purchases but not Request Refund option", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockRefundProcessingPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Should have an Actions button (for View Receipt)
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      expect(actionsButton).toBeInTheDocument();

      // Open dropdown
      fireEvent.click(actionsButton);

      // Should NOT have Request Refund option
      await waitFor(() => {
        expect(screen.queryByText("Request Refund")).not.toBeInTheDocument();
      });
    });
  });

  describe("Refund Eligibility Check", () => {
    it("should call checkRefundEligibility when Request Refund is clicked", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockResolvedValue(
        mockEligibleResponse
      );

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);

      // Click Request Refund
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Should call the API
      await waitFor(() => {
        expect(purchaseService.checkRefundEligibility).toHaveBeenCalledWith(
          "purchase-1"
        );
      });
    });

    it("should show confirmation modal when purchase is eligible", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockResolvedValue(
        mockEligibleResponse
      );

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);

      // Click Request Refund
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Confirmation modal should appear
      await waitFor(() => {
        expect(screen.getByText("Request Refund")).toBeInTheDocument();
      });

      // Should show "Refund Eligibility" section
      expect(screen.getByText("Refund Eligibility")).toBeInTheDocument();
    });

    it("should show error modal when purchase is not eligible", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockResolvedValue(
        mockIneligibleResponse
      );

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);

      // Click Request Refund
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Error modal should appear
      await waitFor(() => {
        expect(screen.getByText("Refund Not Available")).toBeInTheDocument();
      });

      // Should show reason
      expect(
        screen.getByText(/Refund window has expired/i)
      ).toBeInTheDocument();
    });

    it("should handle API errors gracefully", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockRejectedValue(
        new Error("Network error")
      );

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);

      // Click Request Refund
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Error modal should appear
      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Failed to check refund eligibility/i)
      ).toBeInTheDocument();
    });
  });

  describe("Refund Confirmation Modal", () => {
    it("should display refund confirmation modal with correct details", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockResolvedValue(
        mockEligibleResponse
      );

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown and request refund
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Modal should show
      await waitFor(() => {
        expect(screen.getByText("Request Refund")).toBeInTheDocument();
      });

      // Should show program title in modal (using getAllByText since it appears in the table too)
      expect(screen.getAllByText("Test Program").length).toBeGreaterThan(0);

      // Should show refund amount (appears multiple times on page, so just check it exists)
      expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);

      // Should have Confirm and Cancel buttons
      expect(
        screen.getByRole("button", { name: /confirm refund/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("should close modal when Cancel is clicked", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockResolvedValue(
        mockEligibleResponse
      );

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown and request refund
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Modal should show
      await waitFor(() => {
        expect(screen.getByText("Request Refund")).toBeInTheDocument();
      });

      // Click Cancel
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText("Request Refund")).not.toBeInTheDocument();
      });
    });
  });

  describe("Refund Initiation", () => {
    it("should call initiateRefund when Confirm Refund is clicked", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockResolvedValue(
        mockEligibleResponse
      );
      (purchaseService.initiateRefund as any).mockResolvedValue({
        success: true,
        message: "Refund initiated successfully",
      });

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown and request refund
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText("Request Refund")).toBeInTheDocument();
      });

      // Click Confirm Refund
      const confirmButton = screen.getByRole("button", {
        name: /confirm refund/i,
      });
      fireEvent.click(confirmButton);

      // Should call the API
      await waitFor(() => {
        expect(purchaseService.initiateRefund).toHaveBeenCalledWith(
          "purchase-1"
        );
      });
    });

    it("should show success message after successful refund initiation", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockResolvedValue(
        mockEligibleResponse
      );
      (purchaseService.initiateRefund as any).mockResolvedValue({
        success: true,
        message: "Refund initiated successfully",
      });

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown and request refund
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText("Request Refund")).toBeInTheDocument();
      });

      // Click Confirm Refund
      const confirmButton = screen.getByRole("button", {
        name: /confirm refund/i,
      });
      fireEvent.click(confirmButton);

      // Success message should appear
      await waitFor(() => {
        expect(screen.getByText("Refund Initiated")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Your refund request has been submitted/i)
      ).toBeInTheDocument();
    });

    it("should reload purchases after successful refund", async () => {
      const getMyPurchasesSpy = vi.fn();
      getMyPurchasesSpy.mockResolvedValueOnce([mockCompletedPurchase]);
      getMyPurchasesSpy.mockResolvedValueOnce([mockRefundProcessingPurchase]);

      (purchaseService.getMyPurchases as any) = getMyPurchasesSpy;
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockResolvedValue(
        mockEligibleResponse
      );
      (purchaseService.initiateRefund as any).mockResolvedValue({
        success: true,
      });

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown and request refund
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText("Request Refund")).toBeInTheDocument();
      });

      // Click Confirm Refund
      const confirmButton = screen.getByRole("button", {
        name: /confirm refund/i,
      });
      fireEvent.click(confirmButton);

      // Should reload purchases (called twice: initial load + after refund)
      await waitFor(() => {
        expect(getMyPurchasesSpy).toHaveBeenCalledTimes(2);
      });
    });

    it("should show error message when refund initiation fails", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockResolvedValue(
        mockEligibleResponse
      );
      (purchaseService.initiateRefund as any).mockRejectedValue(
        new Error("Stripe API error")
      );

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown and request refund
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText("Request Refund")).toBeInTheDocument();
      });

      // Click Confirm Refund
      const confirmButton = screen.getByRole("button", {
        name: /confirm refund/i,
      });
      fireEvent.click(confirmButton);

      // Error message should appear
      await waitFor(() => {
        expect(screen.getByText("Refund Failed")).toBeInTheDocument();
      });

      expect(screen.getByText(/Stripe API error/i)).toBeInTheDocument();
    });

    it("should disable confirm button while refund is processing", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);
      (purchaseService.checkRefundEligibility as any).mockResolvedValue(
        mockEligibleResponse
      );

      // Make the refund call take some time
      (purchaseService.initiateRefund as any).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 100)
          )
      );

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getByText("Test Program")).toBeInTheDocument();
      });

      // Open dropdown and request refund
      const actionsButton = screen.getByRole("button", { name: /actions/i });
      fireEvent.click(actionsButton);
      const requestRefundButton = await screen.findByText("Request Refund");
      fireEvent.click(requestRefundButton);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText("Request Refund")).toBeInTheDocument();
      });

      // Click Confirm Refund
      const confirmButton = screen.getByRole("button", {
        name: /confirm refund/i,
      });
      fireEvent.click(confirmButton);

      // Button should be disabled while processing
      expect(confirmButton).toBeDisabled();
    });
  });

  describe("Multiple Purchases", () => {
    it("should show refund option only for eligible purchases", async () => {
      (purchaseService.getMyPurchases as any).mockResolvedValue([
        mockCompletedPurchase,
        mockRefundedPurchase,
        mockRefundProcessingPurchase,
      ]);
      (purchaseService.getMyPendingPurchases as any).mockResolvedValue([]);

      renderWithRouter(<PurchaseHistory />);

      await waitFor(() => {
        expect(screen.getAllByText("Test Program")).toHaveLength(3);
      });

      // All purchases should have Actions buttons
      const actionsButtons = screen.getAllByRole("button", {
        name: /actions/i,
      });
      expect(actionsButtons).toHaveLength(3);

      // Open first dropdown (completed purchase) - should have Request Refund
      fireEvent.click(actionsButtons[0]);
      await waitFor(() => {
        expect(screen.getByText("Request Refund")).toBeInTheDocument();
      });
    });
  });
});

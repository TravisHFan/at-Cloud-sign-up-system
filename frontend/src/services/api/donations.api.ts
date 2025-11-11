/**
 * Donations API Service
 * Handles donation operations with Stripe integration
 */

import { BaseApiClient } from "./common";

/**
 * Type Definitions
 */
export type DonationType = "one-time" | "recurring";
export type DonationFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annually";
export type DonationStatus =
  | "pending"
  | "scheduled"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "failed";

export interface PaymentMethod {
  type: "card" | "other";
  cardBrand?: string;
  last4?: string;
}

export interface Donation {
  _id: string;
  userId: string;
  amount: number; // in cents
  type: DonationType;
  frequency?: DonationFrequency;
  status: DonationStatus;
  giftDate?: string; // ISO date for one-time
  startDate?: string; // ISO date for recurring
  endDate?: string; // ISO date (optional)
  endAfterOccurrences?: number;
  currentOccurrence: number;
  remainingOccurrences?: number;
  nextPaymentDate?: string; // ISO date
  lastGiftDate?: string; // ISO date
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  paymentMethod?: PaymentMethod;
  createdAt: string;
  updatedAt: string;
}

export interface DonationTransaction {
  _id: string;
  donationId: string;
  userId: string;
  amount: number; // in cents
  type: DonationType;
  status: "completed" | "failed" | "refunded";
  giftDate: string; // ISO date
  stripePaymentIntentId: string;
  paymentMethod?: PaymentMethod;
  createdAt: string;
}

export interface DonationStats {
  totalAmount: number; // in cents
  totalGifts: number;
}

export interface CreateDonationRequest {
  amount: number; // in dollars (will be converted to cents)
  type: DonationType;
  frequency?: DonationFrequency;
  giftDate?: string; // ISO date string
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  endAfterOccurrences?: number;
}

export interface UpdateDonationRequest {
  amount?: number; // in dollars
  frequency?: DonationFrequency;
  startDate?: string; // ISO date
  giftDate?: string; // ISO date
  endDate?: string | null; // ISO date or null to remove
  endAfterOccurrences?: number;
}

/**
 * API Client Class
 */
class DonationsApiClient extends BaseApiClient {
  /**
   * Create a new donation
   */
  async createDonation(data: CreateDonationRequest): Promise<{
    donationId: string;
    checkoutUrl: string;
  }> {
    const response = await this.request<{
      donationId: string;
      checkoutUrl: string;
    }>("/donations/create", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return (
      response.data || {
        donationId: "",
        checkoutUrl: "",
      }
    );
  }

  /**
   * Retry a pending donation checkout
   */
  async retryDonationCheckout(donationId: string): Promise<{
    checkoutUrl: string;
  }> {
    const response = await this.request<{
      checkoutUrl: string;
    }>(`/donations/${donationId}/retry-checkout`, {
      method: "POST",
    });
    return (
      response.data || {
        checkoutUrl: "",
      }
    );
  }

  /**
   * Get user's donation history (completed transactions)
   */
  async getMyDonations(
    page: number = 1,
    limit: number = 20,
    sortBy: string = "giftDate",
    sortOrder: "asc" | "desc" = "desc"
  ): Promise<{
    transactions: DonationTransaction[];
    pending: Donation[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
    };
  }> {
    const response = await this.request<{
      transactions: DonationTransaction[];
      pending: Donation[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        limit: number;
      };
    }>(
      `/donations/my-donations?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`
    );
    return (
      response.data || {
        transactions: [],
        pending: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalCount: 0,
          limit: 20,
        },
      }
    );
  }

  /**
   * Get user's scheduled donations (active and scheduled recurring donations)
   */
  async getMyScheduledDonations(): Promise<Donation[]> {
    const response = await this.request<{ scheduled: Donation[] }>(
      "/donations/my-scheduled"
    );
    return response.data?.scheduled || [];
  }

  /**
   * Get user's donation stats
   */
  async getStats(): Promise<DonationStats> {
    const response = await this.request<DonationStats>("/donations/stats");
    return (
      response.data || {
        totalAmount: 0,
        totalGifts: 0,
      }
    );
  }

  /**
   * Update/edit a scheduled donation
   */
  async updateDonation(
    donationId: string,
    updates: UpdateDonationRequest
  ): Promise<Donation | null> {
    const response = await this.request<{ donation: Donation }>(
      `/donations/${donationId}/edit`,
      {
        method: "PUT",
        body: JSON.stringify(updates),
      }
    );
    return response.data?.donation || null;
  }

  /**
   * Place donation on hold
   */
  async holdDonation(donationId: string): Promise<Donation | null> {
    const response = await this.request<{ donation: Donation }>(
      `/donations/${donationId}/hold`,
      {
        method: "PUT",
      }
    );
    return response.data?.donation || null;
  }

  /**
   * Resume donation from hold
   */
  async resumeDonation(donationId: string): Promise<Donation | null> {
    const response = await this.request<{ donation: Donation }>(
      `/donations/${donationId}/resume`,
      {
        method: "PUT",
      }
    );
    return response.data?.donation || null;
  }

  /**
   * Cancel donation
   */
  async cancelDonation(donationId: string): Promise<Donation | null> {
    const response = await this.request<{ donation: Donation }>(
      `/donations/${donationId}/cancel`,
      {
        method: "DELETE",
      }
    );
    return response.data?.donation || null;
  }
}

// Export singleton instance
export const donationsService = new DonationsApiClient();

/**
 * Helper Functions
 */
export const donationHelpers = {
  /**
   * Format amount from cents to dollars
   */
  formatAmount(cents: number): string {
    return (cents / 100).toFixed(2);
  },

  /**
   * Format amount from dollars to cents
   */
  toCents(dollars: number): number {
    return Math.round(dollars * 100);
  },

  /**
   * Format frequency for display
   */
  formatFrequency(frequency: DonationFrequency): string {
    const map: Record<DonationFrequency, string> = {
      weekly: "Weekly",
      biweekly: "Every 2 Weeks",
      monthly: "Monthly",
      quarterly: "Quarterly",
      annually: "Annually",
    };
    return map[frequency];
  },

  /**
   * Format payment method for display
   */
  formatPaymentMethod(paymentMethod?: PaymentMethod): string {
    if (!paymentMethod || !paymentMethod.cardBrand || !paymentMethod.last4) {
      return "Payment Method";
    }
    const brand =
      paymentMethod.cardBrand.charAt(0).toUpperCase() +
      paymentMethod.cardBrand.slice(1);
    return `${brand} •••• ${paymentMethod.last4}`;
  },

  /**
   * Format status for display
   */
  formatStatus(status: DonationStatus): string {
    const map: Record<DonationStatus, string> = {
      pending: "Pending Payment",
      scheduled: "Scheduled",
      active: "Active",
      on_hold: "On Hold",
      completed: "Completed",
      cancelled: "Cancelled",
      failed: "Failed",
    };
    return map[status];
  },

  /**
   * Get status badge color
   */
  getStatusColor(
    status: DonationStatus
  ): "green" | "blue" | "yellow" | "gray" | "red" {
    const colorMap: Record<
      DonationStatus,
      "green" | "blue" | "yellow" | "gray" | "red"
    > = {
      pending: "yellow",
      scheduled: "blue",
      active: "green",
      on_hold: "yellow",
      completed: "gray",
      cancelled: "gray",
      failed: "red",
    };
    return colorMap[status];
  },
};

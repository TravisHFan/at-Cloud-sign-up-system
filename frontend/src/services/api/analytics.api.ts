import { BaseApiClient } from "./common";

/**
 * Overview Analytics Types
 */
export interface AnalyticsOverview {
  overview: {
    totalUsers: number;
    totalEvents: number;
    totalRegistrations: number;
    activeParticipants: number;
    averageSignupRate: number;
    activeUsers: number;
    upcomingEvents: number;
    recentRegistrations: number;
  };
  growth: {
    userGrowthRate: number;
    eventGrowthRate: number;
    registrationGrowthRate: number;
  };
}

/**
 * Program Analytics Types
 */
export interface ProgramTypeBreakdown {
  programType: string;
  revenue: number; // in cents
  purchases: number;
  uniqueBuyers: number;
}

export interface ProgramAnalytics {
  totalRevenue: number; // in cents
  totalPurchases: number;
  uniqueBuyers: number;
  avgProgramPrice: number; // in cents
  classRepPurchases: number;
  classRepRevenue: number; // in cents
  classRepRate: number; // percentage
  promoCodePurchases: number;
  promoCodeUsageRate: number; // percentage
  earlyBirdPurchases: number;
  earlyBirdRate: number; // percentage
  pendingPurchases: number;
  pendingRevenue: number; // in cents
  failedPurchases: number;
  failedRevenue: number; // in cents
  refundedPurchases: number;
  refundedRevenue: number; // in cents
  last30Days: {
    revenue: number; // in cents
    purchases: number;
  };
  programTypeBreakdown: ProgramTypeBreakdown[];
}

/**
 * Financial Summary Types
 */
export interface FinancialSummary {
  totalRevenue: number; // in cents
  totalTransactions: number;
  uniqueParticipants: number;
  growthRate: number; // percentage
  last30Days: {
    revenue: number; // in cents
    transactions: number;
    percentage: number; // percentage of all-time
  };
  programs: {
    revenue: number; // in cents
    purchases: number;
    uniqueBuyers: number;
    last30Days: {
      revenue: number; // in cents
      purchases: number;
    };
  };
  donations: {
    revenue: number; // in cents
    gifts: number;
    uniqueDonors: number;
    last30Days: {
      revenue: number; // in cents
      donations: number;
    };
  };
}

/**
 * Donation Analytics Types
 */
export interface FrequencyBreakdown {
  frequency: string;
  count: number;
  monthlyValue: number; // in cents
}

export interface DonationAnalytics {
  totalRevenue: number; // in cents
  totalGifts: number;
  uniqueDonors: number;
  avgGiftsPerDonor: number;
  retentionRate: number; // percentage
  oneTime: {
    gifts: number;
    revenue: number; // in cents
    avgGiftSize: number; // in cents
  };
  recurring: {
    gifts: number;
    revenue: number; // in cents
    avgGiftSize: number; // in cents
    activeDonations: number;
    activeRecurringRevenue: number; // in cents - monthly equivalent
    onHoldDonations: number;
    scheduledDonations: number;
    frequencyBreakdown: FrequencyBreakdown[];
  };
}

/**
 * Trends Analytics Types
 */
export interface TrendsData {
  period: string; // "6months", "12months", "all", "custom"
  startDate: string; // ISO date
  endDate: string; // ISO date
  labels: string[]; // Month labels: ["Jan 2024", "Feb 2024", ...]
  programRevenue: number[]; // Revenue in cents for each month
  donationRevenue: number[]; // Revenue in cents for each month
  combinedRevenue: number[]; // Combined revenue in cents for each month
}

/**
 * Attendance Analytics Types
 */
export interface AttendanceCounts {
  registered: number;
  attended: number;
  absent: number;
  unrecorded: number;
  recorded: number;
  attendanceRate: number;
  noShowRate: number;
  completionRate: number;
}

export interface AttendancePersonAnalytics extends AttendanceCounts {
  userId: string;
  name: string;
  roleInAtCloud: string;
  systemAuthorizationLevel: string;
  programs: string[];
  completedEvents: number;
  lastAttendedAt?: string;
  lastAttendedEvent?: string;
}

export interface AttendanceProgramAnalytics extends AttendanceCounts {
  programId: string;
  programTitle: string;
  programType: string;
  completedEvents: number;
}

export interface AttendanceProgramRef {
  id: string;
  title: string;
  programType?: string;
}

export interface AttendanceEventAnalytics extends AttendanceCounts {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: string;
  programs: AttendanceProgramRef[];
}

export interface AttendanceAnalytics {
  summary: AttendanceCounts;
  byPerson: AttendancePersonAnalytics[];
  byProgram: AttendanceProgramAnalytics[];
  byEvent: AttendanceEventAnalytics[];
}

/**
 * Analytics API Service
 * Handles analytics data retrieval and export
 */
class AnalyticsApiClient extends BaseApiClient {
  /**
   * Get overall analytics data
   * @returns Analytics object
   */
  async getAnalytics(): Promise<AnalyticsOverview> {
    const response = await this.request<AnalyticsOverview>("/analytics");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get analytics");
  }

  /**
   * Get user-specific analytics
   * @returns User analytics object
   */
  async getUserAnalytics(): Promise<unknown> {
    const response = await this.request<unknown>("/analytics/users");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get user analytics");
  }

  /**
   * Get event-specific analytics
   * @returns Event analytics object
   */
  async getEventAnalytics(): Promise<unknown> {
    const response = await this.request<unknown>("/analytics/events");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get event analytics");
  }

  /**
   * Get engagement analytics
   * @returns Engagement analytics object
   */
  async getEngagementAnalytics(): Promise<unknown> {
    const response = await this.request<unknown>("/analytics/engagement");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get engagement analytics");
  }

  /**
   * Get attendance confirmation analytics for completed events
   * @returns Attendance analytics grouped by summary, person, program, and event
   */
  async getAttendanceAnalytics(): Promise<AttendanceAnalytics> {
    const response = await this.request<AttendanceAnalytics>(
      "/analytics/attendance"
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get attendance analytics");
  }

  /**
   * Export analytics data in specified format
   * @param format - Export format (csv, xlsx, json)
   * @returns Blob containing exported data
   */
  async exportAnalytics(
    format: "csv" | "xlsx" | "json" = "csv"
  ): Promise<Blob> {
    const response = await fetch(
      `${this.baseURL}/analytics/export?format=${format}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to export analytics");
    }

    return response.blob();
  }

  /**
   * Get program analytics (purchases, revenue, engagement)
   * @returns Program analytics data
   */
  async getProgramAnalytics(): Promise<ProgramAnalytics> {
    const response = await this.request<ProgramAnalytics>(
      "/analytics/programs"
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get program analytics");
  }

  /**
   * Get financial summary (combined programs + donations)
   * @returns Financial summary data
   */
  async getFinancialSummary(): Promise<FinancialSummary> {
    const response = await this.request<FinancialSummary>(
      "/analytics/financial-summary"
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get financial summary");
  }

  /**
   * Get donation analytics (one-time, recurring, frequency distribution)
   * @returns Donation analytics data
   */
  async getDonationAnalytics(): Promise<DonationAnalytics> {
    const response = await this.request<DonationAnalytics>(
      "/analytics/donations"
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get donation analytics");
  }

  /**
   * Get financial trends over time
   * @param period - Time period: "6months", "12months", "all", "custom"
   * @param startDate - Custom start date (for "custom" period only)
   * @param endDate - Custom end date (for "custom" period only)
   * @returns Financial trends data
   */
  async getTrends(
    period: "6months" | "12months" | "all" | "custom" = "6months",
    startDate?: string,
    endDate?: string
  ): Promise<TrendsData> {
    let url = `/analytics/trends?period=${period}`;
    if (period === "custom" && startDate && endDate) {
      url += `&startDate=${startDate}&endDate=${endDate}`;
    }

    const response = await this.request<TrendsData>(url);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get financial trends");
  }
}

// Export singleton instance
const analyticsApiClient = new AnalyticsApiClient();

// Export service methods
export const analyticsService = {
  getAnalytics: () => analyticsApiClient.getAnalytics(),
  getUserAnalytics: () => analyticsApiClient.getUserAnalytics(),
  getEventAnalytics: () => analyticsApiClient.getEventAnalytics(),
  getEngagementAnalytics: () => analyticsApiClient.getEngagementAnalytics(),
  getAttendanceAnalytics: () => analyticsApiClient.getAttendanceAnalytics(),
  getProgramAnalytics: () => analyticsApiClient.getProgramAnalytics(),
  getDonationAnalytics: () => analyticsApiClient.getDonationAnalytics(),
  getFinancialSummary: () => analyticsApiClient.getFinancialSummary(),
  getTrends: (
    period?: "6months" | "12months" | "all" | "custom",
    startDate?: string,
    endDate?: string
  ) => analyticsApiClient.getTrends(period, startDate, endDate),
  exportAnalytics: (format?: "csv" | "xlsx" | "json") =>
    analyticsApiClient.exportAnalytics(format),
};

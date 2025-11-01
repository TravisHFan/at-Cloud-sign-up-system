import { BaseApiClient } from "./common";

/**
 * Analytics API Service
 * Handles analytics data retrieval and export
 */
class AnalyticsApiClient extends BaseApiClient {
  /**
   * Get overall analytics data
   * @returns Analytics object
   */
  async getAnalytics(): Promise<unknown> {
    const response = await this.request<unknown>("/analytics");

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
}

// Export singleton instance
const analyticsApiClient = new AnalyticsApiClient();

// Export service methods
export const analyticsService = {
  getAnalytics: () => analyticsApiClient.getAnalytics(),
  getUserAnalytics: () => analyticsApiClient.getUserAnalytics(),
  getEventAnalytics: () => analyticsApiClient.getEventAnalytics(),
  getEngagementAnalytics: () => analyticsApiClient.getEngagementAnalytics(),
  exportAnalytics: (format?: "csv" | "xlsx" | "json") =>
    analyticsApiClient.exportAnalytics(format),
};

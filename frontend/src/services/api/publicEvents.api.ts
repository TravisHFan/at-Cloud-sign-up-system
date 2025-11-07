import { BaseApiClient } from "./common";
import type {
  PublicEventData,
  PublicEventListItem,
  PublicRegistrationPayload,
  PublicRegistrationResponse,
} from "./common/types";

/**
 * Public Events API Service
 * Handles public event listing, detail retrieval, and registration
 * These endpoints do not require authentication
 */
class PublicEventsApiClient extends BaseApiClient {
  /**
   * Get list of public events with optional filtering
   */
  async getPublicEvents(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
  }): Promise<{
    events: PublicEventListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("pageSize", params.limit.toString());
    if (params?.search) searchParams.append("q", params.search);
    if (params?.type) searchParams.append("type", params.type);

    const url = `${this.baseURL}/public/events${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch public events (${res.status})`);
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        items: PublicEventListItem[];
      };
    };
    if (!json.success || !json.data) {
      throw new Error("Malformed public events response");
    }
    return {
      events: json.data.items,
      pagination: {
        page: json.data.page,
        limit: json.data.pageSize,
        total: json.data.total,
        totalPages: json.data.totalPages,
      },
    };
  }

  // Public single event (optionally authenticated for richer data)
  async getPublicEvent(slug: string): Promise<PublicEventData> {
    const res = await this.request<PublicEventData>(`/public/events/${slug}`);
    if (!res.data) throw new Error("Malformed public event response");
    return res.data; // res.data now typed so import is used
  }

  async registerForPublicEvent(
    slug: string,
    payload: PublicRegistrationPayload
  ): Promise<PublicRegistrationResponse> {
    const res = await fetch(`${this.baseURL}/public/events/${slug}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      // Try to parse JSON error response and extract clean message
      try {
        const errorData = JSON.parse(text);
        // Extract just the message field from the error response
        if (
          errorData &&
          typeof errorData === "object" &&
          "message" in errorData
        ) {
          throw new Error(errorData.message);
        }
        // Fallback if no message field
        throw new Error(text || `Registration failed (${res.status})`);
      } catch (error) {
        // If JSON.parse failed or re-throwing our custom error
        if (error instanceof Error && error.message !== text) {
          // This is our custom error with clean message, re-throw it
          throw error;
        }
        // JSON parse failed, throw raw text
        throw new Error(text || `Registration failed (${res.status})`);
      }
    }
    const json = (await res.json()) as { success?: boolean; data?: unknown };
    if (!json.success || !json.data)
      throw new Error("Malformed registration response");
    return json.data as PublicRegistrationResponse;
  }
}

// Export singleton instance
const publicEventsApiClient = new PublicEventsApiClient();

// Export service methods
export const publicEventsService = {
  getPublicEvents: (
    params?: Parameters<typeof publicEventsApiClient.getPublicEvents>[0]
  ) => publicEventsApiClient.getPublicEvents(params),
  getPublicEvent: (slug: string) => publicEventsApiClient.getPublicEvent(slug),
  registerForPublicEvent: (slug: string, payload: PublicRegistrationPayload) =>
    publicEventsApiClient.registerForPublicEvent(slug, payload),
};

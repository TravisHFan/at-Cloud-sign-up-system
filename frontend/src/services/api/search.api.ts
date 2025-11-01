import { BaseApiClient } from "./common";
import type { User as AppUser } from "../../types";
import type { EventData } from "../../types/event";

/**
 * Search API Service
 * Handles search operations across users, events, and global search
 */
class SearchApiClient extends BaseApiClient {
  /**
   * Search for users
   * @param query - Search query string
   * @param filters - Optional filters for narrowing results
   * @returns User search results with optional pagination
   */
  async searchUsers(
    query: string,
    filters?: Record<string, string | number | boolean | null | undefined>
  ): Promise<{ results: AppUser[]; pagination?: unknown }> {
    const queryParams = new URLSearchParams({ q: query });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<{
      results: AppUser[];
      pagination?: unknown;
    }>(`/search/users?${queryParams.toString()}`);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to search users");
  }

  /**
   * Search for events
   * @param query - Search query string
   * @param filters - Optional filters for narrowing results
   * @returns Event search results with optional pagination
   */
  async searchEvents(
    query: string,
    filters?: Record<string, string | number | boolean | null | undefined>
  ): Promise<{ results: EventData[]; pagination?: unknown }> {
    const queryParams = new URLSearchParams({ q: query });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<{
      events: EventData[]; // Backend returns 'events'
      pagination?: unknown;
    }>(`/search/events?${queryParams.toString()}`);

    if (response.data) {
      // Transform backend response to match expected frontend structure
      return {
        results: response.data.events, // Map 'events' to 'results'
        pagination: response.data.pagination,
      };
    }

    throw new Error(response.message || "Failed to search events");
  }

  /**
   * Perform global search across multiple entity types
   * @param query - Search query string
   * @returns Results grouped by entity type
   */
  async globalSearch(query: string): Promise<{
    users?: AppUser[];
    events?: EventData[];
    messages?: unknown[];
  }> {
    const response = await this.request<{
      users?: AppUser[];
      events?: EventData[];
      messages?: unknown[];
    }>(`/search/global?q=${encodeURIComponent(query)}`);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to perform global search");
  }
}

// Export singleton instance
const searchApiClient = new SearchApiClient();

// Export service methods
export const searchService = {
  searchUsers: (
    query: string,
    filters?: Parameters<typeof searchApiClient.searchUsers>[1]
  ) => searchApiClient.searchUsers(query, filters),
  searchEvents: (
    query: string,
    filters?: Parameters<typeof searchApiClient.searchEvents>[1]
  ) => searchApiClient.searchEvents(query, filters),
  globalSearch: (query: string) => searchApiClient.globalSearch(query),
};

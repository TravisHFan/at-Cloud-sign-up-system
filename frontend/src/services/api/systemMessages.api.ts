import { BaseApiClient } from "./common";
import type { SystemMessage } from "../../types/notification";
import type { ApiResponse } from "./common/types";

/**
 * System Messages API Service
 * Handles system messages (unified notifications API)
 */
class SystemMessagesApiClient extends BaseApiClient {
  /**
   * Get all system messages for current user
   * @returns Array of system messages
   */
  async getSystemMessages(): Promise<SystemMessage[]> {
    const response = await this.request<{ systemMessages: SystemMessage[] }>(
      "/notifications/system"
    );

    if (response.data) {
      return response.data.systemMessages;
    }

    throw new Error(response.message || "Failed to get system messages");
  }

  /**
   * Get unread count for system messages
   * @returns Number of unread system messages
   */
  async getSystemMessageUnreadCount(): Promise<number> {
    const response = await this.request<{ unreadCount: number }>(
      "/notifications/unread-counts"
    );

    if (response.data) {
      return response.data.unreadCount;
    }

    throw new Error(response.message || "Failed to get unread count");
  }

  /**
   * Check if user has received welcome message
   * @returns True if user has received welcome message
   */
  async checkWelcomeMessageStatus(): Promise<boolean> {
    const response = await this.request<{ hasReceivedWelcomeMessage: boolean }>(
      "/notifications/welcome-status"
    );

    if (response.data) {
      return response.data.hasReceivedWelcomeMessage;
    }

    throw new Error(
      response.message || "Failed to check welcome message status"
    );
  }

  /**
   * Send welcome notification to current user
   */
  async sendWelcomeNotification(): Promise<void> {
    const response = await this.request<ApiResponse<unknown>>(
      "/notifications/welcome",
      {
        method: "POST",
      }
    );

    if (!response.success) {
      throw new Error(
        response.message || "Failed to send welcome notification"
      );
    }
  }

  /**
   * Mark a single system message as read
   * @param messageId - System message ID to mark as read
   * @returns API response
   */
  async markSystemMessageAsRead(
    messageId: string
  ): Promise<ApiResponse<unknown>> {
    const response = await this.request<ApiResponse<unknown>>(
      `/notifications/system/${messageId}/read`,
      {
        method: "PATCH", // Standardized to PATCH for consistency
      }
    );

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to mark message as read");
  }

  /**
   * Mark all bell notifications as read
   * Note: System messages don't have a "mark all as read" feature by design
   * This method redirects to bell notifications endpoint
   * @returns API response
   */
  async markAllSystemMessagesAsRead(): Promise<ApiResponse<unknown>> {
    // This method is for BELL notifications "mark all as read", not system messages
    // System messages don't have a "mark all as read" feature by design
    // Redirecting to the correct bell notifications endpoint
    const response = await this.request<ApiResponse<unknown>>(
      "/notifications/bell/read-all",
      {
        method: "PATCH",
      }
    );

    if (!response.success) {
      throw new Error(
        response.message || "Failed to mark all bell notifications as read"
      );
    }

    return response;
  }

  /**
   * Create a new system message (Admin only)
   * @param message - System message data
   * @returns API response
   */
  async createSystemMessage(message: unknown): Promise<ApiResponse<unknown>> {
    const response = await this.request<ApiResponse<unknown>>(
      "/system-messages",
      {
        method: "POST",
        body: JSON.stringify(message),
      }
    );

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to create system message");
  }

  /**
   * Create an auto system message (Admin only)
   * @param message - Auto system message data
   * @returns API response
   */
  async createAutoSystemMessage(
    message: unknown
  ): Promise<ApiResponse<unknown>> {
    const response = await this.request<ApiResponse<unknown>>(
      "/system-messages/auto",
      {
        method: "POST",
        body: JSON.stringify(message),
      }
    );

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to create auto system message");
  }

  /**
   * Delete a system message (Admin only)
   * @param messageId - System message ID to delete
   * @returns API response
   */
  async deleteSystemMessage(messageId: string): Promise<ApiResponse<unknown>> {
    const response = await this.request<ApiResponse<unknown>>(
      `/system-messages/${messageId}`,
      {
        method: "DELETE",
      }
    );

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to delete system message");
  }
}

// Export singleton instance
const systemMessagesApiClient = new SystemMessagesApiClient();

// Export service methods
export const systemMessagesService = {
  getSystemMessages: () => systemMessagesApiClient.getSystemMessages(),
  getSystemMessageUnreadCount: () =>
    systemMessagesApiClient.getSystemMessageUnreadCount(),
  checkWelcomeMessageStatus: () =>
    systemMessagesApiClient.checkWelcomeMessageStatus(),
  sendWelcomeNotification: () =>
    systemMessagesApiClient.sendWelcomeNotification(),
  markSystemMessageAsRead: (messageId: string) =>
    systemMessagesApiClient.markSystemMessageAsRead(messageId),
  markAllSystemMessagesAsRead: () =>
    systemMessagesApiClient.markAllSystemMessagesAsRead(),
  createSystemMessage: (message: unknown) =>
    systemMessagesApiClient.createSystemMessage(message),
  createAutoSystemMessage: (message: unknown) =>
    systemMessagesApiClient.createAutoSystemMessage(message),
  deleteSystemMessage: (messageId: string) =>
    systemMessagesApiClient.deleteSystemMessage(messageId),
};

// Legacy export (singular name for backward compatibility)
export const systemMessageService = systemMessagesService;

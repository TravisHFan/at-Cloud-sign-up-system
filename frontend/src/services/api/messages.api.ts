import { BaseApiClient } from "./common";

/**
 * Messages API Service
 * Handles event and direct messaging
 */
class MessagesApiClient extends BaseApiClient {
  /**
   * Get messages with optional filtering
   * @param params - Query parameters for filtering messages
   * @returns Messages array with optional pagination
   */
  async getMessages(params: {
    eventId?: string;
    receiverId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ messages: unknown[]; pagination?: unknown }> {
    const queryParams = new URLSearchParams();
    if (params.eventId) queryParams.append("eventId", params.eventId);
    if (params.receiverId) queryParams.append("receiverId", params.receiverId);
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());

    const response = await this.request<{
      messages: unknown[];
      pagination?: unknown;
    }>(`/messages?${queryParams.toString()}`);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to fetch messages");
  }

  /**
   * Send a new message
   * @param messageData - Message content and metadata
   * @returns Created message object
   */
  async sendMessage(messageData: {
    content: string;
    eventId?: string;
    receiverId?: string;
    messageType?: string;
    parentMessageId?: string;
    mentions?: string[];
    priority?: string;
    tags?: string[];
  }): Promise<unknown> {
    const response = await this.request<{ message: unknown }>("/messages", {
      method: "POST",
      body: JSON.stringify(messageData),
    });

    if (response.data) {
      return response.data.message;
    }

    throw new Error(response.message || "Failed to send message");
  }

  /**
   * Edit an existing message
   * @param messageId - Message ID to edit
   * @param content - New message content
   * @returns Updated message object
   */
  async editMessage(messageId: string, content: string): Promise<unknown> {
    const response = await this.request<{ message: unknown }>(
      `/messages/${messageId}`,
      {
        method: "PUT",
        body: JSON.stringify({ content }),
      }
    );

    if (response.data) {
      return response.data.message;
    }

    throw new Error(response.message || "Failed to edit message");
  }

  /**
   * Delete a message
   * @param messageId - Message ID to delete
   * @returns Success status
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    const response = await this.request<{ success: boolean }>(
      `/messages/${messageId}`,
      {
        method: "DELETE",
      }
    );

    return response.success;
  }

  /**
   * Add emoji reaction to a message
   * @param messageId - Message ID to react to
   * @param emoji - Emoji string
   * @returns Updated message with reactions
   */
  async addReaction(messageId: string, emoji: string): Promise<unknown> {
    const response = await this.request<{ message: unknown }>(
      `/messages/${messageId}/reactions`,
      {
        method: "POST",
        body: JSON.stringify({ emoji }),
      }
    );

    if (response.data) {
      return response.data.message;
    }

    throw new Error(response.message || "Failed to add reaction");
  }
}

// Export singleton instance
const messagesApiClient = new MessagesApiClient();

// Export service methods
export const messagesService = {
  getMessages: (params: Parameters<typeof messagesApiClient.getMessages>[0]) =>
    messagesApiClient.getMessages(params),
  sendMessage: (
    messageData: Parameters<typeof messagesApiClient.sendMessage>[0]
  ) => messagesApiClient.sendMessage(messageData),
  editMessage: (messageId: string, content: string) =>
    messagesApiClient.editMessage(messageId, content),
  deleteMessage: (messageId: string) =>
    messagesApiClient.deleteMessage(messageId),
  addReaction: (messageId: string, emoji: string) =>
    messagesApiClient.addReaction(messageId, emoji),
};

// Legacy export (singular name for backward compatibility)
export const messageService = messagesService;

// Types for hybrid chat system
export interface ChatMessage {
  messageId: string;
  content: string;
  messageType: "text" | "image" | "file";
  isFromMe: boolean;
  senderName: string;
  senderUsername: string;
  senderAvatar?: string;
  timestamp: string;
  isDeleted: boolean;
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
}

export interface ChatConversation {
  partnerId: string;
  partnerName: string;
  partnerUsername: string;
  partnerAvatar?: string;
  partnerGender?: string;
  lastMessageId?: string;
  lastMessageContent?: string;
  lastMessageTime: string;
  lastMessageFromMe: boolean;
  unreadCount: number;
  isArchived: boolean;
  isMuted: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageRequest {
  toUserId: string;
  content: string;
  messageType: "text" | "image" | "file";
  attachments?: ChatAttachment[];
}

export interface SendMessageResponse {
  messageId: string;
  timestamp: string;
  conversationId: string;
}

export interface ConversationManageRequest {
  action: "pin" | "mute" | "archive";
  value: boolean;
}

export interface SearchMessagesResponse {
  messages: ChatMessage[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Hybrid Chat Service
 * Handles all communication with the new hybrid chat backend API
 */
export class HybridChatService {
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const baseURL =
      import.meta.env.VITE_API_URL || "http://localhost:5001/api/v1";
    const url = `${baseURL}${endpoint}`;

    // Get auth token from localStorage
    const token = localStorage.getItem("authToken");

    const defaultHeaders: HeadersInit = {};

    // Only set Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
      defaultHeaders["Content-Type"] = "application/json";
    }

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: "include",
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle 401 errors (token expired)
        if (response.status === 401) {
          localStorage.removeItem("authToken");
        }

        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data.data || data;
    } catch (error) {
      console.error("Hybrid Chat API Request failed:", error);
      throw error instanceof Error ? error : new Error("Network error");
    }
  }

  /**
   * Send a message to another user
   */
  static async sendMessage(
    request: SendMessageRequest
  ): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>("/chat/messages", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Get all conversations for the current user
   */
  static async getConversations(): Promise<ChatConversation[]> {
    const response = await this.request<{ conversations: ChatConversation[] }>(
      "/chat/conversations"
    );
    return response.conversations;
  }

  /**
   * Get messages for a specific conversation
   */
  static async getConversationMessages(
    partnerId: string,
    limit = 50,
    before?: string
  ): Promise<ChatMessage[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(before && { before }),
    });

    const response = await this.request<{ messages: ChatMessage[] }>(
      `/chat/conversations/${partnerId}/messages?${params}`
    );
    return response.messages;
  }

  /**
   * Manage conversation settings (pin, mute, archive)
   */
  static async manageConversation(
    partnerId: string,
    request: ConversationManageRequest
  ): Promise<void> {
    await this.request(`/chat/conversations/${partnerId}/manage`, {
      method: "PUT",
      body: JSON.stringify(request),
    });
  }

  /**
   * Delete a message
   */
  static async deleteMessage(messageId: string): Promise<void> {
    await this.request(`/chat/messages/${messageId}`, {
      method: "DELETE",
    });
  }

  /**
   * Search messages across conversations
   */
  static async searchMessages(
    query: string,
    partnerId?: string,
    limit = 20
  ): Promise<SearchMessagesResponse> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
      ...(partnerId && { partnerId }),
    });

    return this.request<SearchMessagesResponse>(`/chat/search?${params}`);
  }

  /**
   * Mark conversation as read
   */
  static async markConversationAsRead(partnerId: string): Promise<void> {
    await this.request(`/chat/conversations/${partnerId}/manage`, {
      method: "PUT",
      body: JSON.stringify({
        action: "markAsRead",
        value: true,
      }),
    });
  }

  /**
   * Pin/Unpin conversation
   */
  static async pinConversation(
    partnerId: string,
    pinned: boolean
  ): Promise<void> {
    return this.manageConversation(partnerId, {
      action: "pin",
      value: pinned,
    });
  }

  /**
   * Mute/Unmute conversation
   */
  static async muteConversation(
    partnerId: string,
    muted: boolean
  ): Promise<void> {
    return this.manageConversation(partnerId, {
      action: "mute",
      value: muted,
    });
  }

  /**
   * Archive/Unarchive conversation
   */
  static async archiveConversation(
    partnerId: string,
    archived: boolean
  ): Promise<void> {
    return this.manageConversation(partnerId, {
      action: "archive",
      value: archived,
    });
  }
}

export default HybridChatService;

import type { ApiResponse } from "./api";
import type { Notification, SystemMessage } from "../types/notification";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api/v1";

/**
 * Unified Notification Service for persistent bell notifications
 * Handles both System Messages and Chat Messages with proper backend sync
 */
export class UnifiedNotificationService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem("authToken");

    const defaultHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };

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
        throw new Error(
          data.message || `HTTP error! status: ${response.status}`
        );
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Get all notifications for the bell dropdown (unified view)
   * This includes both system messages converted to notifications and chat message notifications
   */
  async getUnifiedNotifications(
    options: {
      page?: number;
      limit?: number;
      includeRead?: boolean;
    } = {}
  ): Promise<{
    notifications: Notification[];
    totalCount: number;
    unreadCount: number;
    pagination: {
      currentPage: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const { page = 1, limit = 50, includeRead = true } = options;

    const response = await this.request<{
      notifications: Notification[];
      totalCount: number;
      unreadCount: number;
      pagination: any;
    }>(
      `/notifications/v2?page=${page}&limit=${limit}&includeRead=${includeRead}`
    );

    if (!response.data) {
      throw new Error("No data received from server");
    }

    return response.data;
  }

  /**
   * Mark a notification as read (persistent)
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.request(`/notifications/v2/${notificationId}/read`, {
      method: "PATCH",
    });
  }

  /**
   * Mark a system message as read (persistent)
   */
  async markSystemMessageAsRead(messageId: string): Promise<void> {
    await this.request(`/notifications/v2/system-messages/${messageId}/read`, {
      method: "PATCH",
    });
  }

  /**
   * Mark all notifications as read (persistent)
   */
  async markAllNotificationsAsRead(): Promise<void> {
    await this.request(`/notifications/v2/mark-all-read`, {
      method: "PATCH",
    });
  }

  /**
   * Delete a notification permanently (persistent)
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`/notifications/v2/${notificationId}`, {
      method: "DELETE",
    });
  }

  /**
   * Create a system message (Admin/Moderator only)
   */
  async createSystemMessage(systemMessage: {
    title: string;
    content: string;
    type:
      | "announcement"
      | "maintenance"
      | "update"
      | "warning"
      | "auth_level_change";
    priority?: "high" | "medium" | "low";
    targetUserId?: string;
    expiresAt?: string;
  }): Promise<{
    systemMessage: SystemMessage;
    notifications: Notification[];
  }> {
    const response = await this.request<{
      systemMessage: SystemMessage;
      notifications: Notification[];
    }>(`/notifications/v2/system-messages`, {
      method: "POST",
      body: JSON.stringify(systemMessage),
    });

    if (!response.data) {
      throw new Error("No data received from server");
    }

    return response.data;
  }

  /**
   * Create a chat message notification
   */
  async createChatNotification(chatData: {
    toUserId: string;
    message: string;
    conversationId?: string;
  }): Promise<Notification | null> {
    const response = await this.request<Notification>(
      `/notifications/v2/chat-notifications`,
      {
        method: "POST",
        body: JSON.stringify(chatData),
      }
    );

    return response.data || null;
  }

  /**
   * Get system messages (for dedicated system messages page)
   */
  async getSystemMessages(
    options: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    systemMessages: SystemMessage[];
    totalMessages: number;
    pagination: any;
  }> {
    const { page = 1, limit = 50 } = options;
    const response = await this.request<{
      systemMessages: SystemMessage[];
      totalMessages: number;
      pagination: any;
    }>(`/system-messages?page=${page}&limit=${limit}`);

    if (!response.data) {
      throw new Error("No data received from server");
    }

    return response.data;
  }

  /**
   * Delete a system message (Admin/Moderator only)
   */
  async deleteSystemMessage(messageId: string): Promise<void> {
    await this.request(`/system-messages/${messageId}`, {
      method: "DELETE",
    });
  }

  /**
   * Get unread count only (for efficient polling)
   */
  async getUnreadCount(): Promise<{
    totalUnreadCount: number;
    unreadCounts: {
      notifications: number;
      systemMessages: number;
    };
  }> {
    const response = await this.request<{
      totalUnreadCount: number;
      unreadCounts: {
        notifications: number;
        systemMessages: number;
      };
    }>(`/notifications/v2/unread-count`);

    if (!response.data) {
      throw new Error("No data received from server");
    }

    return response.data;
  }
}

// Export singleton instance
export const unifiedNotificationService = new UnifiedNotificationService();

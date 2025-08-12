import type { ApiResponse } from "./api";
import type {
  Notification,
  SystemMessage as SystemMessageType,
} from "../types/notification";

// Minimal DTO matching backend bell notification payload
interface BackendBellNotificationCreatorDTO {
  firstName: string;
  lastName: string;
  roleInAtCloud?: string;
  authLevel?: string;
}

interface BackendBellNotificationDTO {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  type?: string;
  creator?: BackendBellNotificationCreatorDTO;
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";

class NotificationService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    // Get auth token from localStorage
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
        if (response.status === 401) {
          localStorage.removeItem("authToken");
        }
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error("Notification API Request failed:", error);
      throw error instanceof Error ? error : new Error("Network error");
    }
  }

  // Get user bell notifications (use NEW unified notifications endpoint)
  async getNotifications(): Promise<Notification[]> {
    const response = await this.request<{
      notifications: BackendBellNotificationDTO[];
      unreadCount: number;
    }>("/notifications/bell");

    // Transform backend notifications to match frontend interface
    const notifications: Notification[] = (
      response.data?.notifications || []
    ).map((notification: BackendBellNotificationDTO) => {
      const normalizeType = (t?: string): SystemMessageType["type"] => {
        const allowed: SystemMessageType["type"][] = [
          "announcement",
          "maintenance",
          "update",
          "warning",
          "auth_level_change",
          "atcloud_role_change",
        ];
        return allowed.includes((t as SystemMessageType["type"]) || "")
          ? (t as SystemMessageType["type"])!
          : "announcement";
      };
      const transformed: Notification = {
        id: notification.id,
        type: "SYSTEM_MESSAGE" as const, // All bell notifications are system messages
        title: notification.title,
        message: notification.content,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        userId: "", // Not needed for system messages
        // Include system message details for proper "From" information display
        systemMessage: {
          id: notification.id,
          type: normalizeType(notification.type),
          creator: notification.creator
            ? {
                firstName: notification.creator.firstName,
                lastName: notification.creator.lastName,
                roleInAtCloud:
                  notification.creator.roleInAtCloud ||
                  notification.creator.authLevel,
              }
            : undefined,
        },
      };

      return transformed;
    });

    return notifications;
  }

  // Mark bell notification as read (use NEW unified notifications endpoint)
  async markAsRead(notificationId: string): Promise<void> {
    await this.request(`/notifications/bell/${notificationId}/read`, {
      method: "PATCH", // Standardized to PATCH for consistency
    });
  }

  // Mark all bell notifications as read (use NEW unified notifications endpoint)
  async markAllAsRead(): Promise<void> {
    await this.request("/notifications/bell/read-all", {
      method: "PATCH", // Standardized to PATCH for consistency
    });
  }

  // Delete a specific bell notification (use NEW unified notifications endpoint)
  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`/notifications/bell/${notificationId}`, {
      method: "DELETE",
    });
  }

  // Get unread counts (NEW unified notifications API)
  async getUnreadCounts(): Promise<{
    bellNotifications: number;
    systemMessages: number;
    total: number;
  }> {
    const response = await this.request<{
      bellNotifications: number;
      systemMessages: number;
      total: number;
    }>("/notifications/unread-counts");
    return (
      response.data || { bellNotifications: 0, systemMessages: 0, total: 0 }
    );
  }

  // Clean up expired notifications (NEW unified notifications API)
  async cleanupExpiredItems(): Promise<{
    removedNotifications: number;
    removedMessages: number;
  }> {
    const response = await this.request<{
      removedNotifications: number;
      removedMessages: number;
    }>("/notifications/cleanup", {
      method: "POST",
    });
    return response.data || { removedNotifications: 0, removedMessages: 0 };
  }

  // Admin: Create notification
  async createNotification(notification: {
    userId?: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<Notification> {
    const response = await this.request<Notification>("/notifications", {
      method: "POST",
      body: JSON.stringify(notification),
    });
    return response.data!;
  }

  // Admin: Send bulk notification
  async sendBulkNotification(notification: {
    userIds?: string[];
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    await this.request("/notifications/bulk", {
      method: "POST",
      body: JSON.stringify(notification),
    });
  }
}

// Create and export a singleton instance
export const notificationService = new NotificationService();
export default notificationService;

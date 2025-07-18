import type { ApiResponse } from "./api";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api/v1";

export interface SystemMessage {
  id: string;
  title: string;
  content: string;
  type:
    | "announcement"
    | "maintenance"
    | "update"
    | "warning"
    | "auth_level_change"
    | "ROLE_CHANGE";
  priority: "low" | "medium" | "high";
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
    roleInAtCloud?: string;
  };
  targetUserId?: string;
  isActive: boolean;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  originalMessageId?: string;
}

class SystemMessageService {
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
      console.error("System Message API Request failed:", error);
      throw error instanceof Error ? error : new Error("Network error");
    }
  }

  // Get user system messages (new user-centric API)
  async getSystemMessages(): Promise<SystemMessage[]> {
    try {
      const response = await this.request<{
        messages: SystemMessage[];
        pagination?: any;
      }>("/system-messages");
      return response.data?.messages || [];
    } catch (error) {
      console.error("Error fetching system messages:", error);
      return [];
    }
  }

  // Get unread count (new user-centric API)
  async getUnreadCount(): Promise<number> {
    try {
      const response = await this.request<{ systemMessages: number }>(
        "/user/notifications/unread-counts"
      );
      return response.data?.systemMessages || 0;
    } catch (error) {
      console.error("Error fetching unread count:", error);
      return 0;
    }
  }

  // Mark system message as read (use system-messages endpoint)
  async markAsRead(messageId: string): Promise<boolean> {
    try {
      await this.request(`/system-messages/${messageId}/read`, {
        method: "PATCH",
      });
      return true;
    } catch (error) {
      console.error("Error marking system message as read:", error);
      return false;
    }
  }

  // Note: markAllAsRead, createSystemMessage, createAutoSystemMessage, and deleteSystemMessage
  // are not implemented in the user-centric API as these operations are handled differently:
  // - markAllAsRead: Users can only mark their own messages as read
  // - create/delete: These are admin operations that affect all users and should use admin APIs

  async markAllAsRead(): Promise<boolean> {
    console.warn("markAllAsRead not implemented in user-centric API");
    return false;
  }

  async createSystemMessage(message: {
    title: string;
    content: string;
    type: string;
    priority: string;
    expiresAt?: string;
  }): Promise<SystemMessage> {
    const response = await this.request<SystemMessage>("/system-messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to create system message");
    }

    return response.data;
  }

  async createAutoSystemMessage(
    message: Omit<
      SystemMessage,
      "id" | "isActive" | "isRead" | "createdAt" | "updatedAt"
    >
  ): Promise<boolean> {
    console.warn(
      "createAutoSystemMessage not implemented in user-centric API - use admin API",
      message
    );
    return false;
  }

  async deleteSystemMessage(messageId: string): Promise<boolean> {
    try {
      const response = await this.request(`/system-messages/${messageId}`, {
        method: "DELETE",
      });
      return response.success;
    } catch (error) {
      console.error("Error deleting system message:", error);
      return false;
    }
  }
}

export const systemMessageService = new SystemMessageService();

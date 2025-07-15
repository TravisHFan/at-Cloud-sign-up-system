import { systemMessageService as apiSystemMessageService } from "./api";

export interface SystemMessage {
  _id: string;
  title: string;
  content: string;
  type:
    | "announcement"
    | "maintenance"
    | "update"
    | "warning"
    | "auth_level_change";
  priority: "low" | "medium" | "high";
  creator: {
    id: string;
    name: string;
    email: string;
  };
  targetUserId?: string;
  isActive: boolean;
  readByUsers: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

class SystemMessageService {
  async getSystemMessages(): Promise<SystemMessage[]> {
    try {
      const messages = await apiSystemMessageService.getSystemMessages();
      return messages;
    } catch (error) {
      console.error("Error fetching system messages:", error);
      return [];
    }
  }

  async getUnreadCount(): Promise<number> {
    try {
      const count = await apiSystemMessageService.getUnreadCount();
      return count;
    } catch (error) {
      console.error("Error fetching unread count:", error);
      return 0;
    }
  }

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      await apiSystemMessageService.markAsRead(messageId);
      return true;
    } catch (error) {
      console.error("Error marking system message as read:", error);
      return false;
    }
  }

  async markAllAsRead(): Promise<boolean> {
    try {
      await apiSystemMessageService.markAllAsRead();
      return true;
    } catch (error) {
      console.error("Error marking all system messages as read:", error);
      return false;
    }
  }

  async createSystemMessage(
    message: Omit<
      SystemMessage,
      "_id" | "isActive" | "readByUsers" | "createdAt" | "updatedAt"
    >
  ): Promise<boolean> {
    try {
      await apiSystemMessageService.createSystemMessage(message);
      return true;
    } catch (error) {
      console.error("Error creating system message:", error);
      return false;
    }
  }

  async createAutoSystemMessage(
    message: Omit<
      SystemMessage,
      "_id" | "isActive" | "readByUsers" | "createdAt" | "updatedAt"
    >
  ): Promise<boolean> {
    try {
      await apiSystemMessageService.createAutoSystemMessage(message);
      return true;
    } catch (error) {
      console.error("Error creating auto system message:", error);
      return false;
    }
  }

  async deleteSystemMessage(messageId: string): Promise<boolean> {
    try {
      await apiSystemMessageService.deleteSystemMessage(messageId);
      return true;
    } catch (error) {
      console.error("Error deleting system message:", error);
      return false;
    }
  }
}

export const systemMessageService = new SystemMessageService();

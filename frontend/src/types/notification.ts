export interface Notification {
  id: string;
  type: "system" | "user_message" | "management_action";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;

  // For user messages
  fromUser?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
  };

  // For management actions
  actionType?: "promotion" | "demotion" | "role_change";
  actionDetails?: {
    fromRole: string;
    toRole: string;
    actorName: string;
  };

  // For system messages (when displayed in bell dropdown)
  systemMessage?: SystemMessage;
}

export interface SystemMessage {
  id: string;
  title: string;
  content: string;
  type: "announcement" | "maintenance" | "update" | "warning";
  isRead: boolean;
  createdAt: string;
  priority: "low" | "medium" | "high";

  // Message creator information
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
    roleInAtCloud?: string;
  };
}

export interface ChatMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatConversation {
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
  };
  lastMessage?: ChatMessage;
  unreadCount: number;
  messages: ChatMessage[];
}

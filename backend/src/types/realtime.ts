// Realtime payload types (backend copy)

export type EventUpdateType =
  | "user_removed"
  | "user_moved"
  | "user_signed_up"
  | "user_cancelled"
  | "role_full"
  | "role_available"
  | "workshop_topic_updated"
  | "user_assigned"
  | "guest_registration"
  | "guest_cancellation"
  | "guest_updated"
  | "guest_moved"
  | "role_rejected"; // new: role assignment rejection (user declined role)

export interface EventUpdate {
  eventId: string;
  updateType: EventUpdateType;
  data: unknown;
  timestamp: string;
}

export type EventRoomUpdate = EventUpdate;

export interface SystemMessageUpdate<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
}

export interface BellNotificationUpdate<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
}

export interface UnreadCountUpdate {
  counts: {
    bellNotifications: number;
    systemMessages: number;
    total: number;
  };
  timestamp: string;
}

export interface ConnectedPayload {
  message: string;
  userId: string;
}

export type ServerToClientEvents = {
  connected: (payload: ConnectedPayload) => void;
  event_update: (payload: EventUpdate) => void;
  event_room_update: (payload: EventRoomUpdate) => void;
  system_message_update: (payload: SystemMessageUpdate) => void;
  bell_notification_update: (payload: BellNotificationUpdate) => void;
  unread_count_update: (payload: UnreadCountUpdate) => void;
};

export type ClientToServerEvents = {
  join_event_room: (eventId: string) => void;
  leave_event_room: (eventId: string) => void;
  update_status: (status: "online" | "away" | "busy") => void;
};

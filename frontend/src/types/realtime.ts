// Realtime payload types (frontend copy)

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
  | "role_rejected"; // user declined an assigned role (new realtime event)

// Narrow payloads for realtime events
export interface MinimalEventSnapshot {
  id?: string;
  _id?: string;
  title?: string;
  type?: string;
  date?: string;
  endDate?: string;
  time?: string;
  endTime?: string;
  timeZone?: string;
  roles?: unknown[];
  status?: string;
  attendees?: unknown[];
}

// Guest-related payloads
export interface GuestBasicPayload {
  roleId: string;
  guestName: string;
}

export type GuestRegistrationPayload = GuestBasicPayload;
export type GuestCancellationPayload = GuestBasicPayload;
export type GuestUpdatedPayload = GuestBasicPayload & {
  email?: string;
  phone?: string;
};

export interface GuestMovedPayload {
  fromRoleId: string;
  toRoleId: string;
  fromRoleName?: string;
  toRoleName?: string;
  // Optional event snapshot for richer toasts; minimal shape by design
  event?: MinimalEventSnapshot;
}

// User-related payloads
export interface UserSignedUpPayload {
  userId: string;
  roleId: string;
  roleName: string;
  user?: {
    userId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  event?: MinimalEventSnapshot;
}

export interface UserCancelledPayload {
  userId: string;
  roleId: string;
  roleName: string;
  event?: MinimalEventSnapshot;
}

export interface UserRemovedPayload {
  userId: string;
  roleId: string;
  roleName: string;
  event?: MinimalEventSnapshot;
}

export interface UserMovedPayload {
  userId: string;
  fromRoleId: string;
  toRoleId: string;
  fromRoleName?: string;
  toRoleName?: string;
  event?: MinimalEventSnapshot;
}

export interface UserAssignedPayload {
  operatorId: string; // actor who assigned
  userId: string; // target user
  roleId: string;
  roleName: string;
  event?: MinimalEventSnapshot;
}

export interface WorkshopTopicUpdatedPayload {
  group: string; // "A" | "B" | ...
  topic: string;
  userId?: string; // actor id
}

// Role capacity state payloads (minimal contract for UI hints)
export interface RoleFullPayload {
  roleId: string;
  roleName?: string;
}

export interface RoleAvailablePayload {
  roleId: string;
  roleName?: string;
}

// Discriminated union by updateType; keeps other updates permissive
export type EventUpdate =
  // Guest updates
  | {
      eventId: string;
      updateType: "guest_registration";
      data: GuestRegistrationPayload;
      timestamp: string;
    }
  | {
      eventId: string;
      updateType: "guest_cancellation";
      data: GuestCancellationPayload;
      timestamp: string;
    }
  | {
      eventId: string;
      updateType: "guest_updated";
      data: GuestUpdatedPayload;
      timestamp: string;
    }
  | {
      eventId: string;
      updateType: "guest_moved";
      data: GuestMovedPayload;
      timestamp: string;
    }
  // User updates
  | {
      eventId: string;
      updateType: "user_signed_up";
      data: UserSignedUpPayload;
      timestamp: string;
    }
  | {
      eventId: string;
      updateType: "user_cancelled";
      data: UserCancelledPayload;
      timestamp: string;
    }
  | {
      eventId: string;
      updateType: "user_removed";
      data: UserRemovedPayload;
      timestamp: string;
    }
  | {
      eventId: string;
      updateType: "user_moved";
      data: UserMovedPayload;
      timestamp: string;
    }
  | {
      eventId: string;
      updateType: "user_assigned";
      data: UserAssignedPayload;
      timestamp: string;
    }
  // Workshop topic update
  | {
      eventId: string;
      updateType: "workshop_topic_updated";
      data: WorkshopTopicUpdatedPayload;
      timestamp: string;
    }
  // Role capacity updates
  | {
      eventId: string;
      updateType: "role_full";
      data: RoleFullPayload;
      timestamp: string;
    }
  | {
      eventId: string;
      updateType: "role_available";
      data: RoleAvailablePayload;
      timestamp: string;
    }
  | {
      eventId: string;
      updateType: Exclude<
        EventUpdateType,
        | "guest_registration"
        | "guest_cancellation"
        | "guest_updated"
        | "guest_moved"
        | "user_signed_up"
        | "user_cancelled"
        | "user_removed"
        | "user_moved"
        | "user_assigned"
        | "workshop_topic_updated"
        | "role_full"
        | "role_available"
      >;
      data: unknown;
      timestamp: string;
    };

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

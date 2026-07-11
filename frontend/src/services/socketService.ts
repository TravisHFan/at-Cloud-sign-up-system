import { io, type Socket } from "socket.io-client";
import type { EventUpdate, ConnectedPayload } from "../types/realtime";
import { resolveSocketURL } from "../config/apiUrl";

const DEFAULT_SOCKET_URL = resolveSocketURL(
  import.meta.env.VITE_API_URL,
  import.meta.env.VITE_SOCKET_URL,
);

export interface UserUpdateData {
  userId: string;
  type: "role_changed" | "status_changed" | "deleted" | "profile_edited";
  user: {
    id: string;
    role?: string;
    avatar?: string;
    phone?: string;
    isAtCloudLeader?: boolean;
    roleInAtCloud?: string;
    isActive?: boolean;
  };
  changes?: Record<string, boolean>;
  timestamp?: string;
}

export interface SocketEventHandlers {
  event_update: (data: EventUpdate) => void;
  connected: (data: ConnectedPayload) => void;
  user_update: (data: UserUpdateData) => void;
  connect: () => void;
  disconnect: (reason: string) => void;
}

type StoredSocketHandler = (data: never) => void;

/**
 * Owns the browser's single authenticated Socket.IO connection.
 *
 * Components subscribe through this service (or `useSocket`) instead of
 * creating sockets themselves. Subscriptions survive a token-driven socket
 * replacement, while rooms and the connection are reference counted so one
 * consumer cannot tear down another consumer's realtime state.
 */
export class SocketServiceFrontend {
  private socketInstance: Socket | null = null;
  private currentToken: string | null = null;
  private currentUrl: string | null = null;
  private isConnecting = false;
  private consumerCount = 0;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly eventHandlers = new Map<
    string,
    Set<StoredSocketHandler>
  >();
  private readonly socketDispatchers = new Map<
    string,
    (data: unknown) => void
  >();
  private readonly roomSubscribers = new Map<string, number>();
  private readonly joinedRooms = new Set<string>();
  private readonly recentEventUpdates = new Map<string, number>();

  /** Create or reuse the shared connection without claiming ownership. */
  connect(token: string, url = DEFAULT_SOCKET_URL): Socket {
    const canReuse =
      this.socketInstance &&
      this.currentToken === token &&
      this.currentUrl === url;

    if (canReuse && this.socketInstance) {
      if (!this.socketInstance.connected && !this.socketInstance.active) {
        this.isConnecting = true;
        this.socketInstance.connect();
      }
      return this.socketInstance;
    }

    this.destroySocket();
    this.currentToken = token;
    this.currentUrl = url;
    this.isConnecting = true;

    const socket = io(url, {
      auth: { token },
      transports: ["websocket", "polling"],
      withCredentials: true,
      timeout: 20000,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socketInstance = socket;
    this.attachCoreListeners(socket);
    this.eventHandlers.forEach((_handlers, event) => {
      this.attachDispatcher(event);
    });

    return socket;
  }

  /**
   * Claim the shared connection for a mounted consumer.
   * The returned cleanup releases that claim and disconnects only after the
   * final consumer is gone. The zero-delay grace period absorbs StrictMode's
   * development-only mount/cleanup/remount cycle.
   */
  acquire(token: string, url = DEFAULT_SOCKET_URL): () => void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    this.consumerCount += 1;
    this.connect(token, url);
    let released = false;

    return () => {
      if (released) return;
      released = true;
      this.consumerCount = Math.max(0, this.consumerCount - 1);

      if (this.consumerCount === 0) {
        this.disconnectTimer = setTimeout(() => {
          this.disconnectTimer = null;
          if (this.consumerCount === 0) this.disconnect();
        }, 0);
      }
    };
  }

  /** Disconnect the shared socket and clear room ownership. */
  disconnect(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    this.destroySocket();
    this.currentToken = null;
    this.currentUrl = null;
    this.isConnecting = false;
    this.consumerCount = 0;
    this.roomSubscribers.clear();
    this.joinedRooms.clear();
    this.recentEventUpdates.clear();
  }

  private destroySocket(): void {
    const socket = this.socketInstance;
    if (!socket) return;

    this.joinedRooms.forEach((eventId) => {
      if (socket.connected) socket.emit("leave_event_room", eventId);
    });

    socket.disconnect();
    socket.removeAllListeners();
    this.socketInstance = null;
    this.socketDispatchers.clear();
    this.joinedRooms.clear();
  }

  private attachCoreListeners(socket: Socket): void {
    socket.on("connect", () => {
      if (socket !== this.socketInstance) return;
      this.isConnecting = false;
      this.joinedRooms.clear();

      this.roomSubscribers.forEach((count, eventId) => {
        if (count <= 0) return;
        socket.emit("join_event_room", eventId);
        this.joinedRooms.add(eventId);
      });
    });

    socket.on("disconnect", () => {
      if (socket !== this.socketInstance) return;
      this.joinedRooms.clear();
      this.isConnecting = socket.active;
    });

    socket.on("connect_error", (error) => {
      if (socket !== this.socketInstance) return;
      this.isConnecting = socket.active;
      if (import.meta.env.DEV) {
        console.error("Socket connection error:", error.message);
      }
    });

    socket.on("auth_error", (error) => {
      if (import.meta.env.DEV) {
        console.error("Socket authentication error:", error);
      }
      if (socket === this.socketInstance) this.disconnect();
    });
  }

  private attachDispatcher(event: string): void {
    const socket = this.socketInstance;
    const handlers = this.eventHandlers.get(event);
    if (!socket || !handlers?.size || this.socketDispatchers.has(event)) return;

    const dispatcher = (data: unknown) => {
      if (event === "event_update" && this.isDuplicateEventUpdate(data)) {
        return;
      }

      Array.from(this.eventHandlers.get(event) ?? []).forEach((handler) => {
        handler(data as never);
      });
    };

    this.socketDispatchers.set(event, dispatcher);
    socket.on(event, dispatcher);
  }

  private detachDispatcher(event: string): void {
    const dispatcher = this.socketDispatchers.get(event);
    if (dispatcher && this.socketInstance) {
      this.socketInstance.off(event, dispatcher);
    }
    this.socketDispatchers.delete(event);
  }

  /**
   * The backend currently broadcasts an event update globally and to its room.
   * Both copies have the same event id, update type, and timestamp. Collapse
   * that identical pair without suppressing separately timestamped updates.
   */
  private isDuplicateEventUpdate(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;
    const update = data as Partial<EventUpdate>;
    if (!update.eventId || !update.updateType || !update.timestamp) return false;

    const key = `${update.eventId}:${update.updateType}:${update.timestamp}`;
    const now = Date.now();
    const previous = this.recentEventUpdates.get(key);
    this.recentEventUpdates.set(key, now);

    if (this.recentEventUpdates.size > 200) {
      this.recentEventUpdates.forEach((seenAt, seenKey) => {
        if (now - seenAt > 5000) this.recentEventUpdates.delete(seenKey);
      });
    }

    return previous !== undefined && now - previous <= 5000;
  }

  /** Join once for the first consumer and retain the room for later consumers. */
  async joinEventRoom(eventId: string): Promise<void> {
    const currentCount = this.roomSubscribers.get(eventId) ?? 0;
    this.roomSubscribers.set(eventId, currentCount + 1);
    if (currentCount > 0) return;

    if (this.socketInstance?.connected) {
      this.socketInstance.emit("join_event_room", eventId);
      this.joinedRooms.add(eventId);
    }
  }

  /** Leave only when the final consumer of this room releases it. */
  leaveEventRoom(eventId: string): void {
    const currentCount = this.roomSubscribers.get(eventId) ?? 0;
    if (currentCount <= 0) return;

    if (currentCount > 1) {
      this.roomSubscribers.set(eventId, currentCount - 1);
      return;
    }

    this.roomSubscribers.delete(eventId);
    if (this.socketInstance?.connected && this.joinedRooms.has(eventId)) {
      this.socketInstance.emit("leave_event_room", eventId);
    }
    this.joinedRooms.delete(eventId);
  }

  on<K extends keyof SocketEventHandlers>(
    event: K,
    handler: SocketEventHandlers[K],
  ): () => void;
  on<T>(event: string, handler: (data: T) => void): () => void;
  on(event: string, handler: StoredSocketHandler): () => void {
    const handlers = this.eventHandlers.get(event) ?? new Set();
    handlers.add(handler);
    this.eventHandlers.set(event, handlers);
    this.attachDispatcher(event);
    return () => this.off(event, handler);
  }

  off<K extends keyof SocketEventHandlers>(
    event: K,
    handler?: SocketEventHandlers[K],
  ): void;
  off<T>(event: string, handler?: (data: T) => void): void;
  off(event: string, handler?: StoredSocketHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;

    if (handler) handlers.delete(handler);
    else handlers.clear();

    if (handlers.size === 0) {
      this.eventHandlers.delete(event);
      this.detachDispatcher(event);
    }
  }

  get socket(): Socket | null {
    return this.socketInstance;
  }

  get isConnected(): boolean {
    return this.socketInstance?.connected ?? false;
  }

  get connectionStatus(): {
    connected: boolean;
    connecting: boolean;
    consumers: number;
    joinedRooms: string[];
    pendingRooms: string[];
  } {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      consumers: this.consumerCount,
      joinedRooms: Array.from(this.joinedRooms),
      pendingRooms: Array.from(this.roomSubscribers.keys()).filter(
        (eventId) => !this.joinedRooms.has(eventId),
      ),
    };
  }
}

export const socketService = new SocketServiceFrontend();
export type { EventUpdate };

import { io, Socket } from "socket.io-client";

// For WebSocket connection, we need the base server URL, not the API path
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api/v1";
const SOCKET_URL = API_BASE_URL.replace("/api/v1", "");

interface EventUpdate {
  eventId: string;
  updateType:
    | "user_removed"
    | "user_moved"
    | "user_signed_up"
    | "user_cancelled"
    | "role_full"
    | "role_available";
  data: any;
  timestamp: string;
}

interface SocketEventHandlers {
  event_update?: (data: EventUpdate) => void;
  connected?: (data: { message: string; userId: string }) => void;
  [key: string]: ((data: any) => void) | undefined;
}

class SocketServiceFrontend {
  private socket: Socket | null = null;
  private eventHandlers: SocketEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentToken: string | null = null;
  private isConnecting = false;

  /**
   * Initialize socket connection with authentication
   */
  connect(token: string): void {
    // If we're already connecting or connected with the same token, don't reconnect
    if (
      this.isConnecting ||
      (this.socket?.connected && this.currentToken === token)
    ) {
      console.log(
        "📡 Socket already connected or connecting, skipping reconnection"
      );
      return;
    }

    // Clean up any existing disconnected socket
    if (this.socket && !this.socket.connected) {
      console.log("📡 Cleaning up disconnected socket");
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.currentToken = null;
    }

    this.isConnecting = true;
    this.currentToken = token;

    console.log("📡 Initializing new socket connection to:", SOCKET_URL);

    this.socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: false, // Allow Socket.IO to reuse connections when appropriate
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventHandlers = {};
    this.reconnectAttempts = 0;
    this.currentToken = null;
    this.isConnecting = false;
  }

  /**
   * Set up core socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("📡 Socket connected successfully");
      this.reconnectAttempts = 0;
      this.isConnecting = false;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("📡 Socket disconnected:", reason);
      this.isConnecting = false;
      if (reason === "io server disconnect") {
        // Server initiated disconnect, don't reconnect
        this.currentToken = null;
        return;
      }
      this.handleReconnect();
    });

    this.socket.on("connect_error", (error) => {
      console.error("📡 Socket connection error:", error.message);
      this.isConnecting = false;

      // Handle specific "Invalid namespace" error
      if (error.message && error.message.includes("Invalid namespace")) {
        console.error(
          "Invalid namespace error detected - this may be a development issue"
        );
        // Don't attempt reconnection for namespace errors as they indicate a configuration issue
        return;
      }

      this.handleReconnect();
    });

    // Handle authentication errors
    this.socket.on("auth_error", (error) => {
      console.error("🔌 Socket authentication error:", error);
      this.disconnect();
    });

    // Handle event updates
    this.socket.on("event_update", (data: EventUpdate) => {
      console.log("📡 Received event update:", data);
      if (this.eventHandlers.event_update) {
        this.eventHandlers.event_update(data);
      }
    });

    // Handle connection confirmation
    this.socket.on("connected", (data) => {
      console.log("📡 Socket connection confirmed:", data);
      if (this.eventHandlers.connected) {
        this.eventHandlers.connected(data);
      }
    });
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("🔌 Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(
        `🔌 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`
      );
      this.socket?.connect();
    }, delay);
  }

  /**
   * Join an event room for real-time updates
   */
  joinEventRoom(eventId: string): void {
    if (this.socket?.connected) {
      this.socket.emit("join_event_room", eventId);
      console.log(`📡 Joined event room: ${eventId}`);
    } else {
      console.warn(
        `📡 Cannot join event room ${eventId} - socket not connected`
      );
    }
  }

  /**
   * Leave an event room
   */
  leaveEventRoom(eventId: string): void {
    if (this.socket?.connected) {
      this.socket.emit("leave_event_room", eventId);
      console.log(`📡 Left event room: ${eventId}`);
    } else {
      console.warn(
        `📡 Cannot leave event room ${eventId} - socket not connected`
      );
    }
  }

  /**
   * Register event handler
   */
  on<K extends keyof SocketEventHandlers>(
    event: K,
    handler: SocketEventHandlers[K]
  ): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Remove event handler
   */
  off(event: keyof SocketEventHandlers): void {
    delete this.eventHandlers[event];
  }

  /**
   * Check if socket is connected
   */
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export const socketService = new SocketServiceFrontend();
export type { EventUpdate, SocketEventHandlers };

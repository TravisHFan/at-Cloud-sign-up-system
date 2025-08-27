import { io, Socket } from "socket.io-client";
import type { EventUpdate, ConnectedPayload } from "../types/realtime";

// For WebSocket connection, we need the base server URL, not the API path
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";
const SOCKET_URL = API_BASE_URL.replace("/api", "");

interface SocketEventHandlers {
  event_update?: (data: EventUpdate) => void;
  connected?: (data: ConnectedPayload) => void;
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
  private pendingRoomJoins: Set<string> = new Set(); // Track pending room joins
  private joinedRooms: Set<string> = new Set(); // Track successfully joined rooms
  private cleanupScheduled = false; // Prevent duplicate cleanup calls

  /**
   * Wait for socket to be connected
   */
  private async waitForConnection(maxWaitTime = 5000): Promise<boolean> {
    if (this.socket?.connected) {
      return true;
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkConnection = () => {
        if (this.socket?.connected) {
          resolve(true);
        } else if (Date.now() - startTime > maxWaitTime) {
          console.warn("📡 Socket connection timeout");
          resolve(false);
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
  }

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

    // Clean up any existing socket properly
    this.disconnect();

    this.isConnecting = true;
    this.currentToken = token;

    console.log("📡 Initializing new socket connection to:", SOCKET_URL);

    // Add a small delay to avoid rapid reconnections in React StrictMode
    setTimeout(() => {
      if (!this.isConnecting) return; // Connection was cancelled

      this.socket = io(SOCKET_URL, {
        auth: {
          token,
        },
        transports: ["websocket", "polling"],
        timeout: 20000,
        forceNew: true, // Force new connection to avoid stale socket reuse
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      this.setupEventListeners();
    }, 50); // Small delay to avoid rapid reconnections
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.cleanupScheduled) return; // Prevent duplicate cleanup
    this.cleanupScheduled = true;

    console.log("📡 Disconnecting socket service");

    if (this.socket) {
      // Leave all joined rooms before disconnecting
      this.joinedRooms.forEach((eventId) => {
        if (this.socket?.connected) {
          this.socket.emit("leave_event_room", eventId);
          console.log(`📡 Left event room during cleanup: ${eventId}`);
        }
      });

      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.eventHandlers = {};
    this.reconnectAttempts = 0;
    this.currentToken = null;
    this.isConnecting = false;
    this.pendingRoomJoins.clear();
    this.joinedRooms.clear();

    // Reset cleanup flag after a brief delay
    setTimeout(() => {
      this.cleanupScheduled = false;
    }, 100);
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

      // Join any pending rooms
      this.pendingRoomJoins.forEach((eventId) => {
        console.log(`📡 Joining pending event room: ${eventId}`);
        this.socket?.emit("join_event_room", eventId);
        this.joinedRooms.add(eventId); // Track joined rooms
      });
      this.pendingRoomJoins.clear();
    });

    this.socket.on("disconnect", (reason) => {
      console.log("📡 Socket disconnected:", reason);
      this.isConnecting = false;

      // Clear joined rooms on disconnect since we're no longer in them
      this.joinedRooms.clear();

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
    this.socket.on("connected", (data: ConnectedPayload) => {
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
  async joinEventRoom(eventId: string): Promise<void> {
    // Don't join if already in this room
    if (this.joinedRooms.has(eventId)) {
      console.log(`📡 Already in event room: ${eventId}`);
      return;
    }

    if (this.socket?.connected) {
      this.socket.emit("join_event_room", eventId);
      this.joinedRooms.add(eventId);
      console.log(`📡 Joined event room: ${eventId}`);
    } else if (this.socket && this.isConnecting) {
      // Socket is connecting, add to pending joins
      this.pendingRoomJoins.add(eventId);
      console.log(`📡 Queued event room join: ${eventId} (socket connecting)`);
    } else {
      // Try to wait for connection
      const connected = await this.waitForConnection();
      if (connected && !this.joinedRooms.has(eventId)) {
        this.socket?.emit("join_event_room", eventId);
        this.joinedRooms.add(eventId);
        console.log(`📡 Joined event room: ${eventId}`);
      } else if (!connected) {
        console.warn(
          `📡 Cannot join event room ${eventId} - socket not connected`
        );
      }
    }
  }

  /**
   * Leave an event room
   */
  leaveEventRoom(eventId: string): void {
    // Only attempt to leave if we were actually in the room
    if (!this.joinedRooms.has(eventId)) {
      console.log(`📡 Not in event room ${eventId}, skipping leave`);
      return;
    }

    if (this.socket?.connected) {
      this.socket.emit("leave_event_room", eventId);
      this.joinedRooms.delete(eventId);
      console.log(`📡 Left event room: ${eventId}`);
    } else {
      // Remove from tracking even if socket is disconnected
      this.joinedRooms.delete(eventId);
      console.log(
        `📡 Removed ${eventId} from joined rooms (socket disconnected)`
      );
    }

    // Also remove from pending joins if it's there
    this.pendingRoomJoins.delete(eventId);
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

  /**
   * Get current connection status
   */
  get connectionStatus(): {
    connected: boolean;
    connecting: boolean;
    joinedRooms: string[];
    pendingRooms: string[];
  } {
    return {
      connected: this.socket?.connected || false,
      connecting: this.isConnecting,
      joinedRooms: Array.from(this.joinedRooms),
      pendingRooms: Array.from(this.pendingRoomJoins),
    };
  }
}

// Export singleton instance
export const socketService = new SocketServiceFrontend();
export type { EventUpdate, SocketEventHandlers };

import { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import { useAuth } from "./useAuth";
import { authService } from "../services/api";
import toast from "react-hot-toast";

interface SocketState {
  connected: boolean;
  error: string | null;
  onlineUsers: string[];
}

export function useSocket() {
  const { currentUser } = useAuth();
  const socketRef = useRef<any>(null);
  const isRefreshingTokenRef = useRef(false);
  const [socketState, setSocketState] = useState<SocketState>({
    connected: false,
    error: null,
    onlineUsers: [],
  });

  // Function to attempt manual reconnection (since refresh token isn't implemented yet)
  const forceReconnect = useCallback(async () => {
    if (isRefreshingTokenRef.current) return false;

    isRefreshingTokenRef.current = true;

    try {
      console.log("🔄 Attempting manual reconnection...");

      // Clear existing socket
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Trigger reconnection by updating state
      setSocketState((prev) => ({ ...prev, error: null }));

      toast.success("Attempting to reconnect...", { duration: 3000 });

      return true;
    } catch (error) {
      console.error("❌ Manual reconnection failed:", error);
      return false;
    } finally {
      isRefreshingTokenRef.current = false;
    }
  }, []);

  // Function to attempt token refresh and reconnection (will fail until backend implements it)
  const refreshTokenAndReconnect = useCallback(async () => {
    if (isRefreshingTokenRef.current) return false;

    isRefreshingTokenRef.current = true;

    try {
      console.log("🔄 Attempting to refresh JWT token...");
      await authService.refreshToken();
      console.log("✅ Token refreshed successfully");

      // Clear existing socket
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Trigger reconnection by updating state
      setSocketState((prev) => ({ ...prev, error: null }));

      return true;
    } catch (error) {
      console.error("❌ Token refresh failed (not implemented yet):", error);
      // Fall back to manual logout/login message
      toast.error(
        "Session expired. Please log out and log back in to restore real-time updates.",
        {
          duration: 10000,
          icon: "🔐",
        }
      );
      return false;
    } finally {
      isRefreshingTokenRef.current = false;
    }
  }, []);

  // Connect to socket when user is authenticated
  useEffect(() => {
    if (currentUser && !socketRef.current) {
      const token = localStorage.getItem("authToken");

      console.log("🔐 WebSocket authentication debug:", {
        hasCurrentUser: !!currentUser,
        hasToken: !!token,
        tokenLength: token?.length,
        tokenStart: token?.substring(0, 20) + "...",
        currentUserId: currentUser.id,
      });

      if (!token) {
        console.error(
          "❌ No authentication token found for WebSocket connection"
        );
        setSocketState((prev) => ({
          ...prev,
          error: "No authentication token found",
        }));
        return;
      }

      const socketUrl =
        import.meta.env.VITE_API_URL?.replace("/api/v1", "") ||
        "http://localhost:5001";
      console.log("🔗 Attempting WebSocket connection to:", socketUrl);

      const socket = io(socketUrl, {
        auth: { token },
        transports: ["websocket", "polling"],
      });

      socketRef.current = socket;

      // Connection events
      socket.on("connect", () => {
        console.log("✅ WebSocket connected successfully");
        setSocketState((prev) => ({
          ...prev,
          connected: true,
          error: null,
        }));
      });

      socket.on("disconnect", () => {
        console.log("🔌 WebSocket disconnected");
        setSocketState((prev) => ({
          ...prev,
          connected: false,
        }));
      });

      socket.on("connect_error", async (error: Error) => {
        console.error("🔌 Socket connection error:", error);
        console.error("🔍 Error details:", {
          message: error.message,
          type: error.constructor.name,
          stack: error.stack,
        });

        // Check if it's an authentication error
        if (
          error.message.includes("Authentication") ||
          error.message.includes("signature")
        ) {
          console.warn(
            "🔐 JWT token appears to be invalid. Attempting automatic token refresh..."
          );

          // Try to refresh token automatically
          const refreshSuccess = await refreshTokenAndReconnect();

          if (!refreshSuccess) {
            toast.error(
              "Real-time updates unavailable. Please refresh the page or log out and log back in.",
              {
                duration: 8000,
                icon: "🔐",
              }
            );
          }
        }

        setSocketState((prev) => ({
          ...prev,
          error: error.message,
          connected: false,
        }));
      });

      // NOTE: Notification handling moved to NotificationContext.tsx to prevent duplicates
      // The NotificationContext will handle both toast notifications AND bell dropdown updates

      // User status updates
      socket.on("user_status_update", (data: any) => {
        // Update online users list
        setSocketState((prev) => ({
          ...prev,
          onlineUsers:
            data.status === "online"
              ? [
                  ...prev.onlineUsers.filter((id) => id !== data.userId),
                  data.userId,
                ]
              : prev.onlineUsers.filter((id) => id !== data.userId),
        }));
      });

      // System announcements
      socket.on("system_announcement", (announcement: any) => {
        toast(`${announcement.message} (${announcement.type})`, {
          duration: 7000,
        });
      });
    }

    return () => {
      if (socketRef.current) {
        // Remove all event listeners before disconnecting
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketState({
          connected: false,
          error: null,
          onlineUsers: [],
        });
      }
    };
  }, [currentUser, refreshTokenAndReconnect]);

  // Socket utility functions
  const joinEventUpdates = useCallback((eventId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("join_event_updates", eventId);
    }
  }, []);

  const leaveEventUpdates = useCallback((eventId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("leave_event_updates", eventId);
    }
  }, []);

  const updateStatus = useCallback((status: "online" | "away" | "busy") => {
    if (socketRef.current) {
      socketRef.current.emit("update_status", status);
    }
  }, []);

  // Event listeners
  const onEventUpdate = useCallback((callback: (update: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on("event_update", callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off("event_update", callback);
      }
    };
  }, []);

  const onNewNotification = useCallback(
    (callback: (notification: any) => void) => {
      if (socketRef.current) {
        socketRef.current.on("new_notification", callback);
      }
      return () => {
        if (socketRef.current) {
          socketRef.current.off("new_notification", callback);
        }
      };
    },
    []
  );

  return {
    socket: socketRef.current,
    connected: socketState.connected,
    error: socketState.error,
    onlineUsers: socketState.onlineUsers,

    // Connection management
    forceReconnect,

    // Event management
    joinEventUpdates,
    leaveEventUpdates,

    // User status
    updateStatus,

    // Event listeners
    onEventUpdate,
    onNewNotification,
  };
}

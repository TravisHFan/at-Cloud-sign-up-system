import { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import { useAuth } from "./useAuth";
import { authService } from "../services/api";
import { useToastReplacement } from "../contexts/NotificationModalContext";

interface SocketState {
  connected: boolean;
  error: string | null;
  onlineUsers: string[];
}

export function useSocket() {
  const { currentUser } = useAuth();

  // Make notification optional to prevent circular dependency
  let notification: any = null;
  try {
    notification = useToastReplacement();
  } catch (error) {
    // NotificationProvider not yet available, notifications will be disabled
    console.log(
      "Notifications not available in useSocket, running without them"
    );
  }

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
      // Clear existing socket
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Trigger reconnection by updating state
      setSocketState((prev) => ({ ...prev, error: null }));

      notification?.info("Attempting to reconnect to the server...", {
        title: "Reconnecting",
        autoCloseDelay: 3000,
        actionButton: {
          text: "Force Retry",
          onClick: () => forceReconnect(),
          variant: "secondary",
        },
      });

      return true;
    } catch (error) {
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
      await authService.refreshToken();

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
      // Fall back to manual logout/login message
      notification?.error(
        "Your session has expired. Please log out and log back in to restore real-time updates and notifications.",
        {
          title: "Session Expired",
          autoCloseDelay: 10000,
          actionButton: {
            text: "Logout Now",
            onClick: () => {
              // Navigate to logout - you can add proper logout logic here
              window.location.href = "/logout";
            },
            variant: "primary",
          },
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

      if (!token) {
        setSocketState((prev) => ({
          ...prev,
          error: "No authentication token found",
        }));
        return;
      }

      const socketUrl =
        import.meta.env.VITE_API_URL?.replace("/api/v1", "") ||
        "http://localhost:5001";

      const socket = io(socketUrl, {
        auth: { token },
        transports: ["websocket", "polling"],
        forceNew: true, // Ensure we always create a new connection
      });

      socketRef.current = socket;

      // Connection events
      socket.on("connect", () => {
        setSocketState((prev) => ({
          ...prev,
          connected: true,
          error: null,
        }));
      });

      socket.on("disconnect", () => {
        setSocketState((prev) => ({
          ...prev,
          connected: false,
        }));
      });

      socket.on("connect_error", async (error: Error) => {
        // Check if it's an authentication error
        if (
          error.message.includes("Authentication") ||
          error.message.includes("signature")
        ) {
          // Try to refresh token automatically
          const refreshSuccess = await refreshTokenAndReconnect();

          if (!refreshSuccess) {
            notification?.warning(
              "Real-time updates are currently unavailable. You may miss live notifications until the connection is restored.",
              {
                title: "Connection Issue",
                autoCloseDelay: 8000,
                actionButton: {
                  text: "Refresh Page",
                  onClick: () => window.location.reload(),
                  variant: "primary",
                },
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
        const notificationType =
          announcement.type === "urgent"
            ? "warning"
            : announcement.type === "info"
            ? "info"
            : "success";

        notification?.[notificationType](announcement.message, {
          title: `System ${announcement.type?.toUpperCase() || "ANNOUNCEMENT"}`,
          autoCloseDelay: 7000,
          actionButton: announcement.actionUrl
            ? {
                text: "View Details",
                onClick: () => window.open(announcement.actionUrl, "_blank"),
                variant: "secondary",
              }
            : undefined,
        });
      });
    }

    return () => {
      if (socketRef.current) {
        // Remove all event listeners before disconnecting
        socketRef.current.removeAllListeners();

        // Only disconnect if still connected or connecting
        if (socketRef.current.connected || socketRef.current.connecting) {
          socketRef.current.disconnect();
        }

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

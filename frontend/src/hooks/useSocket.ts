import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./useAuth";
import toast from "react-hot-toast";

interface SocketState {
  connected: boolean;
  error: string | null;
  onlineUsers: string[];
}

export function useSocket() {
  const { currentUser } = useAuth();
  const socketRef = useRef<any>(null);
  const [socketState, setSocketState] = useState<SocketState>({
    connected: false,
    error: null,
    onlineUsers: [],
  });

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

      const socket = io(
        import.meta.env.VITE_API_URL?.replace("/api/v1", "") ||
          "http://localhost:5001",
        {
          auth: { token },
          transports: ["websocket", "polling"],
        }
      );

      socketRef.current = socket;

      // Connection events
      socket.on("connect", () => {
        console.log("🔌 Connected to socket server");
        setSocketState((prev) => ({
          ...prev,
          connected: true,
          error: null,
        }));
      });

      socket.on("disconnect", () => {
        console.log("🔌 Disconnected from socket server");
        setSocketState((prev) => ({
          ...prev,
          connected: false,
        }));
      });

      socket.on("connect_error", (error) => {
        console.error("🔌 Socket connection error:", error);
        setSocketState((prev) => ({
          ...prev,
          error: error.message,
          connected: false,
        }));
      });

      // Real-time notifications
      socket.on("new_notification", (notification: any) => {
        toast.success(notification.title + ": " + notification.message, {
          duration: 5000,
        });
      });

      // User status updates
      socket.on("user_status_update", (data: any) => {
        console.log("User status update:", data);
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
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketState({
          connected: false,
          error: null,
          onlineUsers: [],
        });
      }
    };
  }, [currentUser]);

  // Socket utility functions
  const joinRoom = useCallback((roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("join_room", roomId);
    }
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("leave_room", roomId);
    }
  }, []);

  const sendMessage = useCallback(
    (roomId: string, message: string, attachments?: string[]) => {
      if (socketRef.current) {
        socketRef.current.emit("send_message", {
          chatRoomId: roomId,
          message,
          attachments,
        });
      }
    },
    []
  );

  const startTyping = useCallback((roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("typing_start", roomId);
    }
  }, []);

  const stopTyping = useCallback((roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("typing_stop", roomId);
    }
  }, []);

  const addReaction = useCallback(
    (messageId: string, roomId: string, reaction: string) => {
      if (socketRef.current) {
        socketRef.current.emit("message_reaction", {
          messageId,
          chatRoomId: roomId,
          reaction,
          action: "add",
        });
      }
    },
    []
  );

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

  // Message event listeners
  const onNewMessage = useCallback((callback: (message: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on("new_message", callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off("new_message", callback);
      }
    };
  }, []);

  const onUserTyping = useCallback((callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on("user_typing", callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off("user_typing", callback);
      }
    };
  }, []);

  const onMessageReaction = useCallback((callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on("message_reaction_update", callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off("message_reaction_update", callback);
      }
    };
  }, []);

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

  return {
    socket: socketRef.current,
    connected: socketState.connected,
    error: socketState.error,
    onlineUsers: socketState.onlineUsers,

    // Room management
    joinRoom,
    leaveRoom,

    // Messaging
    sendMessage,
    startTyping,
    stopTyping,
    addReaction,

    // Event management
    joinEventUpdates,
    leaveEventUpdates,

    // User status
    updateStatus,

    // Event listeners
    onNewMessage,
    onUserTyping,
    onMessageReaction,
    onEventUpdate,
  };
}

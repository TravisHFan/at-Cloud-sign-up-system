import { useCallback, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { EventUpdate } from "../types/realtime";

interface UseSocketOptions {
  baseUrl?: string;
  authToken?: string | null;
}

// Module-level singleton to share socket connection across all hook instances
let sharedSocket: Socket | null = null;
let connectionCount = 0;
let socketPromise: Promise<Socket> | null = null; // Track initialization promise

export function useSocket({ baseUrl, authToken }: UseSocketOptions = {}) {
  const [connected, setConnected] = useState(false);

  // Fallback to stored token if none provided
  // Check both 'token' and 'authToken' for backwards compatibility
  const token =
    authToken ??
    (typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("authToken")
      : null);

  // Use backend URL for socket connection, not frontend origin
  const backendUrl =
    import.meta.env.VITE_API_URL?.replace("/api", "") ||
    "http://localhost:5001";
  const url = baseUrl ?? import.meta.env.VITE_SOCKET_URL ?? backendUrl;

  const connect = useCallback((): Socket | null => {
    // If socket already exists, reuse it
    if (sharedSocket) {
      setConnected(sharedSocket.connected);
      return sharedSocket;
    }

    // If another instance is currently creating a socket, skip
    if (socketPromise) {
      return null;
    }

    if (!token) {
      // Don't attempt to connect without a token; avoids auth errors on public pages
      console.log("⚠️ No auth token available, skipping socket connection");
      return null;
    }

    // Create a promise to track initialization (prevents race conditions)
    socketPromise = new Promise<Socket>((resolve, reject) => {
      const s: Socket = io(url, {
        transports: ["polling", "websocket"],
        auth: { token },
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        autoConnect: true,
      });

      // Set sharedSocket immediately so other instances can find it
      sharedSocket = s;

      // Add timeout handler - match the socket config timeout
      const connectionTimeout = setTimeout(() => {
        console.error("⏱️ Socket.io connection timeout after 20 seconds");
        socketPromise = null;
      }, 20000);

      s.on("connect", () => {
        clearTimeout(connectionTimeout);
        socketPromise = null;
        resolve(s);
      });

      s.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
      });

      s.on("connect_error", (error) => {
        clearTimeout(connectionTimeout);
        console.error("Socket connection error:", error.message);
        socketPromise = null;
        sharedSocket = null;
        reject(error);
      });
    });

    return sharedSocket;
  }, [url, token]);

  const disconnect = useCallback(() => {
    if (!sharedSocket) return;

    connectionCount--;

    // NEVER actually disconnect the socket while any component might still need it
    // The socket will stay connected until the page unloads or explicit disconnect
    // This prevents issues with React Strict Mode double-mounting
    if (connectionCount <= 0) {
      // In production, you might want to disconnect here
      // For now, keep socket alive to handle React development mode
    }

    setConnected(sharedSocket?.connected ?? false);
  }, []);
  const onEventUpdate = useCallback(
    (handler: (update: EventUpdate) => void) => {
      const s = connect();
      if (!s) {
        // no-op cleanup when not connected
        return () => {};
      }
      s.on("event_update", handler as (payload: unknown) => void);
      return () => s.off("event_update", handler as (payload: unknown) => void);
    },
    [connect]
  );

  useEffect(() => {
    // Auto-connect only if we have a token and not already connected
    if (token && !sharedSocket) {
      connectionCount++;
      connect();
    } else if (sharedSocket) {
      // Just sync the connected state if socket already exists
      connectionCount++;
      setConnected(sharedSocket.connected);

      // Add listeners to this hook instance to stay synced with socket state
      const handleConnect = () => {
        setConnected(true);
      };

      const handleDisconnect = () => {
        setConnected(false);
      };

      sharedSocket.on("connect", handleConnect);
      sharedSocket.on("disconnect", handleDisconnect);

      return () => {
        sharedSocket?.off("connect", handleConnect);
        sharedSocket?.off("disconnect", handleDisconnect);
        disconnect();
      };
    }

    return () => {
      disconnect();
    };
    // Only re-run if token or url changes, not when callbacks change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, url]);

  const socket = sharedSocket;

  return {
    socket,
    connected,
    connect,
    disconnect,
    onEventUpdate,
  } as const;
}

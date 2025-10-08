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
  const token =
    authToken ??
    (typeof window !== "undefined" ? localStorage.getItem("authToken") : null);

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
      return null;
    }

    console.log("🔌 Connecting to Socket.io server at:", url);

    // Create a promise to track initialization (prevents race conditions)
    socketPromise = new Promise<Socket>((resolve) => {
      const s: Socket = io(url, {
        transports: ["polling"],
        auth: token ? { token } : undefined,
        withCredentials: true,
        upgrade: false,
      });

      // Set sharedSocket immediately so other instances can find it
      sharedSocket = s;
      socketPromise = null; // Clear the promise now that socket is set

      s.on("connect", () => {
        console.log("✅ Socket.io connected successfully");
        setConnected(true);
        resolve(s);
      });

      s.on("disconnect", () => {
        console.log("❌ Socket.io disconnected");
        setConnected(false);
      });

      s.on("connect_error", (error) => {
        console.error("🚨 Socket.io connection error:", error);
        socketPromise = null; // Clear on error to allow retry
      });
    });

    return sharedSocket;
  }, [url, token]);

  const disconnect = useCallback(() => {
    if (!sharedSocket) return;

    connectionCount--;
    if (connectionCount > 0) {
      // Other components still using the socket, don't disconnect
      return;
    }

    sharedSocket.disconnect();
    sharedSocket = null;
    setConnected(false);
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

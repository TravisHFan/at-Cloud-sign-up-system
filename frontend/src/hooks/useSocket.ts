import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { EventUpdate } from "../types/realtime";

interface UseSocketOptions {
  baseUrl?: string;
  authToken?: string | null;
}

export function useSocket({ baseUrl, authToken }: UseSocketOptions = {}) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
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
    if (socketRef.current) return socketRef.current;

    if (!token) {
      // Don't attempt to connect without a token; avoids auth errors on public pages
      console.log("ℹ️ Skipping socket connect: no auth token available");
      return null;
    }

    console.log("🔌 Attempting to connect to Socket.io server at:", url);

    const s: Socket = io(url, {
      transports: ["polling"],
      auth: token ? { token } : undefined,
      withCredentials: true,
      upgrade: false,
    });

    socketRef.current = s;

    s.on("connect", () => {
      console.log("✅ Socket.io connected successfully");
      setConnected(true);
    });

    s.on("disconnect", () => {
      console.log("❌ Socket.io disconnected");
      setConnected(false);
    });

    s.on("connect_error", (error) => {
      console.error("🚨 Socket.io connection error:", error);
    });

    return s;
  }, [url, token]);

  const disconnect = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.disconnect();
    socketRef.current = null;
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
    // Auto-connect only if we have a token
    if (token) {
      connect();
    }
    return () => disconnect();
  }, [connect, disconnect, token]);

  const socket = socketRef.current;

  return {
    socket,
    connected,
    connect,
    disconnect,
    onEventUpdate,
  } as const;
}

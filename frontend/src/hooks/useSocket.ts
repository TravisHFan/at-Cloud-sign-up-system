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

  const url =
    baseUrl ?? import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

  const connect = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s: Socket = io(url, {
      transports: ["websocket"],
      auth: authToken ? { token: authToken } : undefined,
      withCredentials: true,
    });
    socketRef.current = s;
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    return s;
  }, [url, authToken]);

  const disconnect = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);

  const onEventUpdate = useCallback(
    (handler: (update: EventUpdate) => void) => {
      const s = connect();
      s.on("event_update", handler as (payload: unknown) => void);
      return () => s.off("event_update", handler as (payload: unknown) => void);
    },
    [connect]
  );

  useEffect(() => {
    // Auto-connect on mount
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const socket = socketRef.current;

  return {
    socket,
    connected,
    connect,
    disconnect,
    onEventUpdate,
  } as const;
}

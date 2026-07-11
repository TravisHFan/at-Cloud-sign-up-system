import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventUpdate } from "../types/realtime";
import { SocketServiceFrontend } from "./socketService";

const fakeIo = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;

  class FakeSocket {
    connected = false;
    active = true;
    connectCalls = 0;
    disconnectCalls = 0;
    emitted: Array<{ event: string; args: unknown[] }> = [];
    private listeners = new Map<string, Set<Listener>>();

    on(event: string, listener: Listener) {
      const listeners = this.listeners.get(event) ?? new Set();
      listeners.add(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    off(event: string, listener?: Listener) {
      if (!listener) this.listeners.delete(event);
      else this.listeners.get(event)?.delete(listener);
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      this.emitted.push({ event, args });
      return this;
    }

    connect() {
      this.connectCalls += 1;
      this.active = true;
      return this;
    }

    disconnect() {
      this.disconnectCalls += 1;
      this.connected = false;
      this.active = false;
      return this;
    }

    removeAllListeners() {
      this.listeners.clear();
      return this;
    }

    serverEmit(event: string, ...args: unknown[]) {
      if (event === "connect") {
        this.connected = true;
        this.active = true;
      } else if (event === "disconnect") {
        this.connected = false;
      }

      Array.from(this.listeners.get(event) ?? []).forEach((listener) => {
        listener(...args);
      });
    }

    emittedCount(event: string) {
      return this.emitted.filter((entry) => entry.event === event).length;
    }
  }

  const sockets: FakeSocket[] = [];
  const io = vi.fn(() => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  });

  return { io, sockets };
});

vi.mock("socket.io-client", () => ({ io: fakeIo.io }));

describe("SocketServiceFrontend", () => {
  beforeEach(() => {
    vi.useRealTimers();
    fakeIo.io.mockClear();
    fakeIo.sockets.length = 0;
  });

  it("shares one connection and disconnects after the final consumer", () => {
    vi.useFakeTimers();
    const service = new SocketServiceFrontend();

    const releaseFirst = service.acquire("token", "https://socket.test");
    const releaseSecond = service.acquire("token", "https://socket.test");
    const socket = fakeIo.sockets[0];

    expect(fakeIo.io).toHaveBeenCalledTimes(1);
    expect(service.connectionStatus.consumers).toBe(2);

    releaseFirst();
    vi.runAllTimers();
    expect(socket.disconnectCalls).toBe(0);

    releaseSecond();
    vi.runAllTimers();
    expect(socket.disconnectCalls).toBe(1);
    expect(service.connectionStatus.consumers).toBe(0);
  });

  it("dispatches to multiple subscribers and removes only the requested one", () => {
    const service = new SocketServiceFrontend();
    service.connect("token", "https://socket.test");
    const socket = fakeIo.sockets[0];
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = service.on("event_update", first);
    service.on("event_update", second);

    const update: EventUpdate = {
      eventId: "event-1",
      updateType: "guest_updated",
      data: { roleId: "role-1", guestName: "Guest User" },
      timestamp: "2026-07-09T12:00:00.000Z",
    };

    socket.serverEmit("event_update", update);
    socket.serverEmit("event_update", update);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    stopFirst();
    socket.serverEmit("event_update", {
      ...update,
      timestamp: "2026-07-09T12:00:01.000Z",
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("reference-counts rooms and rejoins them after Socket.IO reconnects", async () => {
    const service = new SocketServiceFrontend();
    service.connect("token", "https://socket.test");
    const socket = fakeIo.sockets[0];

    await service.joinEventRoom("event-1");
    await service.joinEventRoom("event-1");
    expect(service.connectionStatus.pendingRooms).toEqual(["event-1"]);

    socket.serverEmit("connect");
    expect(socket.emittedCount("join_event_room")).toBe(1);

    service.leaveEventRoom("event-1");
    expect(socket.emittedCount("leave_event_room")).toBe(0);

    socket.serverEmit("disconnect", "transport close");
    expect(socket.connectCalls).toBe(0);
    socket.serverEmit("connect");
    expect(socket.emittedCount("join_event_room")).toBe(2);

    service.leaveEventRoom("event-1");
    expect(socket.emittedCount("leave_event_room")).toBe(1);
    expect(service.connectionStatus.joinedRooms).toEqual([]);
  });

  it("reattaches subscribers when authentication replaces the socket", () => {
    const service = new SocketServiceFrontend();
    const handler = vi.fn();
    service.on("user_update", handler);

    service.connect("first-token", "https://socket.test");
    const firstSocket = fakeIo.sockets[0];
    service.connect("second-token", "https://socket.test");
    const secondSocket = fakeIo.sockets[1];

    firstSocket.serverEmit("user_update", { userId: "old" });
    secondSocket.serverEmit("user_update", { userId: "current" });

    expect(firstSocket.disconnectCalls).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ userId: "current" });
  });
});

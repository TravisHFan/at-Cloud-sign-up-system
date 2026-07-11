import { vi } from "vitest";

vi.mock("socket.io-client", () => {
  type Listener = (...args: unknown[]) => void;

  class FakeSocket {
    connected = false;
    private listeners: Record<string, Listener[]> = {};

    on(event: string, callback: Listener) {
      (this.listeners[event] ||= []).push(callback);
    }

    off(event: string, callback?: Listener) {
      if (!callback) {
        delete this.listeners[event];
        return;
      }
      this.listeners[event] = (this.listeners[event] || []).filter(
        (listener) => listener !== callback,
      );
    }

    emit(_event: string, _payload?: unknown) {}
    connect() {}
    disconnect() {}

    removeAllListeners() {
      this.listeners = {};
    }
  }

  return { io: () => new FakeSocket(), Socket: FakeSocket };
});

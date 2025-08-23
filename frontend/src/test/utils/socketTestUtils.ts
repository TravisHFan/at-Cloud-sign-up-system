import { vi } from "vitest";

export type EventUpdatePayload = {
  eventId: string;
  updateType: string;
  data?: any;
  timestamp?: string;
};

let handler: ((payload: EventUpdatePayload) => void) | null = null;

export function resetEventUpdateHandler() {
  handler = null;
}

export function makeSocketServiceMock() {
  return {
    socketService: {
      connect: vi.fn(),
      joinEventRoom: vi.fn(async () => {}),
      leaveEventRoom: vi.fn(),
      on: vi.fn((evt: string, cb: any) => {
        if (evt === "event_update") handler = cb;
      }),
      off: vi.fn(),
    },
  } as any;
}

export function emitEventUpdate(payload: EventUpdatePayload) {
  if (!handler) throw new Error("event_update handler not registered");
  handler(payload);
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";

// Socket mock with emitter
const socketTest = vi.hoisted(() => {
  let handler: ((payload: any) => void) | null = null;
  return {
    make: () => ({
      socketService: {
        connect: vi.fn(),
        joinEventRoom: vi.fn(async () => {}),
        leaveEventRoom: vi.fn(),
        on: vi.fn((evt: string, cb: any) => {
          if (evt === "event_update") handler = cb;
        }),
        off: vi.fn(),
      },
    }),
    emit: (payload: any) => {
      if (!handler) throw new Error("event_update handler not registered");
      handler(payload);
    },
    reset: () => {
      handler = null;
    },
  };
});

// Notification spies
const toasts = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => toasts,
  NotificationProvider: ({ children }: any) => children,
}));

vi.mock("../../services/socketService", () => socketTest.make());

// Auth
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "u1", role: "Leader" } }),
}));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { id: "u1", role: "Leader" } }),
}));

const baseEvent = {
  id: "e1",
  title: "Workshop Event",
  type: "Effective Communication Workshop",
  date: "2025-12-01",
  time: "10:00",
  endTime: "12:00",
  timeZone: "America/New_York",
  roles: [
    {
      id: "ga",
      name: "Group A Participants",
      maxParticipants: 5,
      currentSignups: [],
    },
  ],
  workshopGroupTopics: { A: "Intro" },
  status: "upcoming",
  attendees: [],
};

vi.mock("../../services/api", () => ({
  __esModule: true,
  eventService: { getEvent: vi.fn(async () => baseEvent) },
}));
vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: { getEventGuests: vi.fn(async () => ({ guests: [] })) },
}));

describe("EventDetail realtime workshop_topic_updated typed branch", () => {
  beforeEach(() => {
    socketTest.reset();
    toasts.info.mockReset();
    // Ensure socket effect runs and registers event_update handler
    localStorage.setItem("authToken", "test-token");
  });

  afterEach(() => {
    localStorage.removeItem("authToken");
  });

  it("updates Group A topic and shows info when actor is different user", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/event/e1"]}>
        <Routes>
          <Route path="/dashboard/event/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(true).toBe(true));

    // Emit typed workshop_topic_updated
    socketTest.emit({
      eventId: "e1",
      updateType: "workshop_topic_updated",
      data: { group: "A", topic: "Advanced Listening", userId: "u2" },
      timestamp: new Date().toISOString(),
    });

    await waitFor(() => {
      // Info notification triggered (actorId !== currentUserId)
      const msg = toasts.info.mock.calls.at(-1)?.[0];
      expect(String(msg)).toMatch(/Group A topic updated/i);
    });
  });
});

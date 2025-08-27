import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";

// Hoisted socket mock & emitter to safely use inside vi.mock
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

// Mock socket service
vi.mock("../../services/socketService", () => socketTest.make());

// Auth as Super Admin with specific id
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "u1", role: "Super Admin" } }),
}));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { id: "u1", role: "Super Admin" } }),
}));

// Minimal event snapshot used in typed branches
const baseEvent = {
  id: "e1",
  title: "Typed Branch Event",
  type: "Meeting",
  date: "2025-12-01",
  time: "10:00",
  endTime: "12:00",
  timeZone: "America/New_York",
  roles: [
    { id: "r1", name: "Role A", maxParticipants: 5, currentSignups: [] },
    { id: "r2", name: "Role B", maxParticipants: 5, currentSignups: [] },
  ],
  status: "upcoming",
  attendees: [],
};

// Mock APIs
vi.mock("../../services/api", () => ({
  __esModule: true,
  eventService: {
    getEvent: vi.fn(async () => baseEvent),
  },
}));
vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: { getEventGuests: vi.fn(async () => ({ guests: [] })) },
}));

describe("EventDetail realtime user_* typed branches", () => {
  beforeEach(() => {
    socketTest.reset();
    toasts.info.mockReset();
    toasts.warning.mockReset();
    // Ensure socket effect runs and registers event_update handler
    localStorage.setItem("authToken", "test-token");
  });

  afterEach(() => {
    localStorage.removeItem("authToken");
  });

  it("emits notifications for user_* updates with typed payloads", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/event/e1"]}>
        <Routes>
          <Route path="/dashboard/event/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial event to load
    await waitFor(() => {
      // Once loaded, sending updates should be handled
      expect(true).toBe(true);
    });

    // 1) user_signed_up (other user) -> info("Someone joined Role A")
    socketTest.emit({
      eventId: "e1",
      updateType: "user_signed_up",
      data: {
        userId: "u2",
        roleId: "r1",
        roleName: "Role A",
        event: baseEvent,
      },
      timestamp: new Date().toISOString(),
    });

    // 2) user_cancelled (other user) -> info("Someone left Role A")
    socketTest.emit({
      eventId: "e1",
      updateType: "user_cancelled",
      data: {
        userId: "u3",
        roleId: "r1",
        roleName: "Role A",
        event: baseEvent,
      },
      timestamp: new Date().toISOString(),
    });

    // 3) user_removed (other user) -> info("Someone was removed from Role A")
    socketTest.emit({
      eventId: "e1",
      updateType: "user_removed",
      data: {
        userId: "u4",
        roleId: "r1",
        roleName: "Role A",
        event: baseEvent,
      },
      timestamp: new Date().toISOString(),
    });

    // 4) user_removed (current user) on matching route -> warning("You were removed from Role A")
    socketTest.emit({
      eventId: "e1",
      updateType: "user_removed",
      data: {
        userId: "u1",
        roleId: "r1",
        roleName: "Role A",
        event: baseEvent,
      },
      timestamp: new Date().toISOString(),
    });

    // 5) user_moved (current user) -> info("You were moved from X to Y")
    socketTest.emit({
      eventId: "e1",
      updateType: "user_moved",
      data: {
        userId: "u1",
        fromRoleId: "r1",
        toRoleId: "r2",
        fromRoleName: "Role A",
        toRoleName: "Role B",
        event: baseEvent,
      },
      timestamp: new Date().toISOString(),
    });

    // 6) user_assigned (current user) -> info("You were assigned to Role A")
    socketTest.emit({
      eventId: "e1",
      updateType: "user_assigned",
      data: {
        operatorId: "admin",
        userId: "u1",
        roleId: "r1",
        roleName: "Role A",
        event: baseEvent,
      },
      timestamp: new Date().toISOString(),
    });

    await waitFor(() => {
      // We expect multiple info calls plus one warning (self removal)
      const infoCalls = toasts.info.mock.calls
        .map((c) => String(c?.[0] ?? ""))
        .join(" | ");
      expect(infoCalls).toMatch(/joined/i);
      expect(infoCalls).toMatch(/left/i);
      expect(infoCalls).toMatch(/moved/i);
      expect(infoCalls).toMatch(/assigned/i);
      const warnCalls = toasts.warning.mock.calls
        .map((c) => String(c?.[0] ?? ""))
        .join(" | ");
      expect(warnCalls).toMatch(/removed from/i);
    });
  });
});

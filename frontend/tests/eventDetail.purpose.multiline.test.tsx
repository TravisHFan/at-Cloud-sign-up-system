import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import EventDetail from "../src/pages/EventDetail";

// Shared component & modal mocks
vi.mock("../src/components/common", () => ({
  __esModule: true,
  Icon: () => <span />,
  EventDeletionModal: () => null,
  ConfirmationModal: () => null,
  EditButton: ({ children }: any) => <button>{children}</button>,
}));
vi.mock("../src/components/share/ShareModal", () => ({
  ShareModal: () => null,
}));

// Router mock (EventDetail uses useParams/useNavigate/useLocation)
vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "evt1" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/events/evt1" }),
  Link: ({ children }: any) => <>{children}</>,
}));

// API service mock aligned with EventDetail import style
vi.mock("../src/services/api", () => ({
  eventService: {
    getEvent: async () => ({
      id: "evt1",
      title: "Multi Purpose Event",
      type: "Workshop",
      date: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600000).toISOString(),
      time: "09:00",
      endTime: "10:00",
      location: "Room 1",
      organizer: "Org",
      hostedBy: "@Cloud Marketplace Ministry",
      format: "In-Person",
      disclaimer: "",
      purpose: "First line\nSecond line\nThird line",
      roles: [],
      createdBy: { id: "u1", firstName: "Admin", lastName: "User" },
      createdAt: new Date().toISOString(),
    }),
    signUpForEvent: async () => ({}),
    cancelSignup: async () => ({}),
    removeUserFromRole: async () => ({}),
    moveGuestBetweenRoles: async () => ({}),
    moveUserBetweenRoles: async () => ({}),
    deleteEvent: async () => ({}),
    updateEvent: async () => ({}),
    publishEvent: async () => ({}),
    unpublishEvent: async () => ({}),
    assignUserToRole: async () => ({}),
    sendEventEmails: async () => ({}),
  },
}));

// Ancillary service stubs (some branches reference them)
vi.mock("../src/services/userService", () => ({
  __esModule: true,
  default: { getUser: async () => ({ id: "u1", role: "Administrator" }) },
}));
vi.mock("../src/services/programService", () => ({
  __esModule: true,
  default: { listPrograms: async () => [] },
}));
vi.mock("../src/services/shortLinkService", () => ({
  __esModule: true,
  default: { getShortLinks: async () => [] },
}));

// Auth context & hook
vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "u1",
      role: "Administrator",
      firstName: "Admin",
      lastName: "User",
      roleInAtCloud: "Leader",
      gender: "male",
      avatar: null,
      email: "admin@example.com",
      phone: "",
    },
    isAuthenticated: true,
  }),
}));
vi.mock("../src/hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "u1",
      role: "Administrator",
      firstName: "Admin",
      lastName: "User",
      roleInAtCloud: "Leader",
      gender: "male",
      avatar: null,
      email: "admin@example.com",
      phone: "",
    },
    isAuthenticated: true,
  }),
}));

// Notification & modal components that rely on contexts
vi.mock("../src/contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({ notify: () => {} }),
}));
vi.mock("../src/components/common/NameCardActionModal", () => ({
  __esModule: true,
  default: () => null,
}));

// (Icon already mocked above)

// Socket service full mock
vi.mock("../src/services/socketService", () => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    socketService: {
      connect: vi.fn(),
      joinEventRoom: vi.fn(async () => {}),
      leaveEventRoom: vi.fn(() => {}),
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        handlers[event] = cb;
      }),
      off: vi.fn((event: string) => {
        delete handlers[event];
      }),
      get isConnected() {
        return true;
      },
      connectionStatus: {
        connected: true,
        connecting: false,
        joinedRooms: [],
        pendingRooms: [],
      },
    },
  };
});

vi.stubGlobal("alert", () => {});

describe("EventDetail purpose multiline rendering", () => {
  it("preserves line breaks in purpose text", async () => {
    render(<EventDetail />);
    await screen.findByText(/Multi Purpose Event/);
    const purpose = await screen.findByTestId("event-detail-purpose");
    const text = purpose.textContent || "";
    expect(text).toContain("First line");
    expect(text).toContain("Second line");
    expect(text).toContain("Third line");
  });
});

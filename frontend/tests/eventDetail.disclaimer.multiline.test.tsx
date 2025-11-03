import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import EventDetail from "../src/pages/EventDetail";

// Core shared component & modal mocks (single definition)
vi.mock("../src/components/common", () => ({
  __esModule: true,
  Icon: () => <span />,
  EventDeletionModal: () => null,
  ConfirmationModal: () => null,
  EditButton: ({ children }: any) => <button>{children}</button>,
}));
vi.mock("../src/components/share/ShareModal", () => ({
  __esModule: true,
  default: () => null,
}));

// Mock extracted EventDetail components
vi.mock("../src/components/EventDetail/WorkshopGroupsSection", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../src/components/EventDetail/EventModals", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../src/components/EventDetail/EventRolesSection", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../src/components/EventDetail/FlyerDisplay", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../src/components/EventDetail/EventBasicDetails", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../src/components/EventDetail/EventHostAndPurpose", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../src/components/EventDetail/EventCapacityAndAgenda", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../src/components/EventDetail/EventHeader", () => ({
  __esModule: true,
  default: ({ event }: any) => (
    <div>
      <h1>{event?.title}</h1>
    </div>
  ),
}));

// Minimal mocks / stubs for dependencies the EventDetail page expects.
// We assume existing test utils provide context providers in other tests; for this focused
// multiline rendering test, we can stub the minimal shape needed.

// Mock react-router + location
vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "evt1" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/events/evt1" }),
  Link: ({ children }: any) => <>{children}</>,
  MemoryRouter: ({ children }: any) => <>{children}</>,
}));

// Mock components that internally use useAuth to avoid provider requirements
vi.mock("../src/components/common/NameCardActionModal", () => ({
  __esModule: true,
  default: () => null,
}));

// Mock auth context & re-exported hook (paths relative to tests directory)
vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "user1",
      role: "Super Admin",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      avatar: null,
      gender: "male",
      phone: "",
      roleInAtCloud: "Leader",
    },
    isAuthenticated: true,
  }),
}));
vi.mock("../src/hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "user1",
      role: "Super Admin",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      avatar: null,
      gender: "male",
      phone: "",
      roleInAtCloud: "Leader",
    },
    isAuthenticated: true,
  }),
}));

// Mock notification context (../contexts/NotificationModalContext)
vi.mock("../src/contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    notify: () => {},
  }),
}));

// Mock socket service (../services/socketService)
// Provide full interface used by EventDetail
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

// Mock API service used by EventDetail (../services/api)
vi.mock("../src/services/api", () => ({
  eventService: {
    getEvent: async () => ({
      id: "evt1",
      title: "Sample Event",
      type: "Workshop",
      date: new Date().toISOString(),
      endDate: new Date().toISOString(),
      time: "09:00",
      endTime: "10:00",
      location: "Room 1",
      organizer: "Org",
      hostedBy: "Org",
      format: "In-Person",
      disclaimer: "First line\nSecond line\nThird line",
      purpose: "Purpose line",
      roles: [],
      createdBy: { id: "user1", firstName: "Admin", lastName: "User" },
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

describe("EventDetail disclaimer multiline rendering", () => {
  it("renders disclaimer with preserved line breaks", async () => {
    render(<EventDetail />);
    // Wait for spinner (with class animate-spin) to disappear
    await screen.findByText(/Sample Event/);
    const disclaimer = await screen.findByTestId("event-detail-disclaimer");
    const text = disclaimer.textContent || "";
    expect(text).toContain("First line");
    expect(text).toContain("Second line");
    expect(text).toContain("Third line");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EditEvent from "../../pages/EditEvent";

// Toast mock (not directly needed but EditEvent uses notification)
const toasts = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};
vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => toasts,
  NotificationProvider: ({ children }: any) => children,
}));

// Auth
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "u1", role: "Administrator" } }),
}));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { id: "u1", role: "Administrator" } }),
}));

// API mocks
const getEventMock = vi.fn();
vi.mock("../../services/api", () => ({
  __esModule: true,
  eventService: {
    getEvent: (...args: any[]) => getEventMock(...args),
    getEventTemplates: vi.fn(async () => ({ templates: {} })),
    updateEvent: vi.fn(async () => ({})),
  },
  fileService: { uploadFile: vi.fn() },
  programService: {
    list: vi.fn(async () => []),
    getById: vi.fn(),
    listEvents: vi.fn(async () => []),
  },
  userService: {
    getUsers: vi.fn(async () => ({
      users: [
        {
          id: "u1",
          username: "u1",
          email: "u1@example.com",
          firstName: "User",
          lastName: "One",
          role: "Administrator",
          isAtCloudLeader: true,
          roleInAtCloud: "Administrator",
          avatar: null,
          gender: "female",
          phone: "555-0000",
          createdAt: new Date().toISOString(),
          emailVerified: true,
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalUsers: 1,
        hasNext: false,
        hasPrev: false,
      },
    })),
  },
  // Needed by useEventDataLoader hook
  roleTemplateService: {
    getAllRolesTemplates: vi.fn().mockResolvedValue({}),
  },
  purchaseService: {
    checkProgramAccess: vi.fn().mockResolvedValue({ hasAccess: true }),
  },
}));

// Helper for a minimal public role
const publicRole = {
  id: "role-1",
  name: "Participant",
  description: "Test role",
  maxParticipants: 10,
  currentSignups: [],
  openToPublic: true,
};

// Provide baseline published Online event missing location so switching to Hybrid triggers warning
const baseEvent = {
  id: "e1",
  title: "Published Online Event",
  type: "Meeting",
  date: "2025-12-01",
  endDate: "2025-12-01",
  time: "10:00",
  endTime: "11:00",
  timeZone: "America/New_York",
  organizer: "u1",
  roles: [publicRole],
  signedUp: 0,
  totalSlots: 0,
  createdBy: { id: "u1" },
  createdAt: new Date().toISOString(),
  format: "Online",
  publish: true,
  publishedAt: new Date().toISOString(),
  zoomLink: "https://zoom.us/j/123",
  meetingId: "123456",
  passcode: "abc",
  location: "",
};

// Second event where switching to In-person should NOT warn (location present)
const baseHybridEvent = {
  ...baseEvent,
  title: "Hybrid With Location",
  format: "Hybrid Participation",
  location: "123 Main St",
};

beforeEach(() => {
  getEventMock.mockReset();
});

describe("EditEvent format switch predictive warning", () => {
  it("shows warning when switching published Online -> Hybrid with missing Location", async () => {
    getEventMock.mockResolvedValueOnce(baseEvent);

    render(
      <MemoryRouter initialEntries={["/dashboard/event/edit/e1"]}>
        <Routes>
          <Route path="/dashboard/event/edit/:id" element={<EditEvent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(getEventMock).toHaveBeenCalled());

    const formatSelect = screen.getByLabelText(/Format/i) as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { value: "Hybrid Participation" },
    });

    await waitFor(() => {
      const warning = screen.getByTestId("format-switch-warning");
      expect(warning).toBeInTheDocument();
      expect(warning).toHaveTextContent(
        /automatically unpublished after 48 hours/i
      );
      // Scoped check for Location inside the warning banner (avoid label/validation duplicates)
      expect(warning).toHaveTextContent(/Location/i);
    });
  });

  it("does NOT show warning when switching published Hybrid -> In-person and Location present", async () => {
    getEventMock.mockResolvedValueOnce(baseHybridEvent);

    render(
      <MemoryRouter initialEntries={["/dashboard/event/edit/e1"]}>
        <Routes>
          <Route path="/dashboard/event/edit/:id" element={<EditEvent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(getEventMock).toHaveBeenCalled());

    const formatSelect = screen.getByLabelText(/Format/i) as HTMLSelectElement;
    fireEvent.change(formatSelect, { target: { value: "In-person" } });

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("format-switch-warning")).toBeNull();
  });

  it("does NOT show warning when switching formats if event not published", async () => {
    // Same as baseEvent but publish=false
    getEventMock.mockResolvedValueOnce({ ...baseEvent, publish: false });

    render(
      <MemoryRouter initialEntries={["/dashboard/event/edit/e1"]}>
        <Routes>
          <Route path="/dashboard/event/edit/:id" element={<EditEvent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(getEventMock).toHaveBeenCalled());

    const formatSelect = screen.getByLabelText(/Format/i) as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { value: "Hybrid Participation" },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("format-switch-warning")).toBeNull();
  });
});

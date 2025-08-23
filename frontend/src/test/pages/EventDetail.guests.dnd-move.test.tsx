import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  }),
  NotificationProvider: ({ children }: any) => children,
}));

vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    joinEventRoom: vi.fn(async () => {}),
    leaveEventRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// EventDetail imports useAuth from hooks wrapper, so mock that module
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "admin", role: "Super Admin" } }),
}));

// Some child components import useAuth directly from contexts/AuthContext
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { id: "admin", role: "Super Admin" } }),
}));

// Use hoisted factory-safe mocks to avoid referencing top-level variables inside vi.mock
const apiMocks = vi.hoisted(() => ({
  moveGuestBetweenRoles: vi.fn(async () => ({ id: "e1", roles: [] })),
}));

vi.mock("../../services/api", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    __esModule: true,
    ...actual,
    eventService: {
      ...(actual.eventService || {}),
      getEvent: vi.fn(async (id: string) => ({
        id,
        title: "DnD Event",
        type: "Meeting",
        date: "2025-12-01",
        time: "10:00",
        endTime: "12:00",
        timeZone: "America/New_York",
        roles: [
          { id: "r1", name: "Role A", maxParticipants: 2, currentSignups: [] },
          { id: "r2", name: "Role B", maxParticipants: 2, currentSignups: [] },
        ],
        status: "upcoming",
        attendees: [],
      })),
      moveGuestBetweenRoles: apiMocks.moveGuestBetweenRoles,
      moveUserBetweenRoles: vi.fn(),
      assignUserToRole: vi.fn(),
    },
  } as any;
});

vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    getEventGuests: vi.fn(async () => ({
      guests: [
        { id: "g1", roleId: "r1", fullName: "Alpha Guest" },
        { id: "g2", roleId: "r2", fullName: "Beta Guest" },
      ],
    })),
  },
}));

describe("EventDetail admin guest drag-and-drop", () => {
  it("allows moving a guest between roles via drag-and-drop", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() =>
      expect(screen.getByText(/DnD Event/)).toBeInTheDocument()
    );

    // Enable Manage Sign-ups mode so drag/drop handlers are active
    const manageBtn = screen.getByRole("button", { name: /manage sign-ups/i });
    fireEvent.click(manageBtn);

    const adminListR1 = await screen.findByTestId("admin-guests-r1");
    const guestCard = within(adminListR1).getByTestId("admin-guest-g1");

    // Simulate HTML5 DnD
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(type: string, val: string) {
        this.data[type] = val;
      },
      getData(type: string) {
        return this.data[type];
      },
      dropEffect: "move",
      effectAllowed: "move",
    } as any;

    fireEvent.dragStart(guestCard, { dataTransfer });
    const targetRole = screen.getByText(/Role B/).closest("div");
    if (!targetRole) throw new Error("target role container not found");
    fireEvent.dragOver(targetRole, { dataTransfer });
    fireEvent.drop(targetRole, { dataTransfer });

    await waitFor(() =>
      expect(apiMocks.moveGuestBetweenRoles).toHaveBeenCalled()
    );
    expect(apiMocks.moveGuestBetweenRoles).toHaveBeenCalledWith(
      "e1",
      "g1",
      "r1",
      "r2"
    );
  });
});

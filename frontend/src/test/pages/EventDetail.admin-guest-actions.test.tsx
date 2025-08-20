import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";
import guestApi from "../../services/guestApi";

// Mock guest API with admin actions (use factory without external refs; access via imported guestApi)
vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    getEventGuests: vi.fn(),
    resendManageLink: vi.fn(),
    adminCancelGuest: vi.fn(),
    adminUpdateGuest: vi.fn(),
  },
}));

// Mock event service
vi.mock("../../services/api", () => ({
  __esModule: true,
  eventService: {
    getEvent: vi.fn(async (id: string) => ({
      id,
      title: "Test Event",
      type: "Meeting",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      timeZone: "America/New_York",
      roles: [
        { id: "r1", name: "Role A", maxParticipants: 2, currentSignups: [] },
      ],
      totalSignups: 0,
      totalSlots: 2,
      createdBy: { id: "u1" },
      createdAt: new Date().toISOString(),
      description: "desc",
      isHybrid: false,
      status: "upcoming",
      attendees: [],
    })),
  },
}));

// Mock auth as admin
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "admin",
      role: "Administrator",
      roleInAtCloud: "Administrator",
    },
  }),
}));

// Mock notifications
const toastSpies = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};
vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => toastSpies,
  NotificationProvider: ({ children }: any) => children,
}));

// Mock sockets
vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    joinEventRoom: vi.fn(async () => {}),
    leaveEventRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

describe("EventDetail - Admin guest actions", () => {
  beforeEach(() => {
    toastSpies.success.mockReset();
    toastSpies.error.mockReset();
    (guestApi.adminCancelGuest as any).mockClear();
    (guestApi.adminUpdateGuest as any).mockClear();
    (guestApi.getEventGuests as any).mockClear();
    (guestApi.getEventGuests as any).mockResolvedValue({
      guests: [
        {
          id: "g1",
          roleId: "r1",
          fullName: "Alpha Guest",
          email: "a@e.com",
          phone: "+1 555",
        },
      ],
    });
  });

  it("cancels a guest and removes it from the list after confirm", async () => {
    render(
      <MemoryRouter initialEntries={["/events/e1"]}>
        <Routes>
          <Route path="/events/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );
    expect(screen.getByText("Alpha Guest")).toBeInTheDocument();

    const btn = screen.getByRole("button", { name: /Cancel Guest/i });
    fireEvent.click(btn);
    // Confirm via modal
    const confirm = await screen.findByRole("button", { name: /Yes, cancel/i });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(guestApi.adminCancelGuest).toHaveBeenCalledWith("g1")
    );
    // After optimistic removal, guest should no longer be visible
    await waitFor(() =>
      expect(screen.queryByText("Alpha Guest")).not.toBeInTheDocument()
    );
    expect(toastSpies.success).toHaveBeenCalled();
  });

  it("edits a guest and updates the displayed name", async () => {
    render(
      <MemoryRouter initialEntries={["/events/e1"]}>
        <Routes>
          <Route path="/events/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );
    expect(screen.getByText("Alpha Guest")).toBeInTheDocument();

    const edit = screen.getByRole("button", { name: /Edit Guest/i });
    fireEvent.click(edit);
    // Fill modal inputs
    const nameInput = await screen.findByLabelText(/Full name/i);
    fireEvent.change(nameInput, { target: { value: "Bravo Guest" } });
    const phoneInput = await screen.findByLabelText(/Phone/i);
    fireEvent.change(phoneInput, { target: { value: "+1 777" } });
    const saveBtn = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveBtn);

    await waitFor(() =>
      expect(guestApi.adminUpdateGuest).toHaveBeenCalledWith("g1", {
        fullName: "Bravo Guest",
        phone: "+1 777",
      })
    );

    // Now the updated name should be shown
    await waitFor(() =>
      expect(screen.getByText("Bravo Guest")).toBeInTheDocument()
    );
  });

  it("shows error and rolls back UI when cancel API fails", async () => {
    // open cancel modal, then confirm inside modal

    render(
      <MemoryRouter initialEntries={["/events/e1"]}>
        <Routes>
          <Route path="/events/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );
    expect(screen.getByText("Alpha Guest")).toBeInTheDocument();

    // Make cancel fail
    (guestApi.adminCancelGuest as any).mockRejectedValueOnce(
      new Error("Cancel failed")
    );

    const btn = screen.getByRole("button", { name: /Cancel Guest/i });
    fireEvent.click(btn);
    const confirm = await screen.findByRole("button", { name: /Yes, cancel/i });
    fireEvent.click(confirm);

    // Should have attempted API
    await waitFor(() =>
      expect(guestApi.adminCancelGuest).toHaveBeenCalledWith("g1")
    );

    // UI should roll back and still show the guest
    expect(screen.getByText("Alpha Guest")).toBeInTheDocument();
    expect(toastSpies.error).toHaveBeenCalled();
  });
});

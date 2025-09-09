import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

// Mock guest API with resendManageLink
vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    getEventGuests: vi.fn(async () => ({
      guests: [
        {
          id: "g1",
          roleId: "r1",
          fullName: "Alpha Guest",
          email: "a@e.com",
          phone: "+1 555",
        },
      ],
    })),
    resendManageLink: vi.fn(async (_id: string) => {}),
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

// Mock notifications with shared spies so we can assert on calls
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

// Mock socket service wiring
vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    joinEventRoom: vi.fn(async () => {}),
    leaveEventRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

describe("EventDetail - Re-send manage link", () => {
  beforeEach(() => {
    toastSpies.success.mockReset();
    toastSpies.error.mockReset();
    toastSpies.info.mockReset();
    toastSpies.warning.mockReset();
    // Also reset API mock call counts between tests
    import("../../services/guestApi").then((api) => {
      (api.default as any).resendManageLink?.mockReset?.();
    });
  });

  it("shows button for admins and calls API after confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

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
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );

    const btn = screen.getByRole("button", { name: /Re-send manage link/i });
    fireEvent.click(btn);

    const api = await import("../../services/guestApi");
    await waitFor(() => {
      expect((api.default as any).resendManageLink).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({ eventId: "e1" })
      );
    });

    confirmSpy.mockRestore();
  });

  it("shows error toast when API fails (e.g., 400)", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

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
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );

    const api = await import("../../services/guestApi");
    const err: any = new Error(
      "Cannot re-send link for cancelled registration"
    );
    err.status = 400;
    (api.default as any).resendManageLink.mockRejectedValueOnce(err);

    const btn = screen.getByRole("button", { name: /Re-send manage link/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(toastSpies.error).toHaveBeenCalled();
    });

    confirmSpy.mockRestore();
  });

  it("does nothing when admin cancels confirmation dialog", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

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
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );

    const api = await import("../../services/guestApi");
    const btn = screen.getByRole("button", { name: /Re-send manage link/i });
    fireEvent.click(btn);

    await new Promise((r) => setTimeout(r, 50));
    expect((api.default as any).resendManageLink).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("shows not-found error toast when API responds 404", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

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
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );

    const api = await import("../../services/guestApi");
    const err: any = new Error("Guest registration not found");
    err.status = 404;
    (api.default as any).resendManageLink.mockRejectedValueOnce(err);

    const btn = screen.getByRole("button", { name: /Re-send manage link/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(toastSpies.error).toHaveBeenCalled();
    });

    confirmSpy.mockRestore();
  });
});

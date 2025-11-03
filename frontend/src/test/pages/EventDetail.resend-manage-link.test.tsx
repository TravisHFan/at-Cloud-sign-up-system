import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import { GuestApi } from "../../services/guestApi";

// Mock extracted EventDetail components (except EventRolesSection and EventModals which contain guest UI and modals)
vi.mock("../../components/EventDetail/WorkshopGroupsSection", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../../components/EventDetail/FlyerDisplay", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../../components/EventDetail/EventBasicDetails", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../../components/EventDetail/EventHostAndPurpose", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../../components/EventDetail/EventCapacityAndAgenda", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../../components/EventDetail/EventHeader", () => ({
  __esModule: true,
  default: ({ event }: any) => (
    <div>
      <h1>{event?.title}</h1>
    </div>
  ),
}));

// Mock guest API with resendManageLink
vi.mock("../../services/guestApi", () => {
  const mock = {
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
    resendManageLink: vi.fn(async (_id: string) => ({ success: true })),
  };
  return {
    __esModule: true,
    default: mock,
    GuestApi: mock,
  };
});

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
    (GuestApi.resendManageLink as any)?.mockReset?.();
  });

  it("shows button for admins and calls API after confirm", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Enter management mode first
    const manageButton = await screen.findByRole("button", {
      name: /Manage Sign-ups/i,
    });
    fireEvent.click(manageButton);

    await waitFor(() =>
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );

    const btn = screen.getByRole("button", { name: /Re-send manage link/i });
    fireEvent.click(btn);

    // Click the modal confirmation button
    const confirmBtn = await screen.findByRole("button", {
      name: /Yes, Send Link/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(GuestApi.resendManageLink).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({ eventId: "e1" })
      );
    });
  });

  it("shows error toast when API fails (e.g., 400)", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Enter management mode
    const manageButton = await screen.findByRole("button", {
      name: /Manage Sign-ups/i,
    });
    fireEvent.click(manageButton);

    await waitFor(() =>
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );

    const err: any = new Error(
      "Cannot re-send link for cancelled registration"
    );
    err.status = 400;
    (GuestApi.resendManageLink as any).mockRejectedValueOnce(err);

    const btn = screen.getByRole("button", { name: /Re-send manage link/i });
    fireEvent.click(btn);

    // Click modal confirmation
    const confirmBtn = await screen.findByRole("button", {
      name: /Yes, Send Link/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toastSpies.error).toHaveBeenCalled();
    });
  });

  it("does nothing when admin cancels confirmation dialog", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Enter management mode
    const manageButton = await screen.findByRole("button", {
      name: /Manage Sign-ups/i,
    });
    fireEvent.click(manageButton);

    await waitFor(() =>
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );

    const btn = screen.getByRole("button", { name: /Re-send manage link/i });
    fireEvent.click(btn);

    // Wait for modal to appear
    await screen.findByText(/Send a fresh manage link/i);

    // Click cancel in modal (find button inside the modal)
    const modal = screen
      .getByText(/Send a fresh manage link/i)
      .closest("div[class*='bg-white']");
    const cancelBtn = within(modal as HTMLElement).getByRole("button", {
      name: /Cancel/i,
    });
    fireEvent.click(cancelBtn);

    await new Promise((r) => setTimeout(r, 50));
    expect(GuestApi.resendManageLink).not.toHaveBeenCalled();
  });

  it("shows not-found error toast when API responds 404", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Enter management mode
    const manageButton = await screen.findByRole("button", {
      name: /Manage Sign-ups/i,
    });
    fireEvent.click(manageButton);

    await waitFor(() =>
      expect(screen.getByText(/Guests:/i)).toBeInTheDocument()
    );

    const err: any = new Error("Guest registration not found");
    err.status = 404;
    (GuestApi.resendManageLink as any).mockRejectedValueOnce(err);

    const btn = screen.getByRole("button", { name: /Re-send manage link/i });
    fireEvent.click(btn);

    // Click modal confirmation
    const confirmBtn = await screen.findByRole("button", {
      name: /Yes, Send Link/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toastSpies.error).toHaveBeenCalled();
    });
  });
});

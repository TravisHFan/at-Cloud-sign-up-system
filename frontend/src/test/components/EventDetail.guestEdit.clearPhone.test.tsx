import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventDetail from "../../pages/EventDetail";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

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

// Mock useAuth to provide a Super Admin user
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "admin", role: "Super Admin" } }),
}));
vi.mock("../../contexts/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../contexts/AuthContext")
  >();
  return {
    ...actual,
    useAuth: () => ({ currentUser: { id: "admin", role: "Super Admin" } }),
  };
});

// 1) Mock API: eventService.getEvent only; keep other exports intact
vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return {
    __esModule: true,
    ...actual,
    eventService: {
      ...actual.eventService,
      getEvent: vi.fn().mockResolvedValue({
        id: "e1",
        title: "Test Event",
        type: "Meeting",
        format: "Online",
        date: "2025-08-10",
        endTime: "11:00",
        time: "10:00",
        location: "Zoom",
        organizer: "Org Team",
        purpose: "",
        roles: [
          {
            id: "r1",
            name: "Role A",
            description: "",
            maxParticipants: 5,
            currentSignups: [],
          },
        ],
        signedUp: 0,
        totalSlots: 5,
        createdBy: "u1",
        createdAt: new Date().toISOString(),
      }),
    },
  };
});

// 2) Mock GuestApi used in EventDetail
const mockGuestsState = {
  guests: [
    {
      id: "g1",
      roleId: "r1",
      fullName: "Guest One",
      email: "g1@example.com",
      phone: "+1 555 111 2222",
    },
  ],
};

vi.mock("../../services/guestApi", () => {
  const mockApi = {
    adminUpdateGuest: vi.fn().mockImplementation(async (guestId, payload) => {
      // Update the mock state when phone is cleared
      const guest = mockGuestsState.guests.find((g) => g.id === guestId);
      if (guest && payload.phone !== undefined) {
        guest.phone = payload.phone;
      }
      return { success: true };
    }),
    getEventGuests: vi.fn().mockImplementation(async (eventId) => {
      console.log(`getEventGuests called with eventId: ${eventId}`);
      console.log("Returning guests:", mockGuestsState.guests);
      return { guests: mockGuestsState.guests };
    }),
  };
  return {
    __esModule: true,
    GuestApi: mockApi,
    default: mockApi,
  };
});

import { GuestApi } from "../../services/guestApi";

// 3) Mock socketService used in EventDetail
vi.mock("../../services/socketService", () => ({
  __esModule: true,
  socketService: {
    connect: vi.fn(),
    joinEventRoom: vi.fn(),
    leaveEventRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// 4) Mock GuestEditModal to present a Save button that calls onSave with empty phone
vi.mock("../../components/common/GuestEditModal", () => ({
  __esModule: true,
  default: ({ isOpen, initialName, initialPhone, onSave }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="guest-edit-modal">
        <input aria-label="name" defaultValue={initialName} />
        <input aria-label="phone" defaultValue={initialPhone} />
        <button
          data-testid="guest-edit-save-button"
          onClick={async () => {
            await onSave({ fullName: initialName, phone: "" });
          }}
        >
          Save
        </button>
      </div>
    );
  },
}));

// 5) Mock NotificationModalContext to track success/error calls
const mockNotification = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock("../../contexts/NotificationModalContext", async (importActual) => {
  const actual = await importActual<
    typeof import("../../contexts/NotificationModalContext")
  >();
  return {
    __esModule: true,
    ...actual,
    useToastReplacement: () => mockNotification,
  };
});

// 6) Pin useParams to provide event id
vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return {
    __esModule: true,
    ...actual,
    useParams: () => ({ id: "e1" }),
  };
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

describe("EventDetail - Edit Guest clears phone", () => {
  it("persists cleared phone and hides phone in UI", async () => {
    render(
      <Wrapper>
        <EventDetail />
      </Wrapper>
    );

    // Wait for event to load
    await waitFor(() =>
      expect(screen.getByText("Test Event")).toBeInTheDocument()
    );

    // Check if getEventGuests was called
    console.log(
      "getEventGuests call count:",
      (GuestApi.getEventGuests as any).mock.calls.length
    );

    // Enter management mode first
    const manageButton = await screen.findByRole("button", {
      name: /Manage Sign-ups/i,
    });
    fireEvent.click(manageButton);

    // Wait for initial guest render with phone visible
    await waitFor(() =>
      expect(screen.getByText("Guest One")).toBeInTheDocument()
    );
    // Phone appears in two places (slot list and admin list); ensure present
    expect(screen.getAllByText("+1 555 111 2222").length).toBeGreaterThan(0);

    // Open edit and save with empty phone
    const editButtons = screen.getAllByText("Edit Guest");
    await userEvent.click(editButtons[0]);

    // Wait for modal to open
    await waitFor(() =>
      expect(screen.getByTestId("guest-edit-modal")).toBeInTheDocument()
    );

    const saveButton = screen.getByTestId("guest-edit-save-button");
    await userEvent.click(saveButton);

    // Debug: Check if notification.error was called
    if (mockNotification.error.mock.calls.length > 0) {
      console.log("ERROR NOTIFICATION:", mockNotification.error.mock.calls[0]);
    }

    // Wait for modal to close
    await waitFor(() =>
      expect(screen.queryByTestId("guest-edit-modal")).not.toBeInTheDocument()
    );

    // UI should no longer display the phone number
    await waitFor(
      () => {
        expect(screen.queryAllByText("+1 555 111 2222")).toHaveLength(0);
      },
      { timeout: 5000 }
    );

    // Ensure API called with empty phone string
    expect((GuestApi as any).adminUpdateGuest).toHaveBeenCalled();
    const payloadArg = (GuestApi as any).adminUpdateGuest.mock.calls[0]?.[1];
    expect(payloadArg).toMatchObject({ phone: "" });
  });
});

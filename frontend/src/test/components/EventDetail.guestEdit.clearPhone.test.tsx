import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventDetail from "../../pages/EventDetail";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

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
vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    adminUpdateGuest: vi.fn().mockResolvedValue({ success: true }),
    getEventGuests: vi.fn().mockResolvedValue({
      guests: [
        {
          id: "g1",
          roleId: "r1",
          fullName: "Guest One",
          email: "g1@example.com",
          phone: "+1 555 111 2222",
        },
      ],
    }),
  },
}));

import GuestApi from "../../services/guestApi";

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
      <div>
        <input aria-label="name" defaultValue={initialName} />
        <input aria-label="phone" defaultValue={initialPhone} />
        <button onClick={() => onSave({ fullName: initialName, phone: "" })}>
          Save
        </button>
      </div>
    );
  },
}));

// 5) Pin useParams to provide event id
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

    // Wait for initial guest render with phone visible
    await waitFor(() =>
      expect(screen.getByText("Guest One")).toBeInTheDocument()
    );
    // Phone appears in two places (slot list and admin list); ensure present
    expect(screen.getAllByText("+1 555 111 2222").length).toBeGreaterThan(0);

    // Open edit and save with empty phone
    const editButtons = screen.getAllByText("Edit Guest");
    await userEvent.click(editButtons[0]);
    await userEvent.click(screen.getByText("Save"));

    // UI should no longer display the phone number
    await waitFor(() => {
      expect(screen.queryAllByText("+1 555 111 2222")).toHaveLength(0);
    });

    // Ensure API called with empty phone string
    expect((GuestApi as any).adminUpdateGuest).toHaveBeenCalled();
    const payloadArg = (GuestApi as any).adminUpdateGuest.mock.calls[0]?.[1];
    expect(payloadArg).toMatchObject({ phone: "" });
  });
});

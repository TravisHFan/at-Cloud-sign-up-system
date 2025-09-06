import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EventDetail from "../../pages/EventDetail";
import { eventService } from "../../services/api";

vi.mock("../../services/api", () => ({
  eventService: {
    getEvent: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useParams: () => ({ id: "evt-auth" }),
  };
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("EventDetail - participant System Authorization Level display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows each participant's actual system authorization level (fallback to user.role when needed)", async () => {
    vi.mocked(eventService.getEvent).mockResolvedValue({
      id: "evt-auth",
      title: "Role Mix",
      type: "Conference",
      format: "In-person",
      date: "2025-01-01",
      endDate: "2025-01-01",
      time: "10:00",
      endTime: "12:00",
      location: "Hall A",
      organizer: "Org Team",
      purpose: "",
      roles: [
        {
          id: "r1",
          name: "Speakers",
          description: "",
          maxParticipants: 10,
          // Backend provides registrations; first user only has role, second has systemAuthorizationLevel
          registrations: [
            {
              user: {
                id: "u1",
                username: "alice",
                firstName: "Alice",
                lastName: "Admin",
                email: "a@example.com",
                role: "Administrator",
                avatar: undefined,
                gender: "female",
              },
              registeredAt: new Date().toISOString(),
              notes: "A",
            },
            {
              user: {
                id: "u2",
                username: "bob",
                firstName: "Bob",
                lastName: "Leader",
                email: "b@example.com",
                systemAuthorizationLevel: "Leader",
                avatar: undefined,
                gender: "male",
              },
              registeredAt: new Date().toISOString(),
              notes: "B",
            },
          ],
        } as any,
      ],
      signedUp: 2,
      totalSlots: 10,
      createdBy: "u-main",
      createdAt: new Date().toISOString(),
    });

    render(
      <Wrapper>
        <EventDetail />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Role Mix/)[0]).toBeInTheDocument();
    });

    // Expect each participant's level to render correctly
    expect(
      screen.getByText(/System Authorization Level:\s*Administrator/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/System Authorization Level:\s*Leader/i)
    ).toBeInTheDocument();

    // Ensure we do not incorrectly default every user to Participant
    const participantDefaults = screen.queryAllByText(
      /System Authorization Level:\s*Participant/i
    );
    // It's okay if some participants are actually Participant, but this mock shouldn't default both to it
    expect(participantDefaults.length).toBeLessThan(2);
  });
});

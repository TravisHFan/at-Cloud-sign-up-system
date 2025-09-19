import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// SUT
import EventDetail from "../../pages/EventDetail";

// Mocks
vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    joinEventRoom: vi.fn(async () => {}),
    leaveEventRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  }),
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "user-current-1",
      username: "bob",
      email: "bob@example.com",
      firstName: "Bob",
      lastName: "Builder",
      role: "Participant",
      roleInAtCloud: "Participant",
      gender: "male",
    },
  }),
}));

// Some components import useAuth from the AuthContext directly (e.g., NameCardActionModal)
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "user-current-1",
      username: "bob",
      email: "bob@example.com",
      firstName: "Bob",
      lastName: "Builder",
      role: "Participant",
      roleInAtCloud: "Participant",
      gender: "male",
    },
  }),
}));

// We'll override the mocked implementations inside tests
const getEventMock = vi.fn();
const signUpMock = vi.fn();

vi.mock("../../services/api", () => ({
  eventService: {
    getEvent: (...args: any[]) => getEventMock(...args),
    signUpForEvent: (...args: any[]) => signUpMock(...args),
    // The component references other methods too, but we only need these two for this test
    cancelSignup: vi.fn(),
    removeUserFromRole: vi.fn(),
    moveUserBetweenRoles: vi.fn(),
    updateWorkshopGroupTopic: vi.fn(),
    deleteEvent: vi.fn(),
    updateEvent: vi.fn(),
  },
}));

describe("EventDetail - Workshop immediate contact info after signup", () => {
  beforeEach(() => {
    getEventMock.mockReset();
    signUpMock.mockReset();
    // No auth token to avoid socket initialization branch
    localStorage.removeItem("authToken");
  });

  it("shows group contact info immediately after successful signup", async () => {
    // Initial event: Effective Communication Workshop, viewer not signed up
    // Roles: Group A Leader, Group A Participants with one existing participant (Alice)
    getEventMock.mockResolvedValueOnce({
      id: "e1",
      title: "EC Workshop",
      type: "Effective Communication Workshop",
      date: "2025-08-20",
      time: "10:00",
      endTime: "12:00",
      location: "Workshop Space",
      organizer: "Org",
      hostBy: "@Cloud",
      purpose: "Practice",
      agenda: "...",
      format: "On-site",
      disclaimer: "-",
      roles: [
        {
          id: "r-leader-a",
          name: "Group A Leader",
          description: "Leads group A",
          maxParticipants: 1,
          registrations: [],
        },
        {
          id: "r-part-a",
          name: "Group A Participants",
          description: "Participants in group A",
          maxParticipants: 6,
          registrations: [
            {
              user: {
                id: "user-a-1",
                username: "alice",
                firstName: "Alice",
                lastName: "Wonder",
                email: "alice@example.com",
                phone: "+1-222-333-4444",
                gender: "female",
                systemAuthorizationLevel: "Participant",
                roleInAtCloud: "Participant",
                avatar: null,
              },
              notes: "",
              registeredAt: new Date().toISOString(),
            },
          ],
        },
      ],
      signedUp: 1,
      totalSlots: 7,
      createdBy: "org-1",
      createdAt: new Date().toISOString(),
      status: "upcoming",
    });

    // After signup: viewer (Bob) joins Group A Participants; the API returns registrations
    // EventDetail will convert registrations to currentSignups including email/phone
    signUpMock.mockResolvedValueOnce({
      id: "e1",
      roles: [
        {
          id: "r-leader-a",
          name: "Group A Leader",
          description: "Leads group A",
          maxParticipants: 1,
          registrations: [],
        },
        {
          id: "r-part-a",
          name: "Group A Participants",
          description: "Participants in group A",
          maxParticipants: 6,
          registrations: [
            {
              user: {
                id: "user-a-1",
                username: "alice",
                firstName: "Alice",
                lastName: "Wonder",
                email: "alice@example.com",
                phone: "+1-222-333-4444",
                gender: "female",
                systemAuthorizationLevel: "Participant",
                roleInAtCloud: "Participant",
                avatar: null,
              },
              notes: "",
              registeredAt: new Date().toISOString(),
            },
            {
              user: {
                id: "user-current-1",
                username: "bob",
                firstName: "Bob",
                lastName: "Builder",
                email: "bob@example.com",
                phone: "+1-111-000-0000",
                gender: "male",
                systemAuthorizationLevel: "Participant",
                roleInAtCloud: "Participant",
                avatar: null,
              },
              notes: "",
              registeredAt: new Date().toISOString(),
            },
          ],
        },
      ],
      signedUp: 2,
    });

    render(
      <MemoryRouter initialEntries={["/events/e1"]}>
        <Routes>
          <Route path="/events/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial event to load
    await waitFor(() => expect(getEventMock).toHaveBeenCalled());

    // The Group A Participants card should be present
    const roleCard = await screen.findByText("Group A Participants");
    const cardRoot = roleCard.closest(".border");
    expect(cardRoot).toBeTruthy();

    // Contact info should NOT be visible before signup (viewer not in Group A yet)
    expect(screen.queryByText("alice@example.com")).toBeNull();

    // Open signup form for Group A Participants
    // Find the button within the Group A Participants card
    const card = cardRoot as HTMLElement;
    // Open the consolidated Sign Up dropdown first
    const signUpBtn = within(card).getByRole("button", { name: /Sign Up/i });
    fireEvent.click(signUpBtn);

    // Click "Sign Up Myself" in the dropdown to open the form
    const signUpMyself = await within(card).findByText(/Sign Up Myself/i);
    fireEvent.click(signUpMyself);

    // Then confirm signup in the form
    const confirmBtn = within(card).getByRole("button", {
      name: /Confirm Signup/i,
    });
    fireEvent.click(confirmBtn);

    // After signup resolves, contact info for the group should be visible immediately
    await screen.findByText("alice@example.com");
    await screen.findByText("+1-222-333-4444");
  });
});

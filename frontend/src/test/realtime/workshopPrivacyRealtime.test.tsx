import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EventRoleSignup from "../../components/events/EventRoleSignup";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";

// Mock NameCardActionModal to avoid context issues
vi.mock("../../components/common/NameCardActionModal", () => ({
  default: () => null,
}));

// NOTE: This test validates the core contact visibility logic for workshop events.
// The actual real-time behavior is tested via the backend integration test which
// confirms socket emissions contain proper viewer-specific payloads.
// Frontend real-time updates are handled by the EventDetail component's socket
// listener which refetches the event after receiving event_update events.

// Mock API services for AuthProvider
vi.mock("../../services/api", () => ({
  authService: {
    getProfile: vi.fn(async () => ({
      id: "uA",
      username: "partA",
      firstName: "Part",
      lastName: "A",
      email: "a@example.com",
      phone: "111",
      role: "Participant",
      isAtCloudLeader: false,
      roleInAtCloud: "Member",
      gender: "female",
    })),
    login: vi.fn(),
    logout: vi.fn(),
  },
  eventService: {
    getEvent: vi.fn(),
  },
}));

describe("Workshop contact visibility (real-time behavior)", () => {
  it("shows contact info for same group members in workshop events", async () => {
    const role = {
      id: "ga-p",
      name: "Group A Participants",
      description: "",
      maxParticipants: 3,
      currentSignups: [
        {
          userId: "uA",
          username: "partA",
          firstName: "Part",
          lastName: "A",
          email: "a@example.com",
          phone: "111",
          avatar: "",
          gender: "female" as const,
          systemAuthorizationLevel: "Participant",
          roleInAtCloud: "Member",
          notes: "",
          registeredAt: new Date().toISOString(),
        },
        {
          userId: "uA2",
          username: "partA2",
          firstName: "Part",
          lastName: "A2",
          email: "uA2@example.com",
          phone: "555-5555",
          avatar: "",
          gender: "female" as const,
          systemAuthorizationLevel: "Participant",
          roleInAtCloud: "Member",
          notes: "",
          registeredAt: new Date().toISOString(),
        },
      ],
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <EventRoleSignup
            role={role}
            onSignup={() => {}}
            onCancel={() => {}}
            currentUserId="uA"
            currentUserRole="Participant"
            isUserSignedUpForThisRole={true}
            hasReachedMaxRoles={false}
            maxRolesForUser={1}
            isRoleAllowedForUser={true}
            eventType="Effective Communication Workshop"
            viewerGroupLetter="A"
          />
        </AuthProvider>
      </MemoryRouter>
    );

    // Should show contact info for same group members
    expect(await screen.findByText("uA2@example.com")).toBeTruthy();
    expect(await screen.findByText("555-5555")).toBeTruthy();
  });
});

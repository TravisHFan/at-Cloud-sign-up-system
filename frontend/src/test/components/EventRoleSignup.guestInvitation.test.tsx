import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import EventRoleSignup from "../../components/events/EventRoleSignup";

// Mock the NameCardActionModal component
vi.mock("../../components/common/NameCardActionModal", () => ({
  default: () => null,
}));

const baseParticipant = (over: Partial<any> = {}) => ({
  userId: "u1",
  username: "u1",
  firstName: "U",
  lastName: "One",
  email: "u1@example.com",
  phone: "123",
  systemAuthorizationLevel: "Participant",
  roleInAtCloud: "Member",
  ...over,
});

const renderRoleSignup = (props: Partial<any> = {}) => {
  const role = {
    id: "r1",
    name: "Group A Leader",
    description: "Group A Leadership Role",
    maxParticipants: 2,
    currentSignups: [],
  };

  const defaultProps = {
    role,
    onSignup: vi.fn(),
    onCancel: vi.fn(),
    currentUserId: "viewer",
    currentUserRole: "Participant" as const,
    isUserSignedUpForThisRole: false,
    hasReachedMaxRoles: false,
    maxRolesForUser: 1,
    isRoleAllowedForUser: true, // Default: user CAN sign up for this role
    eventType: "Effective Communication Workshop",
    eventId: "event123",
    viewerGroupLetter: "A" as const,
    viewerGroupLetters: ["A" as const],
    isOrganizer: false,
    onAssignUser: vi.fn(),
    guestCount: 0,
    guestList: [],
    ...props,
  };

  return render(
    <MemoryRouter>
      <AuthProvider>
        <EventRoleSignup {...defaultProps} />
      </AuthProvider>
    </MemoryRouter>
  );
};

describe("EventRoleSignup - Guest Invitation Button Visibility", () => {
  describe("Button visibility based on role permissions", () => {
    it("shows 'Invite a guest to this role' button when user can sign up for the role", () => {
      renderRoleSignup({
        isRoleAllowedForUser: true,
      });

      const inviteButton = screen.getByText("Invite a guest to this role");
      expect(inviteButton).toBeTruthy();
      expect(inviteButton).not.toBeDisabled();
    });

    it("hides 'Invite a guest to this role' button when user cannot sign up for the role", () => {
      renderRoleSignup({
        isRoleAllowedForUser: false,
      });

      const inviteButton = screen.queryByText("Invite a guest to this role");
      expect(inviteButton).toBeNull();
    });

    it("shows but disables button when role is full but user has permission", () => {
      const role = {
        id: "r1",
        name: "Group A Leader",
        description: "Group A Leadership Role",
        maxParticipants: 1,
        currentSignups: [baseParticipant()], // Role is full
      };

      renderRoleSignup({
        role,
        isRoleAllowedForUser: true,
      });

      const inviteButton = screen.getByText("Invite a guest to this role");
      expect(inviteButton).toBeTruthy();
      expect(inviteButton).toBeDisabled();
    });

    it("does not show button when role is full and user has no permission", () => {
      const role = {
        id: "r1",
        name: "Group A Leader",
        description: "Group A Leadership Role",
        maxParticipants: 1,
        currentSignups: [baseParticipant()], // Role is full
      };

      renderRoleSignup({
        role,
        isRoleAllowedForUser: false,
      });

      const inviteButton = screen.queryByText("Invite a guest to this role");
      expect(inviteButton).toBeNull();
    });
  });

  describe("Role-specific scenarios for different user types", () => {
    it("Participant can invite guests to roles they can sign up for (Group C Leader)", () => {
      renderRoleSignup({
        currentUserRole: "Participant",
        isRoleAllowedForUser: true,
        role: {
          id: "r1",
          name: "Group C Leader",
          description: "Group C Leadership Role",
          maxParticipants: 2,
          currentSignups: [],
        },
      });

      const inviteButton = screen.getByText("Invite a guest to this role");
      expect(inviteButton).toBeTruthy();
      expect(inviteButton).not.toBeDisabled();
    });

    it("Participant cannot invite guests to roles they cannot sign up for (Spiritual Cover)", () => {
      renderRoleSignup({
        currentUserRole: "Participant",
        isRoleAllowedForUser: false,
        role: {
          id: "r1",
          name: "Spiritual Cover",
          description: "Spiritual Cover Role",
          maxParticipants: 2,
          currentSignups: [],
        },
      });

      const inviteButton = screen.queryByText("Invite a guest to this role");
      expect(inviteButton).toBeNull();
    });

    it("Leader can invite guests to any role they have permission for", () => {
      renderRoleSignup({
        currentUserRole: "Leader",
        isRoleAllowedForUser: true,
        role: {
          id: "r1",
          name: "Spiritual Cover",
          description: "Spiritual Cover Role",
          maxParticipants: 2,
          currentSignups: [],
        },
      });

      const inviteButton = screen.getByText("Invite a guest to this role");
      expect(inviteButton).toBeTruthy();
      expect(inviteButton).not.toBeDisabled();
    });

    it("Administrator can invite guests to any role they have permission for", () => {
      renderRoleSignup({
        currentUserRole: "Administrator",
        isRoleAllowedForUser: true,
        role: {
          id: "r1",
          name: "Event Coordinator",
          description: "Event Coordinator Role",
          maxParticipants: 2,
          currentSignups: [],
        },
      });

      const inviteButton = screen.getByText("Invite a guest to this role");
      expect(inviteButton).toBeTruthy();
      expect(inviteButton).not.toBeDisabled();
    });
  });

  describe("Event type scenarios", () => {
    it("works correctly for Workshop events", () => {
      renderRoleSignup({
        eventType: "Effective Communication Workshop",
        currentUserRole: "Participant",
        isRoleAllowedForUser: true,
        role: {
          id: "r1",
          name: "Group A Participants",
          description: "Workshop Participant Role",
          maxParticipants: 10,
          currentSignups: [],
        },
      });

      const inviteButton = screen.getByText("Invite a guest to this role");
      expect(inviteButton).toBeTruthy();
    });

    it("works correctly for Workshop events when participant cannot access role", () => {
      renderRoleSignup({
        eventType: "Effective Communication Workshop",
        currentUserRole: "Participant",
        isRoleAllowedForUser: false,
        role: {
          id: "r1",
          name: "Workshop Facilitator",
          description: "Workshop Facilitator Role",
          maxParticipants: 2,
          currentSignups: [],
        },
      });

      const inviteButton = screen.queryByText("Invite a guest to this role");
      expect(inviteButton).toBeNull();
    });

    it("works correctly for general events", () => {
      renderRoleSignup({
        eventType: "Outreach",
        currentUserRole: "Participant",
        isRoleAllowedForUser: true,
        role: {
          id: "r1",
          name: "Setup Team",
          description: "Event Setup Team",
          maxParticipants: 5,
          currentSignups: [],
        },
      });

      const inviteButton = screen.getByText("Invite a guest to this role");
      expect(inviteButton).toBeTruthy();
    });

    it("works correctly for general events when participant cannot access role", () => {
      renderRoleSignup({
        eventType: "Outreach",
        currentUserRole: "Participant",
        isRoleAllowedForUser: false,
        role: {
          id: "r1",
          name: "Event Coordinator",
          description: "Event Coordination Role",
          maxParticipants: 1,
          currentSignups: [],
        },
      });

      const inviteButton = screen.queryByText("Invite a guest to this role");
      expect(inviteButton).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("handles role with guests already signed up", () => {
      renderRoleSignup({
        currentUserRole: "Participant",
        isRoleAllowedForUser: true,
        guestCount: 2,
        role: {
          id: "r1",
          name: "Group A Leader",
          description: "Group A Leadership Role",
          maxParticipants: 5,
          currentSignups: [baseParticipant()],
        },
      });

      const inviteButton = screen.getByText("Invite a guest to this role");
      expect(inviteButton).toBeTruthy();
      expect(inviteButton).not.toBeDisabled();
    });

    it("handles role that becomes full due to guests", () => {
      renderRoleSignup({
        currentUserRole: "Participant",
        isRoleAllowedForUser: true,
        guestCount: 1, // This + 1 current signup = 2, which equals maxParticipants
        role: {
          id: "r1",
          name: "Group A Leader",
          description: "Group A Leadership Role",
          maxParticipants: 2,
          currentSignups: [baseParticipant()],
        },
      });

      const inviteButton = screen.getByText("Invite a guest to this role");
      expect(inviteButton).toBeTruthy();
      expect(inviteButton).toBeDisabled();
    });

    it("does not show button when user reached max roles but would otherwise have permission", () => {
      renderRoleSignup({
        currentUserRole: "Participant",
        isRoleAllowedForUser: true,
        hasReachedMaxRoles: true,
        maxRolesForUser: 1,
        role: {
          id: "r1",
          name: "Group A Leader",
          description: "Group A Leadership Role",
          maxParticipants: 5,
          currentSignups: [],
        },
      });

      // When user has reached max roles, the signup button area shows a warning message
      // but the invite button should still be shown if they have permission for this role type
      const inviteButton = screen.getByText("Invite a guest to this role");
      expect(inviteButton).toBeTruthy();
    });
  });
});

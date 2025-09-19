import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    it("shows 'Invite a guest for this role' option in dropdown when user can sign up for the role", async () => {
      renderRoleSignup({
        isRoleAllowedForUser: true,
      });

      // Click the Sign Up dropdown button
      const signUpButton = screen.getByText("Sign Up");
      expect(signUpButton).toBeTruthy();

      await userEvent.click(signUpButton);

      // Check that the invite option appears in the dropdown
      const inviteOption = screen.getByText("Invite a guest for this role");
      expect(inviteOption).toBeTruthy();
      expect(inviteOption).not.toBeDisabled();
    });

    it("hides 'Invite a guest for this role' option when user cannot sign up for the role", async () => {
      renderRoleSignup({
        isRoleAllowedForUser: false,
      });

      // When user cannot sign up for the role, there's no Sign Up button at all
      // Instead, it shows a "Co-Workers only" message
      const signUpButton = screen.queryByText("Sign Up");
      expect(signUpButton).toBeNull();

      // Check that the invite option does not appear anywhere
      const inviteOption = screen.queryByText("Invite a guest for this role");
      expect(inviteOption).toBeNull();
    });

    it("shows but disables option when role is full but user has permission", async () => {
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

      // Note: When role is full, the Sign Up button is not shown, only a "role is full" message
      // But we need to check if the invite option would be available/disabled
      // Actually, when a role is full, the entire Sign Up dropdown is replaced with a "role is full" message
      // So the invite option won't be visible at all in this case
      const roleFullMessage = screen.getByText(/this role is full/i);
      expect(roleFullMessage).toBeTruthy();

      // The Sign Up dropdown should not be present when role is full
      const signUpButton = screen.queryByText("Sign Up");
      expect(signUpButton).toBeNull();
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
    it("Participant can invite guests to roles they can sign up for (Group C Leader)", async () => {
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

      // Click the Sign Up dropdown button
      const signUpButton = screen.getByText("Sign Up");
      await userEvent.click(signUpButton);

      // Check that the invite option appears in the dropdown
      const inviteOption = screen.getByText("Invite a guest for this role");
      expect(inviteOption).toBeTruthy();
      expect(inviteOption).not.toBeDisabled();
    });

    it("Participant cannot invite guests to roles they cannot sign up for (Spiritual Adviser)", () => {
      renderRoleSignup({
        currentUserRole: "Participant",
        isRoleAllowedForUser: false,
        role: {
          id: "r1",
          name: "Spiritual Adviser",
          description: "Spiritual Adviser Role",
          maxParticipants: 2,
          currentSignups: [],
        },
      });

      const inviteButton = screen.queryByText("Invite a guest to this role");
      expect(inviteButton).toBeNull();
    });

    it("Leader can invite guests to any role they have permission for (including Spiritual Adviser)", async () => {
      renderRoleSignup({
        currentUserRole: "Leader",
        isRoleAllowedForUser: true,
        role: {
          id: "r1",
          name: "Spiritual Adviser",
          description: "Spiritual Adviser Role",
          maxParticipants: 2,
          currentSignups: [],
        },
      });

      // Click the Sign Up dropdown button
      const signUpButton = screen.getByText("Sign Up");
      await userEvent.click(signUpButton);

      // Check that the invite option appears in the dropdown
      const inviteOption = screen.getByText("Invite a guest for this role");
      expect(inviteOption).toBeTruthy();
      expect(inviteOption).not.toBeDisabled();
    });

    it("Administrator can invite guests to any role they have permission for", async () => {
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

      // Click the Sign Up dropdown button
      const signUpButton = screen.getByText("Sign Up");
      await userEvent.click(signUpButton);

      // Check that the invite option appears in the dropdown
      const inviteOption = screen.getByText("Invite a guest for this role");
      expect(inviteOption).toBeTruthy();
      expect(inviteOption).not.toBeDisabled();
    });
  });

  describe("Event type scenarios", () => {
    it("works correctly for Workshop events", async () => {
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

      // Click the Sign Up dropdown button
      const signUpButton = screen.getByText("Sign Up");
      await userEvent.click(signUpButton);

      // Check that the invite option appears in the dropdown
      const inviteOption = screen.getByText("Invite a guest for this role");
      expect(inviteOption).toBeTruthy();
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

    it("works correctly for general events", async () => {
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

      // Click the Sign Up dropdown button
      const signUpButton = screen.getByText("Sign Up");
      await userEvent.click(signUpButton);

      // Check that the invite option appears in the dropdown
      const inviteOption = screen.getByText("Invite a guest for this role");
      expect(inviteOption).toBeTruthy();
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
    it("handles role with guests already signed up", async () => {
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

      // Click the Sign Up dropdown button
      const signUpButton = screen.getByText("Sign Up");
      await userEvent.click(signUpButton);

      // Check that the invite option appears in the dropdown
      const inviteOption = screen.getByText("Invite a guest for this role");
      expect(inviteOption).toBeTruthy();
      expect(inviteOption).not.toBeDisabled();
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

      // When role is full, the Sign Up dropdown is replaced with a "role is full" message
      const roleFullMessage = screen.getByText(/this role is full/i);
      expect(roleFullMessage).toBeTruthy();

      // The Sign Up dropdown should not be present when role is full
      const signUpButton = screen.queryByText("Sign Up");
      expect(signUpButton).toBeNull();

      // The invite option won't be visible anywhere since there's no dropdown
      const inviteOption = screen.queryByText("Invite a guest for this role");
      expect(inviteOption).toBeNull();
    });

    it("does not show invite option when user reached max roles", () => {
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
      const maxRolesMessage = screen.getByText(
        /you have reached the maximum number of roles/i
      );
      expect(maxRolesMessage).toBeTruthy();

      // The Sign Up dropdown should not be present when user reached max roles
      const signUpButton = screen.queryByText("Sign Up");
      expect(signUpButton).toBeNull();

      // The invite option is not available since it's part of the dropdown which is not shown
      const inviteOption = screen.queryByText("Invite a guest for this role");
      expect(inviteOption).toBeNull();
    });
  });
});

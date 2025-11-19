/**
 * GuestList Component Tests
 *
 * Tests the GuestList component for displaying and managing event guests:
 * - Visibility based on user role
 * - Guest list rendering
 * - Admin actions (resend link, cancel, edit)
 * - API interactions
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GuestList from "../GuestList";
import { GuestApi } from "../../../services/guestApi";

// Mock GuestApi
vi.mock("../../../services/guestApi", () => ({
  GuestApi: {
    resendManageLink: vi.fn(),
  },
}));

// Mock window.confirm
const mockConfirm = vi.fn();
window.confirm = mockConfirm;

describe("GuestList", () => {
  const mockNotification = {
    success: vi.fn(),
    error: vi.fn(),
  };

  const mockSetCancelConfirm = vi.fn();
  const mockSetEditGuest = vi.fn();

  const mockEvent = {
    id: "event-123",
    title: "Test Event",
  } as any;

  const mockGuests = {
    "role-1": [
      {
        id: "guest-1",
        fullName: "John Doe",
        email: "john@example.com",
        phone: "555-0100",
      },
      {
        id: "guest-2",
        fullName: "Jane Smith",
        email: "jane@example.com",
      },
    ],
    "role-2": [
      {
        id: "guest-3",
        fullName: "Bob Wilson",
        phone: "555-0200",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Visibility and Access Control", () => {
    it("should render for Super Admin", () => {
      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(screen.getByTestId("admin-guests-role-1")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should render for Administrator", () => {
      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Administrator"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(screen.getByTestId("admin-guests-role-1")).toBeInTheDocument();
    });

    it("should render for event organizer", () => {
      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Leader"
          isCurrentUserOrganizer={true}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(screen.getByTestId("admin-guests-role-1")).toBeInTheDocument();
    });

    it("should not render for non-admin non-organizer users", () => {
      const { container } = render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Participant"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should not render when guest list is empty", () => {
      const { container } = render(
        <GuestList
          roleId="role-empty"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should handle null isCurrentUserOrganizer", () => {
      const { container } = render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Participant"
          isCurrentUserOrganizer={null}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Guest List Rendering", () => {
    beforeEach(() => {
      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );
    });

    it("should display all guests for the role", () => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    it("should show guest badge for each guest", () => {
      const badges = screen.getAllByText("Guest");
      expect(badges).toHaveLength(2);
    });

    it("should display guest email when provided", () => {
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    });

    it("should display guest phone when provided", () => {
      expect(screen.getByText("555-0100")).toBeInTheDocument();
    });

    it("should not display phone for guest without phone", () => {
      // Jane Smith doesn't have a phone
      const janeSection = screen.getByText("Jane Smith").closest("div");
      expect(janeSection).not.toHaveTextContent("555-");
    });

    it("should use guest ID as testid when available", () => {
      expect(screen.getByTestId("admin-guest-guest-1")).toBeInTheDocument();
      expect(screen.getByTestId("admin-guest-guest-2")).toBeInTheDocument();
    });

    it("should display guests header", () => {
      expect(screen.getByText("Guests:")).toBeInTheDocument();
    });
  });

  describe("Resend Manage Link", () => {
    it("should resend manage link on confirmation", async () => {
      const user = userEvent.setup();
      vi.mocked(GuestApi.resendManageLink).mockResolvedValue(undefined);

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      const resendButtons = screen.getAllByText("Re-send manage link");
      await user.click(resendButtons[0]);

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith(
          "Send a fresh manage link to this guest via email?"
        );
      });

      expect(GuestApi.resendManageLink).toHaveBeenCalledWith("guest-1", {
        eventId: "event-123",
      });

      expect(mockNotification.success).toHaveBeenCalledWith(
        "Manage link sent to guest.",
        { title: "Email Sent" }
      );
    });

    it("should not resend when user cancels confirmation", async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(false);

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      const resendButtons = screen.getAllByText("Re-send manage link");
      await user.click(resendButtons[0]);

      expect(mockConfirm).toHaveBeenCalled();
      expect(GuestApi.resendManageLink).not.toHaveBeenCalled();
      expect(mockNotification.success).not.toHaveBeenCalled();
    });

    it("should handle resend errors gracefully", async () => {
      const user = userEvent.setup();
      const error = new Error("Network error");
      vi.mocked(GuestApi.resendManageLink).mockRejectedValue(error);

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      const resendButtons = screen.getAllByText("Re-send manage link");
      await user.click(resendButtons[0]);

      await waitFor(() => {
        expect(mockNotification.error).toHaveBeenCalledWith("Network error", {
          title: "Send Failed",
        });
      });
    });

    it("should handle non-Error exceptions", async () => {
      const user = userEvent.setup();
      vi.mocked(GuestApi.resendManageLink).mockRejectedValue("String error");

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      const resendButtons = screen.getAllByText("Re-send manage link");
      await user.click(resendButtons[0]);

      await waitFor(() => {
        expect(mockNotification.error).toHaveBeenCalledWith(
          "Failed to send manage link.",
          { title: "Send Failed" }
        );
      });
    });

    it("should not show resend button for guest without ID", () => {
      const guestsWithoutId = {
        "role-1": [
          {
            fullName: "No ID Guest",
            email: "noid@example.com",
          },
        ],
      };

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={guestsWithoutId}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(screen.queryByText("Re-send manage link")).not.toBeInTheDocument();
    });
  });

  describe("Cancel Guest", () => {
    it("should open cancel confirmation modal", async () => {
      const user = userEvent.setup();

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      const cancelButtons = screen.getAllByText("Cancel Guest");
      await user.click(cancelButtons[0]);

      expect(mockSetCancelConfirm).toHaveBeenCalledWith({
        open: true,
        roleId: "role-1",
        guest: mockGuests["role-1"][0],
      });
    });

    it("should not show cancel button for guest without ID", () => {
      const guestsWithoutId = {
        "role-1": [
          {
            fullName: "No ID Guest",
            email: "noid@example.com",
          },
        ],
      };

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={guestsWithoutId}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(screen.queryByText("Cancel Guest")).not.toBeInTheDocument();
    });
  });

  describe("Edit Guest", () => {
    it("should open edit guest modal", async () => {
      const user = userEvent.setup();

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      const editButtons = screen.getAllByText("Edit Guest");
      await user.click(editButtons[1]);

      expect(mockSetEditGuest).toHaveBeenCalledWith({
        open: true,
        roleId: "role-1",
        guest: mockGuests["role-1"][1],
      });
    });

    it("should not show edit button for guest without ID", () => {
      const guestsWithoutId = {
        "role-1": [
          {
            fullName: "No ID Guest",
            email: "noid@example.com",
          },
        ],
      };

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={guestsWithoutId}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(screen.queryByText("Edit Guest")).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing role in guestsByRole", () => {
      const { container } = render(
        <GuestList
          roleId="nonexistent-role"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should handle guest without email or phone", () => {
      const minimalGuests = {
        "role-1": [
          {
            id: "minimal-1",
            fullName: "Minimal Guest",
          },
        ],
      };

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={minimalGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(screen.getByText("Minimal Guest")).toBeInTheDocument();
      // Email/phone section should be empty
      const guestDiv = screen
        .getByText("Minimal Guest")
        .closest('[data-testid="admin-guest-minimal-1"]');
      expect(
        guestDiv?.querySelector(".text-xs.text-gray-500")
      ).toHaveTextContent("");
    });

    it("should use index as key when guest has no ID", () => {
      const guestsWithoutId = {
        "role-1": [
          {
            fullName: "Guest 1",
          },
          {
            fullName: "Guest 2",
          },
        ],
      };

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={guestsWithoutId}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(screen.getByTestId("admin-guest-0")).toBeInTheDocument();
      expect(screen.getByTestId("admin-guest-1")).toBeInTheDocument();
    });

    it("should handle null event gracefully", async () => {
      const user = userEvent.setup();
      vi.mocked(GuestApi.resendManageLink).mockResolvedValue(undefined);

      render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={null}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      const resendButtons = screen.getAllByText("Re-send manage link");
      await user.click(resendButtons[0]);

      expect(GuestApi.resendManageLink).toHaveBeenCalledWith("guest-1", {
        eventId: undefined,
      });
    });
  });

  describe("Multiple Roles", () => {
    it("should render different guests for different role IDs", () => {
      const { rerender } = render(
        <GuestList
          roleId="role-1"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.queryByText("Bob Wilson")).not.toBeInTheDocument();

      rerender(
        <GuestList
          roleId="role-2"
          guestsByRole={mockGuests}
          currentUserRole="Super Admin"
          isCurrentUserOrganizer={false}
          event={mockEvent}
          notification={mockNotification}
          setCancelConfirm={mockSetCancelConfirm}
          setEditGuest={mockSetEditGuest}
        />
      );

      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
    });
  });
});

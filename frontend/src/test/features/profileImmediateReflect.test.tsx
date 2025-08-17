import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Profile from "../../pages/Profile";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

// Mocks
vi.mock("../../services/api", () => {
  return {
    authService: {
      getProfile: vi.fn(async () => ({
        id: "user-1",
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phone: "",
        role: "Participant",
        isAtCloudLeader: false,
        roleInAtCloud: "",
        gender: "male",
        avatar: null,
      })),
      login: vi.fn(),
      logout: vi.fn(),
    },
    userService: {
      updateProfile: vi.fn(async (updates: any) => ({
        id: "user-1",
        username: updates.username || "testuser",
        firstName: updates.firstName || "Test",
        lastName: updates.lastName || "User",
        email: updates.email || "test@example.com",
        phone: updates.phone || "",
        role: "Participant",
        isAtCloudLeader: updates.isAtCloudLeader ?? true,
        roleInAtCloud: updates.roleInAtCloud || "Founder",
        gender: updates.gender || "male",
        avatar: null,
        weeklyChurch: updates.weeklyChurch || "",
        churchAddress: updates.churchAddress || "",
        homeAddress: updates.homeAddress || "",
        occupation: updates.occupation || "",
        company: updates.company || "",
      })),
    },
    fileService: {
      uploadAvatar: vi.fn(),
    },
  };
});

describe("Profile immediate reflection after save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure token exists so AuthProvider loads profile
    localStorage.setItem("authToken", "test-token");
  });

  it("shows co-worker 'Yes' and the entered Role in @Cloud immediately after save", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/profile"]}>
        <NotificationProvider>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    // Wait for initial profile load
    await waitFor(() => {
      expect(screen.getByText("My Profile")).toBeTruthy();
    });

    // Enter edit mode
    const editButton = await screen.findByRole("button", {
      name: /edit profile/i,
    });
    fireEvent.click(editButton);

    // Change co-worker select to Yes
    const coworkerSelect = screen.getByLabelText(
      /are you an @cloud co-worker\?/i
    ) as HTMLSelectElement;
    fireEvent.change(coworkerSelect, { target: { value: "Yes" } });

    // Role field should appear while editing
    const roleInput = (await screen.findByLabelText(
      /role in @cloud/i
    )) as HTMLInputElement;
    fireEvent.change(roleInput, { target: { value: "Founder" } });

    // Save changes
    const saveButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveButton);

    // After save, form exits edit mode but should reflect updated values immediately
    await waitFor(() => {
      // The select should now show Yes (and be disabled)
      const updatedSelect = screen.getByLabelText(
        /are you an @cloud co-worker\?/i
      ) as HTMLSelectElement;
      expect(updatedSelect.value).toBe("Yes");

      // Role in @Cloud input should still be visible (read-only) with the entered value
      const readOnlyRoleInput = screen.getByLabelText(
        /role in @cloud/i
      ) as HTMLInputElement;
      expect(readOnlyRoleInput).toHaveValue("Founder");
    });
  });
});

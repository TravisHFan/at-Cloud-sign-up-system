/**
 * User Profile Admin Edit Tests
 *
 * Tests the admin profile editing feature:
 * - Super Admin and Administrator can edit other users' profiles
 * - Leaders and Participants cannot edit other users' profiles
 * - Only specific fields (avatar, phone, isAtCloudLeader, roleInAtCloud) can be edited
 * - User viewing their own profile uses standard edit mode
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserProfile from "../../pages/UserProfile";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

// Mock data
const mockAdminUser = {
  id: "admin-123",
  username: "admin",
  firstName: "Admin",
  lastName: "User",
  email: "admin@example.com",
  role: "Administrator",
  gender: "male" as const,
};

const mockLeaderUser = {
  id: "leader-123",
  username: "leader",
  firstName: "Leader",
  lastName: "User",
  email: "leader@example.com",
  role: "Leader",
  gender: "male" as const,
};

const mockTargetUser = {
  id: "target-123",
  username: "targetuser",
  firstName: "Target",
  lastName: "User",
  email: "target@example.com",
  role: "Participant",
  gender: "female" as const,
  phone: "1234567890",
  isAtCloudLeader: false,
  roleInAtCloud: "",
  avatar: null,
  createdAt: new Date("2025-01-01").toISOString(),
  lastLogin: new Date("2025-01-05").toISOString(),
};

// Mock API services
const mockGetProfile = vi.fn();
const mockGetUser = vi.fn();
const mockAdminEditProfile = vi.fn();

vi.mock("../../services/api", () => ({
  authService: {
    getProfile: () => mockGetProfile(),
    login: vi.fn(),
    logout: vi.fn(),
  },
  userService: {
    getUser: (id: string) => mockGetUser(id),
    adminEditProfile: (userId: string, updates: any) =>
      mockAdminEditProfile(userId, updates),
  },
  fileService: {
    uploadAvatarForAdmin: vi.fn(async () => ({
      avatarUrl: "https://example.com/uploaded-avatar.jpg",
    })),
  },
}));

describe("UserProfile - Admin Edit Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("shows Edit Profile button when Administrator views another user's profile", async () => {
    // Mock authService to return admin user
    mockGetProfile.mockResolvedValue(mockAdminUser);

    // Mock getting target user profile
    mockGetUser.mockResolvedValue(mockTargetUser);

    render(
      <MemoryRouter initialEntries={["/dashboard/profile/target-123"]}>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/profile/:userId"
                element={<UserProfile />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText("Target User")).toBeTruthy();
    });

    // Should show Edit Profile button
    const editButton = screen.getByRole("button", { name: /edit profile/i });
    expect(editButton).toBeTruthy();
  });

  it("shows Edit Profile button when Super Admin views another user's profile", async () => {
    const mockSuperAdminUser = {
      ...mockAdminUser,
      id: "superadmin-123",
      role: "Super Admin",
    };

    mockGetProfile.mockResolvedValue(mockSuperAdminUser);
    mockGetUser.mockResolvedValue(mockTargetUser);

    render(
      <MemoryRouter initialEntries={["/dashboard/profile/target-123"]}>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/profile/:userId"
                element={<UserProfile />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Target User")).toBeTruthy();
    });

    const editButton = screen.getByRole("button", { name: /edit profile/i });
    expect(editButton).toBeTruthy();
  });

  it("does NOT show Edit Profile button when Leader views another user's profile", async () => {
    mockGetProfile.mockResolvedValue(mockLeaderUser);
    mockGetUser.mockResolvedValue(mockTargetUser);

    render(
      <MemoryRouter initialEntries={["/dashboard/profile/target-123"]}>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/profile/:userId"
                element={<UserProfile />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Target User")).toBeTruthy();
    });

    // Should NOT show Edit Profile button
    expect(screen.queryByRole("button", { name: /edit profile/i })).toBeNull();
  });

  it("does NOT show Edit Profile button when Participant views another user's profile", async () => {
    const mockParticipantUser = {
      ...mockLeaderUser,
      id: "participant-123",
      role: "Participant",
    };

    mockGetProfile.mockResolvedValue(mockParticipantUser);
    mockGetUser.mockResolvedValue(mockTargetUser);

    render(
      <MemoryRouter initialEntries={["/dashboard/profile/target-123"]}>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/profile/:userId"
                element={<UserProfile />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Target User")).toBeTruthy();
    });

    expect(screen.queryByRole("button", { name: /edit profile/i })).toBeNull();
  });

  it("allows admin to edit phone field", async () => {
    mockGetProfile.mockResolvedValue(mockAdminUser);
    mockGetUser.mockResolvedValue(mockTargetUser);

    mockAdminEditProfile.mockResolvedValue({
      phone: "9876543210",
      isAtCloudLeader: false,
      roleInAtCloud: "",
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/profile/target-123"]}>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/profile/:userId"
                element={<UserProfile />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Target User")).toBeTruthy();
    });

    // Click edit button
    const editButton = screen.getByRole("button", { name: /edit profile/i });
    fireEvent.click(editButton);

    // Wait for edit mode
    await waitFor(() => {
      const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement;
      expect(phoneInput).toBeTruthy();
      expect(phoneInput.disabled).toBe(false);
    });

    // Change phone number
    const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: "9876543210" } });

    // Find and click save button
    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    // Wait for save to complete
    await waitFor(() => {
      expect(mockAdminEditProfile).toHaveBeenCalledWith("target-123", {
        avatar: "",
        phone: "9876543210",
        isAtCloudLeader: false,
        roleInAtCloud: "",
      });
    });
  });

  it("allows admin to change @Cloud co-worker status", async () => {
    mockGetProfile.mockResolvedValue(mockAdminUser);
    mockGetUser.mockResolvedValue(mockTargetUser);

    mockAdminEditProfile.mockResolvedValue({
      isAtCloudLeader: true,
      roleInAtCloud: "Technical Lead",
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/profile/target-123"]}>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/profile/:userId"
                element={<UserProfile />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Target User")).toBeTruthy();
    });

    // Click edit button
    const editButton = screen.getByRole("button", { name: /edit profile/i });
    fireEvent.click(editButton);

    await waitFor(() => {
      const coWorkerCheckbox = screen.getByLabelText(
        /@cloud co-worker/i
      ) as HTMLInputElement;
      expect(coWorkerCheckbox).toBeTruthy();
    });

    // Toggle @Cloud co-worker status
    const coWorkerCheckbox = screen.getByLabelText(
      /@cloud co-worker/i
    ) as HTMLInputElement;
    fireEvent.click(coWorkerCheckbox);

    // Enter role in @Cloud
    await waitFor(() => {
      const roleInput = screen.getByLabelText(
        /role in @cloud/i
      ) as HTMLInputElement;
      expect(roleInput).toBeTruthy();
      expect(roleInput.disabled).toBe(false);
    });

    const roleInput = screen.getByLabelText(
      /role in @cloud/i
    ) as HTMLInputElement;
    fireEvent.change(roleInput, { target: { value: "Technical Lead" } });

    // Save changes
    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockAdminEditProfile).toHaveBeenCalledWith("target-123", {
        avatar: "",
        phone: "1234567890",
        isAtCloudLeader: true,
        roleInAtCloud: "Technical Lead",
      });
    });
  });

  it("shows cancel button in edit mode that reverts changes", async () => {
    mockGetProfile.mockResolvedValue(mockAdminUser);
    mockGetUser.mockResolvedValue(mockTargetUser);

    render(
      <MemoryRouter initialEntries={["/dashboard/profile/target-123"]}>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/profile/:userId"
                element={<UserProfile />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Target User")).toBeTruthy();
    });

    // Enter edit mode
    const editButton = screen.getByRole("button", { name: /edit profile/i });
    fireEvent.click(editButton);

    await waitFor(() => {
      const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement;
      expect(phoneInput).toBeTruthy();
      expect(phoneInput.disabled).toBe(false);
    });

    // Make a change
    const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: "9999999999" } });

    // Click cancel
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Should exit edit mode without saving
    await waitFor(() => {
      expect(mockAdminEditProfile).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: /edit profile/i })
      ).toBeTruthy();
    });
  });

  it("does NOT allow editing firstName, lastName, email, or role", async () => {
    mockGetProfile.mockResolvedValue(mockAdminUser);
    mockGetUser.mockResolvedValue(mockTargetUser);

    render(
      <MemoryRouter initialEntries={["/dashboard/profile/target-123"]}>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/profile/:userId"
                element={<UserProfile />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Target User")).toBeTruthy();
    });

    // Enter edit mode
    const editButton = screen.getByRole("button", { name: /edit profile/i });
    fireEvent.click(editButton);

    await waitFor(() => {
      const phoneInput = screen.getByLabelText(/phone/i);
      expect(phoneInput).toBeTruthy();
    });

    // Verify firstName, lastName, email are NOT editable
    const firstNameInput = screen.queryByLabelText(
      /first name/i
    ) as HTMLInputElement;
    const lastNameInput = screen.queryByLabelText(
      /last name/i
    ) as HTMLInputElement;
    const emailInput = screen.queryByLabelText(/email/i) as HTMLInputElement;

    // These fields should either not exist or be disabled/readonly
    if (firstNameInput) {
      expect(firstNameInput.disabled || firstNameInput.readOnly).toBe(true);
    }
    if (lastNameInput) {
      expect(lastNameInput.disabled || lastNameInput.readOnly).toBe(true);
    }
    if (emailInput) {
      expect(emailInput.disabled || emailInput.readOnly).toBe(true);
    }
  });

  it("displays user info correctly when NOT in edit mode", async () => {
    mockGetProfile.mockResolvedValue(mockAdminUser);
    mockGetUser.mockResolvedValue(mockTargetUser);

    render(
      <MemoryRouter initialEntries={["/dashboard/profile/target-123"]}>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/profile/:userId"
                element={<UserProfile />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Target User")).toBeTruthy();
    });

    // Check profile displays correctly
    expect(screen.getByText("@targetuser")).toBeTruthy();
    expect(screen.getByText("target@example.com")).toBeTruthy();
    expect(screen.getByText("1234567890")).toBeTruthy();
    // Role badge - use getAllByText since "Participant" appears in multiple places
    const participantTexts = screen.getAllByText("Participant");
    expect(participantTexts.length).toBeGreaterThan(0);
  });
});

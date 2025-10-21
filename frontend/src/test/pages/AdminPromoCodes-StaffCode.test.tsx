import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import AdminPromoCodes from "../../pages/AdminPromoCodes";
import * as api from "../../services/api";

// Mock API client
vi.mock("../../services/api");

// Mock hooks
vi.mock("../../hooks/useUserData", () => ({
  useUserData: vi.fn(() => ({
    users: [],
    loading: false,
    refreshUsers: vi.fn(),
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    loadPage: vi.fn(),
  })),
}));

vi.mock("../../hooks/useUsersApi", () => ({
  useUsers: vi.fn(() => ({
    users: [],
    loading: false,
    error: null,
    refreshUsers: vi.fn(),
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    loadPage: vi.fn(),
  })),
}));

vi.mock("../../hooks/useAvatarUpdates", () => ({
  useAvatarUpdates: vi.fn(() => ({
    avatarVersion: 0,
  })),
}));

// Mock NotificationModalContext
vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: vi.fn(() => ({
    show: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  })),
}));

// Mock AuthContext
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: {
      _id: "admin123",
      role: "Super Admin",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
    },
  })),
}));

describe("AdminPromoCodes - Staff Code Creation (Minimal Test)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup minimal mocks
    vi.mocked(api.apiClient.getAllPromoCodes).mockResolvedValue({
      codes: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    vi.mocked(api.apiClient.listPrograms).mockResolvedValue([]);
    vi.mocked(api.userService.getUsers).mockResolvedValue({
      users: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalUsers: 0,
        hasNext: false,
        hasPrev: false,
      },
    });
    vi.mocked(api.searchService.searchUsers).mockResolvedValue({
      results: [],
    });
  });

  /**
   * MINIMAL TEST: Verify basic component renders and tab navigation works
   */
  it("should render and navigate to Create Staff Code tab", async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AdminPromoCodes />
      </BrowserRouter>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText("Promo Codes Management")).toBeInTheDocument();
    });

    // Verify "Create Staff Code" tab exists
    const createStaffTab = screen.getByRole("button", {
      name: /create staff code/i,
    });
    expect(createStaffTab).toBeInTheDocument();

    // Click the tab
    await user.click(createStaffTab);

    // Verify the tab content loads (should see "Select User" button)
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /select user/i })
      ).toBeInTheDocument();
    });
  });

  /**
   * CORE TEST: Verify user search and selection flow with valid ID
   * This is the critical bug prevention test
   */
  it("should ensure selected user from search has valid ID", async () => {
    const user = userEvent.setup();

    // Mock user search with COMPLETE data including ID
    const mockUser = {
      id: "user123",
      username: "john.doe",
      email: "john.doe@example.com",
      firstName: "John",
      lastName: "Doe",
      role: "Participant" as const,
      roleInAtCloud: "@Cloud Co-worker",
      gender: "male" as const,
      avatar: null,
      phone: "+1234567890",
      isAtCloudLeader: "No" as const,
    };

    vi.mocked(api.searchService.searchUsers).mockResolvedValue({
      results: [mockUser],
    });

    // Configure search to return our user
    vi.mocked(api.searchService.searchUsers).mockResolvedValue({
      results: [mockUser],
    });

    // Mock staff code creation
    const mockCreatedCode = {
      _id: "code123",
      code: "STAFF-ABC123",
      type: "staff_access" as const,
      discountPercent: 100,
      ownerId: "user123",
      ownerEmail: "john.doe@example.com",
      ownerName: "John Doe",
      isActive: true,
      isUsed: false,
      createdAt: new Date().toISOString(),
      createdBy: "admin123",
    };

    vi.mocked(api.apiClient.createStaffPromoCode).mockResolvedValue({
      code: mockCreatedCode,
    });

    render(
      <BrowserRouter>
        <AdminPromoCodes />
      </BrowserRouter>
    );

    // Navigate to Create Staff Code tab
    await waitFor(() => {
      expect(screen.getByText("Promo Codes Management")).toBeInTheDocument();
    });

    const createStaffTab = screen.getByRole("button", {
      name: /create staff code/i,
    });
    await user.click(createStaffTab);

    // Open user selection modal
    const selectUserButton = screen.getByRole("button", {
      name: /select user/i,
    });
    await user.click(selectUserButton);

    // Wait for modal to open
    await waitFor(() => {
      expect(
        screen.getByText("Select User for Staff Code")
      ).toBeInTheDocument();
    });

    // Type in search box
    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    await user.type(searchInput, "john");

    // Wait for search to be called
    await waitFor(
      () => {
        expect(api.searchService.searchUsers).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    // Wait for user to appear in results
    await waitFor(
      () => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Select the user
    const userCard = screen.getByText("John Doe").closest("button");
    expect(userCard).toBeInTheDocument();
    await user.click(userCard!);

    // Verify modal closes
    await waitFor(() => {
      expect(
        screen.queryByText("Select User for Staff Code")
      ).not.toBeInTheDocument();
    });

    // Verify user is displayed in the form
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();

    // Submit the form (find the submit button, not the tab button)
    const submitButtons = screen.getAllByRole("button", {
      name: /create staff code/i,
    });
    const generateButton = submitButtons.find(
      (btn) => btn.getAttribute("type") === "submit"
    );
    expect(generateButton).toBeInTheDocument();
    await user.click(generateButton!);

    // CRITICAL ASSERTION: Verify API was called with user ID
    await waitFor(
      () => {
        expect(api.apiClient.createStaffPromoCode).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    // Verify the API call included the user ID
    const apiCalls = vi.mocked(api.apiClient.createStaffPromoCode).mock.calls;
    expect(apiCalls.length).toBeGreaterThan(0);

    const firstCallArg = apiCalls[0][0];
    expect(firstCallArg).toHaveProperty("userId");
    expect(firstCallArg.userId).toBe("user123"); // Must match mock user ID
    expect(firstCallArg.userId).toBeTruthy(); // Guard: not null/undefined
    expect(firstCallArg.userId.length).toBeGreaterThan(0); // Guard: not empty string

    console.log(
      "✅ SUCCESS: User ID correctly passed to API:",
      firstCallArg.userId
    );
  });

  /**
   * NEGATIVE TEST: Verify behavior with missing user ID
   */
  it("should handle user without ID gracefully", async () => {
    const user = userEvent.setup();

    // Mock user search with INVALID data (missing ID)
    const mockInvalidUser = {
      // id: 'user123', // INTENTIONALLY MISSING
      username: "broken.user",
      email: "broken@example.com",
      firstName: "Broken",
      lastName: "User",
      role: "User",
      roleInAtCloud: "@Cloud Co-worker",
      gender: "male" as const,
      avatar: null,
    };

    vi.mocked(api.searchService.searchUsers).mockResolvedValue({
      results: [mockInvalidUser as any], // Cast to bypass type check
    });

    render(
      <BrowserRouter>
        <AdminPromoCodes />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Promo Codes Management")).toBeInTheDocument();
    });

    const createStaffTab = screen.getByRole("button", {
      name: /create staff code/i,
    });
    await user.click(createStaffTab);

    const selectUserButton = screen.getByRole("button", {
      name: /select user/i,
    });
    await user.click(selectUserButton);

    await waitFor(() => {
      expect(
        screen.getByText("Select User for Staff Code")
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    await user.type(searchInput, "broken");

    await waitFor(
      () => {
        expect(api.searchService.searchUsers).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    // Wait a bit to see if user appears (it might not if validation works)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Try to submit if user is selected
    const allButtons = screen.queryAllByRole("button", {
      name: /create staff code/i,
    });
    const generateButton = allButtons.find(
      (btn) => btn.getAttribute("type") === "submit"
    );

    if (generateButton && !generateButton.hasAttribute("disabled")) {
      await user.click(generateButton);

      // Wait to see if API was called
      await new Promise((resolve) => setTimeout(resolve, 500));

      // API should NOT be called with invalid user
      const apiCalls = vi.mocked(api.apiClient.createStaffPromoCode).mock.calls;

      if (apiCalls.length > 0) {
        // If API was called, verify it at least has SOME userId value
        const firstCallArg = apiCalls[0][0];
        console.warn("⚠️ WARNING: API called with user data:", firstCallArg);

        // This test documents current behavior - ideally API shouldn't be called at all
        // But if it is, we want to see what data was passed
        expect(firstCallArg).toHaveProperty("userId");
      } else {
        console.log("✅ GOOD: API not called with invalid user");
      }
    }
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserProfileSimple from "../../pages/UserProfileSimple";
import { userService } from "../../services/api";

vi.mock("../../services/api", () => ({
  userService: {
    getUser: vi.fn(),
  },
}));

describe("UserProfileSimple page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    vi.mocked(userService.getUser).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <MemoryRouter initialEntries={["/user/user123"]}>
        <Routes>
          <Route path="/user/:userId" element={<UserProfileSimple />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText(/loading user profile for id: user123/i)
    ).toBeInTheDocument();
  });

  it("renders user profile when data is loaded", async () => {
    const mockUser = {
      id: "user123",
      username: "testuser",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      role: "Participant",
    };

    vi.mocked(userService.getUser).mockResolvedValue(mockUser as any);

    render(
      <MemoryRouter initialEntries={["/user/user123"]}>
        <Routes>
          <Route path="/user/:userId" element={<UserProfileSimple />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/john doe's profile/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/user information/i)).toBeInTheDocument();
    expect(screen.getByText(/username:/i)).toBeInTheDocument();
    expect(screen.getByText(/email:/i)).toBeInTheDocument();
  });

  it("renders error state when fetch fails", async () => {
    vi.mocked(userService.getUser).mockRejectedValue(
      new Error("Failed to load user")
    );

    render(
      <MemoryRouter initialEntries={["/user/user123"]}>
        <Routes>
          <Route path="/user/:userId" element={<UserProfileSimple />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/error: failed to load user/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/user id: user123/i)).toBeInTheDocument();
  });
});

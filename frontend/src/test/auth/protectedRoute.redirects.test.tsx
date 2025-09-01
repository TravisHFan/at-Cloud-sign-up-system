import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "../../components/common/ProtectedRoute";

// Mock useAuth with a controllable implementation per test
const useAuthMock = vi.fn();
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

describe("ProtectedRoute redirects and access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no token leakage influences anything
    localStorage.removeItem("authToken");
  });

  it("redirects unauthenticated users to /login", async () => {
    useAuthMock.mockReturnValue({ currentUser: null, isLoading: false });

    render(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route
            path="/private"
            element={
              <ProtectedRoute>
                <div>Private Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Login Page/i)).toBeInTheDocument();
  });

  it("redirects unauthorized roles to /dashboard when allowedRoles does not include user role", async () => {
    useAuthMock.mockReturnValue({
      currentUser: { id: "u1", role: "Participant" },
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/analytics"]}>
        <Routes>
          <Route
            path="/dashboard/analytics"
            element={
              <ProtectedRoute
                allowedRoles={["Super Admin", "Administrator", "Leader"]}
              >
                <div>Analytics Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<div>Welcome Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Welcome Page/i)).toBeInTheDocument();
  });

  it("allows authorized roles to access protected content", async () => {
    useAuthMock.mockReturnValue({
      currentUser: { id: "admin", role: "Administrator" },
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/analytics"]}>
        <Routes>
          <Route
            path="/dashboard/analytics"
            element={
              <ProtectedRoute
                allowedRoles={["Super Admin", "Administrator", "Leader"]}
              >
                <div>Analytics Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<div>Welcome Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Analytics Content/i)).toBeInTheDocument();
  });
});

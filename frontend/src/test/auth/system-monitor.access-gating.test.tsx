import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "../../components/common/ProtectedRoute";

const useAuthMock = vi.fn();
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

describe("System Monitor access gating (/dashboard/monitor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("authToken");
  });

  it("redirects non-Super Admins to /dashboard", async () => {
    useAuthMock.mockReturnValue({
      currentUser: { id: "u2", role: "Administrator" },
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/monitor"]}>
        <Routes>
          <Route
            path="/dashboard/monitor"
            element={
              <ProtectedRoute allowedRoles={["Super Admin"]}>
                <div>System Monitor</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Dashboard Home/i)).toBeInTheDocument();
  });

  it("allows Super Admin to see System Monitor", async () => {
    useAuthMock.mockReturnValue({
      currentUser: { id: "sa1", role: "Super Admin" },
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/monitor"]}>
        <Routes>
          <Route
            path="/dashboard/monitor"
            element={
              <ProtectedRoute allowedRoles={["Super Admin"]}>
                <div>System Monitor</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/System Monitor/i)).toBeInTheDocument();
  });
});

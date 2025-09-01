import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "../../components/common/ProtectedRoute";

const useAuthMock = vi.fn();
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

describe("Recurring Event Config access gating (/dashboard/event-config)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("authToken");
  });

  it("redirects Participant to /dashboard", async () => {
    useAuthMock.mockReturnValue({
      currentUser: { id: "u3", role: "Participant" },
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/event-config"]}>
        <Routes>
          <Route
            path="/dashboard/event-config"
            element={
              <ProtectedRoute
                allowedRoles={["Super Admin", "Administrator", "Leader"]}
              >
                <div>Recurring Config</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Dashboard Home/i)).toBeInTheDocument();
  });

  it("allows Leader to access Recurring Config", async () => {
    useAuthMock.mockReturnValue({
      currentUser: { id: "lead1", role: "Leader" },
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/event-config"]}>
        <Routes>
          <Route
            path="/dashboard/event-config"
            element={
              <ProtectedRoute
                allowedRoles={["Super Admin", "Administrator", "Leader"]}
              >
                <div>Recurring Config</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Recurring Config/i)).toBeInTheDocument();
  });
});

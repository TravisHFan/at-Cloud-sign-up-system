import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Analytics from "../../pages/Analytics";

// Mock Auth to simulate a regular Participant (no analytics access)
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "u1", role: "Participant" } }),
}));

// Avoid hitting real backend hooks; provide minimal shape
vi.mock("../../hooks/useBackendIntegration", () => ({
  useAnalyticsData: () => ({
    eventAnalytics: { upcomingEvents: [], completedEvents: [] },
    exportData: vi.fn(),
  }),
}));

// Provide minimal user data and role stats hooks
vi.mock("../../hooks/useUserData", () => ({
  useUserData: () => ({ users: [] }),
}));
vi.mock("../../hooks/useRoleStats", () => ({
  useRoleStats: () => ({
    perRole: {},
    totals: { totalRoles: 0, totalCapacity: 0, totalSignups: 0 },
  }),
}));

describe("Analytics access gating", () => {
  beforeEach(() => {
    // Ensure token state doesn't leak across tests
    localStorage.removeItem("authToken");
  });

  it("shows Access Restricted for non-privileged users", async () => {
    render(
      <MemoryRouter initialEntries={["/analytics"]}>
        <Routes>
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /You don't have permission to access the Analytics dashboard\./i
      )
    ).toBeInTheDocument();
  });
});

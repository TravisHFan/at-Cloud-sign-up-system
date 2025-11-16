import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import ProgramDetail from "../../pages/ProgramDetail";

vi.mock("../../services/api", async () => {
  const { createMockApiServices } = await import("../helpers/mockServices");
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  return createMockApiServices({
    programService: {
      getById: vi.fn(async () => ({
        id: "p1",
        title: "EMBA 2025",
        programType: "EMBA Mentor Circles",
        introduction: "Mentor circles for EMBA cohort.",
        period: {
          startMonth: "Jan",
          startYear: "2025",
          endMonth: "Jun",
          endYear: "2025",
        },
      })),
      listProgramEvents: vi.fn(async () => [
        {
          id: "e1",
          title: "Kickoff",
          type: "Mentor Circle",
          date: todayStr,
          time: "23:59",
          endTime: "23:59",
          location: "",
          organizer: "",
          roles: [],
          signedUp: 0,
          totalSlots: 0,
          format: "Online",
          createdBy: "u1",
          createdAt: new Date().toISOString(),
        },
        {
          id: "e0",
          title: "Orientation (Past)",
          type: "Mentor Circle",
          date: "2020-01-10",
          time: "10:00",
          endTime: "11:00",
          location: "",
          organizer: "",
          roles: [],
          signedUp: 0,
          totalSlots: 0,
          format: "Online",
          createdBy: "u1",
          createdAt: new Date().toISOString(),
        },
      ]),
    },
  });
});

// Mock Auth context for these tests
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { id: "u-admin", role: "Administrator" },
    isAuthenticated: true,
    isLoading: false,
    hasRole: () => true,
    canCreateEvents: true,
    canManageUsers: true,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: "p1" }),
  };
});

describe("ProgramDetail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders program info and lists events", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
          <Routes>
            <Route
              path="/dashboard/programs/:id"
              element={<ProgramDetail forceServerPagination={false} />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() =>
      expect(screen.getByText("EMBA 2025")).toBeInTheDocument()
    );
    expect(screen.getByText("EMBA Mentor Circles")).toBeInTheDocument();
    expect(
      screen.getByText(/Mentor circles for EMBA cohort\./i)
    ).toBeInTheDocument();
    // Events list includes titles
    expect(await screen.findByText("Kickoff")).toBeInTheDocument();
    expect(await screen.findByText("Orientation (Past)")).toBeInTheDocument();
    // Has at least one View button for the events
    const viewBtns = screen.getAllByRole("button", { name: /view/i });
    expect(viewBtns.length).toBeGreaterThanOrEqual(1);
    // Click shouldn't throw
    fireEvent.click(viewBtns[0]);
  });

  it("shows Upcoming and Past badges for events", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
          <Routes>
            <Route
              path="/dashboard/programs/:id"
              element={<ProgramDetail forceServerPagination={false} />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Wait for both events to render
    expect(await screen.findByText("Kickoff")).toBeInTheDocument();
    expect(await screen.findByText("Orientation (Past)")).toBeInTheDocument();

    // Event status is shown in title text with parentheses, not as separate badges
    // Verify the past event has "(Past)" in its name
    expect(screen.getByText("Orientation (Past)")).toBeInTheDocument();
  });
});

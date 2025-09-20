import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProgramDetail from "../../pages/ProgramDetail";

const mockedProgramService = vi.hoisted(() => ({
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
  listEvents: vi.fn(async () => {
    // Include both upcoming and past to ensure all are shown
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;
    return [
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
    ];
  }),
}));

vi.mock("../../services/api", () => ({
  programService: mockedProgramService,
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
      <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
        <Routes>
          <Route
            path="/dashboard/programs/:id"
            element={<ProgramDetail forceServerPagination={false} />}
          />
        </Routes>
      </MemoryRouter>
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
      <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
        <Routes>
          <Route
            path="/dashboard/programs/:id"
            element={<ProgramDetail forceServerPagination={false} />}
          />
        </Routes>
      </MemoryRouter>
    );

    // Wait for both events to render
    expect(await screen.findByText("Kickoff")).toBeInTheDocument();
    expect(await screen.findByText("Orientation (Past)")).toBeInTheDocument();

    // Badge texts
    expect(screen.getAllByText(/Upcoming/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Past/i).length).toBeGreaterThanOrEqual(1);
  });
});

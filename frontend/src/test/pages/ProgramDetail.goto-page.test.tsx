import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProgramDetail from "../../pages/ProgramDetail";
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

const genEvents = (count: number) =>
  Array.from({ length: count }).map((_, i) => ({
    id: `e${i + 1}`,
    title: `Event ${i + 1}`,
    type: "Mentor Circle",
    date: `2025-01-${String(((i + 1) % 28) + 1).padStart(2, "0")}`,
    time: "10:00",
    endTime: "11:00",
    location: "",
    organizer: "",
    roles: [],
    signedUp: 0,
    totalSlots: 0,
    format: "Online" as const,
    createdBy: "u1",
    createdAt: new Date().toISOString(),
  }));

const mockedProgramService = vi.hoisted(() => ({
  getById: vi.fn(async () => ({
    id: "p1",
    title: "EMBA 2025",
    programType: "EMBA Mentor Circles" as const,
    introduction: "Mentor circles for EMBA cohort.",
  })),
  listEvents: vi.fn(async () => genEvents(45)),
  listEventsPaged: vi.fn(),
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

describe("ProgramDetail go-to-page input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("jumps to a page on Enter and clamps out-of-range with announcements", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
        <Routes>
          <Route path="/dashboard/programs/:id" element={<ProgramDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText("EMBA 2025")).toBeInTheDocument()
    );
    const eventsHeading = screen.getByRole("heading", { name: /events/i });
    const section = eventsHeading.closest("div")!.parentElement!;

    // total pages should be 3 (45 events, 20 per page)
    expect(within(section).getByText(/Page 1 of 3/)).toBeInTheDocument();

    const input = within(section).getByLabelText(
      /go to page/i
    ) as HTMLInputElement;
    // Jump directly to page 3
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(within(section).getByText(/Page 3 of 3/)).toBeInTheDocument()
    );

    // Out of range: 999 should clamp to 3
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(within(section).getByText(/Page 3 of 3/)).toBeInTheDocument()
    );
    // announcement (aria-live region may update after debounce)
    await waitFor(() =>
      expect(screen.getByText(/Clamped to page 3 of 3/i)).toBeInTheDocument()
    );

    // Less than 1: 0 should clamp to 1 on blur
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(within(section).getByText(/Page 1 of 3/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText(/Clamped to page 1 of 3/i)).toBeInTheDocument()
    );
  });
});

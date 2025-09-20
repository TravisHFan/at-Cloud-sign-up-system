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

const genEvents = (count: number) =>
  Array.from({ length: count }).map((_, i) => {
    const idx = i + 1;
    const day = String((idx % 28) + 1).padStart(2, "0");
    return {
      id: `e${idx}`,
      title: `Event ${idx}`,
      type: "Mentor Circle",
      date: `2025-01-${day}`,
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
    };
  });

const mockedProgramService = vi.hoisted(() => ({
  getById: vi.fn(async () => ({
    id: "p1",
    title: "EMBA 2025",
    programType: "EMBA Mentor Circles" as const,
    introduction: "Mentor circles for EMBA cohort.",
  })),
  listEvents: vi.fn(async () => genEvents(21)),
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

describe("ProgramDetail Events Pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to page 1 and limit 20", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
        <Routes>
          <Route path="/dashboard/programs/:id" element={<ProgramDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for heading to ensure page loaded
    await waitFor(() =>
      expect(screen.getByText("EMBA 2025")).toBeInTheDocument()
    );

    // Scope queries to the Events section container
    const eventsHeading = screen.getByRole("heading", { name: /events/i });
    const section = eventsHeading.closest("div")!.parentElement!; // container with the list

    const pageInfo = within(section).getByText(/Page \d+ of \d+/i);
    expect(pageInfo.textContent).toMatch(/Page 1 of 2/);

    const list = within(section).getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBe(20);
  });

  it("navigates Prev/Next with disabled edge states", async () => {
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

    const prev = within(section).getByRole("button", {
      name: /previous page/i,
    });
    const next = within(section).getByRole("button", { name: /next page/i });
    expect(prev).toBeDisabled();

    // Go to page 2
    fireEvent.click(next);
    expect(within(section).getByText(/Page 2 of 2/)).toBeInTheDocument();
    expect(next).toBeDisabled();

    const list = within(section).getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBe(1);

    // Go back to page 1
    fireEvent.click(prev);
    expect(within(section).getByText(/Page 1 of 2/)).toBeInTheDocument();
  });
});

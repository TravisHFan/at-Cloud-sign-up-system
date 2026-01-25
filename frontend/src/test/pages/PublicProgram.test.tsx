import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import PublicProgram from "../../pages/PublicProgram";

// Mock the API
vi.mock("../../services/api", () => ({
  programService: {
    getById: vi.fn(),
  },
}));

// Mock the Icon component
vi.mock("../../components/common", () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>
      {name}
    </span>
  ),
}));

// Mock Multiline component
vi.mock("../../components/common/Multiline", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

// Mock LoadingSpinner
vi.mock("../../components/common/LoadingSpinner", () => ({
  default: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// Mock formatCurrency
vi.mock("../../utils/currency", () => ({
  formatCurrency: (amount: number) => `$${(amount / 100).toFixed(2)}`,
}));

// Mock avatarUtils
vi.mock("../../utils/avatarUtils", () => ({
  getAvatarAlt: (first: string, last: string) => `${first} ${last} avatar`,
}));

import { programService } from "../../services/api";

const mockProgramService = programService as unknown as {
  getById: ReturnType<typeof vi.fn>;
};

function renderPublicProgram(programId: string) {
  return render(
    <MemoryRouter initialEntries={[`/pr/${programId}`]}>
      <Routes>
        <Route path="/pr/:id" element={<PublicProgram />} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/events" element={<div>Events Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicProgram page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should show loading spinner while fetching program", () => {
    mockProgramService.getById.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    renderPublicProgram("program-123");

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("should show 'Program Not Found' when program does not exist", async () => {
    mockProgramService.getById.mockRejectedValue(new Error("Not found"));

    renderPublicProgram("nonexistent-id");

    await waitFor(() => {
      expect(screen.getByText("Program Not Found")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "This program may have been removed or the link is invalid.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Browse Public Events")).toBeInTheDocument();
  });

  it("should display active program details", async () => {
    const futureProgram = {
      id: "program-123",
      title: "Leadership Academy 2027",
      programType: "Leadership Development",
      hostedBy: "@Cloud Ministry",
      period: {
        startYear: "2027",
        startMonth: "09",
        endYear: "2028",
        endMonth: "05",
      },
      introduction: "Join our transformative leadership program.",
      mentors: [
        {
          userId: "mentor-1",
          firstName: "John",
          lastName: "Smith",
          roleInAtCloud: "Senior Pastor",
          gender: "male",
        },
      ],
      isFree: false,
      fullPriceTicket: 49900, // $499.00
      classRepDiscount: 5000, // $50.00
      earlyBirdDiscount: 2500, // $25.00
    };

    mockProgramService.getById.mockResolvedValue(futureProgram);

    renderPublicProgram("program-123");

    await waitFor(() => {
      expect(screen.getByText("Leadership Academy 2027")).toBeInTheDocument();
    });

    // Check program type and period are displayed
    expect(screen.getByText("Leadership Development")).toBeInTheDocument();
    expect(screen.getByText("September 2027 – May 2028")).toBeInTheDocument();

    // Check introduction
    expect(
      screen.getByText("Join our transformative leadership program."),
    ).toBeInTheDocument();

    // Check mentor is displayed
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Senior Pastor")).toBeInTheDocument();

    // Check pricing
    expect(screen.getByText("$499.00")).toBeInTheDocument(); // Full price
    expect(screen.getByText("$50.00")).toBeInTheDocument(); // Class rep discount

    // Check CTA
    expect(screen.getByText("Ready to Join?")).toBeInTheDocument();
    expect(screen.getByText("Enroll Now")).toBeInTheDocument();
  });

  it("should display 'program finished' message when end month has passed", async () => {
    const finishedProgram = {
      id: "program-finished",
      title: "Leadership Academy 2024",
      programType: "Leadership Development",
      period: {
        startYear: "2024",
        startMonth: "09",
        endYear: "2025",
        endMonth: "05", // May 2025 is in the past (current date is Jan 2026)
      },
      introduction: "This program has ended.",
      mentors: [],
    };

    mockProgramService.getById.mockResolvedValue(finishedProgram);

    renderPublicProgram("program-finished");

    await waitFor(() => {
      expect(screen.getByText("Leadership Academy 2024")).toBeInTheDocument();
    });

    // Should show completion message
    expect(
      screen.getByText("This program has been completed."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Thank you to all participants and mentors for their dedication!",
      ),
    ).toBeInTheDocument();

    // Should NOT show the "Enroll Now" button
    expect(screen.queryByText("Enroll Now")).not.toBeInTheDocument();

    // Should show links to explore other programs
    expect(screen.getByText("Sign In to Explore Programs")).toBeInTheDocument();
    expect(screen.getByText("Browse Public Events")).toBeInTheDocument();
  });

  it("should display free program correctly", async () => {
    const freeProgram = {
      id: "program-free",
      title: "Free Workshop 2027",
      programType: "Workshop",
      period: {
        startYear: "2027",
        startMonth: "06",
        endYear: "2027",
        endMonth: "06",
      },
      isFree: true,
      mentors: [],
    };

    mockProgramService.getById.mockResolvedValue(freeProgram);

    renderPublicProgram("program-free");

    await waitFor(() => {
      expect(screen.getByText("Free Workshop 2027")).toBeInTheDocument();
    });

    expect(screen.getByText("This is a free program")).toBeInTheDocument();
  });

  it("should show 'Tuition information coming soon' when no pricing set", async () => {
    const noPricingProgram = {
      id: "program-no-pricing",
      title: "New Program 2027",
      programType: "Training",
      period: {
        startYear: "2027",
        startMonth: "01",
        endYear: "2027",
        endMonth: "12",
      },
      isFree: false,
      fullPriceTicket: undefined,
      mentors: [],
    };

    mockProgramService.getById.mockResolvedValue(noPricingProgram);

    renderPublicProgram("program-no-pricing");

    await waitFor(() => {
      expect(screen.getByText("New Program 2027")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Tuition information coming soon."),
    ).toBeInTheDocument();
  });

  it("should display flyer image when available", async () => {
    const programWithFlyer = {
      id: "program-flyer",
      title: "Program with Flyer",
      programType: "Conference",
      period: {
        startYear: "2027",
        startMonth: "03",
        endYear: "2027",
        endMonth: "03",
      },
      flyerUrl: "https://example.com/flyer.jpg",
      mentors: [],
    };

    mockProgramService.getById.mockResolvedValue(programWithFlyer);

    renderPublicProgram("program-flyer");

    await waitFor(() => {
      expect(screen.getByText("Program with Flyer")).toBeInTheDocument();
    });

    const flyerImg = screen.getByAltText("Program with Flyer flyer");
    expect(flyerImg).toBeInTheDocument();
    expect(flyerImg).toHaveAttribute("src", "https://example.com/flyer.jpg");
  });

  it("should display class rep slot availability when limit is set", async () => {
    const programWithSlots = {
      id: "program-slots",
      title: "Program with Class Rep Slots",
      programType: "Training",
      period: {
        startYear: "2027",
        startMonth: "01",
        endYear: "2027",
        endMonth: "12",
      },
      isFree: false,
      fullPriceTicket: 30000,
      classRepDiscount: 5000,
      classRepLimit: 10,
      classRepCount: 3,
      mentors: [],
    };

    mockProgramService.getById.mockResolvedValue(programWithSlots);

    renderPublicProgram("program-slots");

    await waitFor(() => {
      expect(
        screen.getByText("Program with Class Rep Slots"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("3 / 10 slots filled")).toBeInTheDocument();
  });
});

describe("PublicProgram - isProgramFinished logic", () => {
  // Note: These tests use programs with dates far in the past or future
  // to avoid needing fake timers which can cause timeout issues with async tests

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should consider program finished when end year is clearly in the past", async () => {
    // Use a date that's definitely in the past (2020)
    const oldProgram = {
      id: "old-program",
      title: "2020 Program",
      programType: "Training",
      period: {
        startYear: "2020",
        startMonth: "01",
        endYear: "2020",
        endMonth: "12",
      },
      mentors: [],
    };

    mockProgramService.getById.mockResolvedValue(oldProgram);

    renderPublicProgram("old-program");

    await waitFor(() => {
      expect(
        screen.getByText("This program has been completed."),
      ).toBeInTheDocument();
    });
  });

  it("should consider program finished when end date is last year", async () => {
    // Use 2024 which is definitely in the past (current date is Jan 2026)
    const finishedProgram = {
      id: "finished-last-year",
      title: "Program Ended Last Year",
      programType: "Training",
      period: {
        startYear: "2024",
        startMonth: "01",
        endYear: "2024",
        endMonth: "12",
      },
      mentors: [],
    };

    mockProgramService.getById.mockResolvedValue(finishedProgram);

    renderPublicProgram("finished-last-year");

    await waitFor(() => {
      expect(
        screen.getByText("This program has been completed."),
      ).toBeInTheDocument();
    });
  });

  it("should NOT consider program finished when end date is far in the future", async () => {
    // Use 2030 which is definitely in the future
    const futureProgram = {
      id: "future-program",
      title: "Future Program",
      programType: "Training",
      period: {
        startYear: "2029",
        startMonth: "09",
        endYear: "2030",
        endMonth: "06",
      },
      mentors: [],
    };

    mockProgramService.getById.mockResolvedValue(futureProgram);

    renderPublicProgram("future-program");

    await waitFor(() => {
      expect(screen.getByText("Future Program")).toBeInTheDocument();
    });

    // Should show Enroll button, not completion message
    expect(screen.getByText("Enroll Now")).toBeInTheDocument();
    expect(
      screen.queryByText("This program has been completed."),
    ).not.toBeInTheDocument();
  });

  it("should NOT consider program finished when no end date is set", async () => {
    const noEndDateProgram = {
      id: "no-end-date",
      title: "Evergreen Program",
      programType: "Training",
      period: {
        startYear: "2025",
        startMonth: "01",
        // No endYear or endMonth
      },
      mentors: [],
    };

    mockProgramService.getById.mockResolvedValue(noEndDateProgram);

    renderPublicProgram("no-end-date");

    await waitFor(() => {
      expect(screen.getByText("Evergreen Program")).toBeInTheDocument();
    });

    expect(screen.getByText("Enroll Now")).toBeInTheDocument();
  });
});

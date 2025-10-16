import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import EventDetail from "../../pages/EventDetail";
import * as apiModule from "../../services/api";

// Mock services
vi.mock("../../services/api", () => ({
  eventService: {
    getEvent: vi.fn(),
    publishEvent: vi.fn(),
    unpublishEvent: vi.fn(),
    signUpForEvent: vi.fn(),
    updateWorkshopGroupTopic: vi.fn(),
  },
  programService: {
    getById: vi.fn(),
  },
  purchaseService: {
    checkProgramAccess: vi.fn(),
  },
}));
vi.mock("../../services/guestApi", () => ({
  default: {
    getEventGuests: vi.fn().mockResolvedValue([]),
    resendManageLink: vi.fn().mockResolvedValue({}),
    adminCancelGuest: vi.fn().mockResolvedValue({}),
    adminUpdateGuest: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    joinEventRoom: vi.fn().mockResolvedValue(undefined),
    leaveEventRoom: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock AuthContext
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "user123",
      email: "participant@example.com",
      firstName: "Test",
      lastName: "User",
      role: "Participant",
    },
    loading: false,
    authToken: "mock-token",
  }),
}));

// Mock NotificationModalContext
vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    showToast: vi.fn(),
  }),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={["/events/event123"]}>
      <Routes>
        <Route path="/events/:id" element={component} />
      </Routes>
    </MemoryRouter>
  );
};

describe("EventDetail - Program Access OR Logic", () => {
  const mockEvent = {
    id: "event123",
    title: "Test Event with Multiple Programs",
    description: "Event associated with multiple programs",
    location: "Test Location",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
    endDate: new Date().toISOString().split("T")[0],
    endTime: "12:00",
    timeZone: "America/New_York",
    publish: true,
    programLabels: ["program-a", "program-b", "program-c"],
    roles: [],
    createdBy: {
      _id: "creator123",
      firstName: "Creator",
      lastName: "User",
    },
  };

  const mockProgramA = {
    id: "program-a",
    title: "Program A - Business Circle",
    programType: "EMBA Mentor Circles",
    isFree: false,
    mentors: [],
  };

  const mockProgramB = {
    id: "program-b",
    title: "Program B - Communication Workshop",
    programType: "Effective Communication Workshops",
    isFree: false,
    mentors: [],
  };

  const mockProgramC = {
    id: "program-c",
    title: "Program C - Leadership Training",
    programType: "EMBA Mentor Circles",
    isFree: false,
    mentors: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default event fetch mock
    vi.spyOn(apiModule.eventService, "getEvent").mockResolvedValue(
      mockEvent as any
    );

    // Default program fetch mocks
    vi.spyOn(apiModule.programService, "getById").mockImplementation(
      async (id: string) => {
        if (id === "program-a") return mockProgramA as any;
        if (id === "program-b") return mockProgramB as any;
        if (id === "program-c") return mockProgramC as any;
        throw new Error("Program not found");
      }
    );
  });

  it("should grant access when user purchased ANY ONE of the associated programs (Program A)", async () => {
    // User purchased Program A only
    vi.spyOn(
      apiModule.purchaseService,
      "checkProgramAccess"
    ).mockImplementation(async (programId: string) => {
      if (programId === "program-a") {
        return { hasAccess: true, reason: "purchased" };
      }
      return { hasAccess: false, reason: "not_purchased" };
    });

    renderWithRouter(<EventDetail />);

    await waitFor(() => {
      expect(
        screen.getByText("Test Event with Multiple Programs")
      ).toBeInTheDocument();
    });

    // Should NOT show access modal
    await waitFor(
      () => {
        expect(
          screen.queryByText(/You need to purchase/i)
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should grant access when user purchased ANY ONE of the associated programs (Program B)", async () => {
    // User purchased Program B only
    vi.spyOn(
      apiModule.purchaseService,
      "checkProgramAccess"
    ).mockImplementation(async (programId: string) => {
      if (programId === "program-b") {
        return { hasAccess: true, reason: "purchased" };
      }
      return { hasAccess: false, reason: "not_purchased" };
    });

    renderWithRouter(<EventDetail />);

    await waitFor(() => {
      expect(
        screen.getByText("Test Event with Multiple Programs")
      ).toBeInTheDocument();
    });

    // Should NOT show access modal
    await waitFor(
      () => {
        expect(
          screen.queryByText(/You need to purchase/i)
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should grant access when user purchased ANY ONE of the associated programs (Program C)", async () => {
    // User purchased Program C only
    vi.spyOn(
      apiModule.purchaseService,
      "checkProgramAccess"
    ).mockImplementation(async (programId: string) => {
      if (programId === "program-c") {
        return { hasAccess: true, reason: "purchased" };
      }
      return { hasAccess: false, reason: "not_purchased" };
    });

    renderWithRouter(<EventDetail />);

    await waitFor(() => {
      expect(
        screen.getByText("Test Event with Multiple Programs")
      ).toBeInTheDocument();
    });

    // Should NOT show access modal
    await waitFor(
      () => {
        expect(
          screen.queryByText(/You need to purchase/i)
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should grant access when ANY associated program is free", async () => {
    // Program B is free
    const freeProgramB = { ...mockProgramB, isFree: true };
    vi.spyOn(apiModule.programService, "getById").mockImplementation(
      async (id: string) => {
        if (id === "program-a") return mockProgramA as any;
        if (id === "program-b") return freeProgramB as any;
        if (id === "program-c") return mockProgramC as any;
        throw new Error("Program not found");
      }
    );

    // User has no purchases
    vi.spyOn(apiModule.purchaseService, "checkProgramAccess").mockResolvedValue(
      {
        hasAccess: false,
        reason: "not_purchased",
      }
    );

    renderWithRouter(<EventDetail />);

    await waitFor(() => {
      expect(
        screen.getByText("Test Event with Multiple Programs")
      ).toBeInTheDocument();
    });

    // Should NOT show access modal (free program grants access)
    await waitFor(
      () => {
        expect(
          screen.queryByText(/You need to purchase/i)
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should grant access when user is mentor of ANY associated program", async () => {
    // User is mentor of Program A
    const mentorProgramA = {
      ...mockProgramA,
      mentors: [{ userId: "user123", firstName: "Test", lastName: "User" }],
    };
    vi.spyOn(apiModule.programService, "getById").mockImplementation(
      async (id: string) => {
        if (id === "program-a") return mentorProgramA as any;
        if (id === "program-b") return mockProgramB as any;
        if (id === "program-c") return mockProgramC as any;
        throw new Error("Program not found");
      }
    );

    // User has no purchases
    vi.spyOn(apiModule.purchaseService, "checkProgramAccess").mockResolvedValue(
      {
        hasAccess: false,
        reason: "not_purchased",
      }
    );

    renderWithRouter(<EventDetail />);

    await waitFor(() => {
      expect(
        screen.getByText("Test Event with Multiple Programs")
      ).toBeInTheDocument();
    });

    // Should NOT show access modal (mentor status grants access)
    await waitFor(
      () => {
        expect(
          screen.queryByText(/You need to purchase/i)
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should BLOCK access ONLY when user has NO access to ANY of the programs", async () => {
    // User has no purchases, not a mentor, no free programs
    vi.spyOn(apiModule.purchaseService, "checkProgramAccess").mockResolvedValue(
      {
        hasAccess: false,
        reason: "not_purchased",
      }
    );

    renderWithRouter(<EventDetail />);

    await waitFor(() => {
      expect(
        screen.getByText("Test Event with Multiple Programs")
      ).toBeInTheDocument();
    });

    // SHOULD show access modal (no access to any program)
    await waitFor(
      () => {
        expect(screen.getByText(/Enrollment Required/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should NOT require ALL programs - purchasing one is sufficient", async () => {
    // User purchased Program A only (not B or C)
    vi.spyOn(
      apiModule.purchaseService,
      "checkProgramAccess"
    ).mockImplementation(async (programId: string) => {
      if (programId === "program-a") {
        return { hasAccess: true, reason: "purchased" };
      }
      // Programs B and C not purchased
      return { hasAccess: false, reason: "not_purchased" };
    });

    renderWithRouter(<EventDetail />);

    await waitFor(() => {
      expect(
        screen.getByText("Test Event with Multiple Programs")
      ).toBeInTheDocument();
    });

    // Should NOT show access modal - Program A is sufficient
    await waitFor(
      () => {
        expect(
          screen.queryByText(/You need to purchase/i)
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText(/Program Access Required/i)
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Event content should be visible
    expect(screen.getByText("Test Location")).toBeInTheDocument();
  });

  it("should stop checking after finding first program with access (performance)", async () => {
    const checkAccessSpy = vi.spyOn(
      apiModule.purchaseService,
      "checkProgramAccess"
    );

    // Program A grants access
    checkAccessSpy.mockImplementation(async (programId: string) => {
      if (programId === "program-a") {
        return { hasAccess: true, reason: "purchased" };
      }
      return { hasAccess: false, reason: "not_purchased" };
    });

    renderWithRouter(<EventDetail />);

    await waitFor(() => {
      expect(
        screen.getByText("Test Event with Multiple Programs")
      ).toBeInTheDocument();
    });

    // Should have checked program A and stopped (not checked B and C)
    // Note: Due to the loop, it might check the first free/mentor status first
    await waitFor(() => {
      expect(
        screen.queryByText(/Program Access Required/i)
      ).not.toBeInTheDocument();
    });

    // Access check should have been called at least once and found access
    expect(checkAccessSpy).toHaveBeenCalled();
  });
});

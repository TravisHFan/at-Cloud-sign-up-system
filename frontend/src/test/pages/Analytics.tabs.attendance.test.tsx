import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Analytics from "../../pages/Analytics";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: { id: "admin", role: "Administrator" },
  }),
}));

vi.mock("../../hooks/useUserData", () => ({
  useUserData: () => ({ users: [], loading: false }),
}));

vi.mock("../../hooks/useRoleStats", () => ({
  useRoleStats: () => ({
    total: 0,
    superAdmin: 0,
    administrators: 0,
    leaders: 0,
    guestExperts: 0,
    participants: 0,
    atCloudLeaders: 0,
  }),
}));

const resourceMocks = vi.hoisted(() => ({
  overview: vi.fn(),
  events: vi.fn(),
  attendance: vi.fn(),
  programs: vi.fn(),
  financialSummary: vi.fn(),
  donations: vi.fn(),
}));

vi.mock("../../hooks/useAnalyticsResources", () => ({
  useAnalyticsOverviewResource: (enabled: boolean) => {
    resourceMocks.overview(enabled);
    return {
      data: {
        overview: {
          totalUsers: 12,
          totalEvents: 7,
          totalRegistrations: 20,
          activeParticipants: 8,
          averageSignupRate: 50,
          activeUsers: 3,
          upcomingEvents: 2,
          recentRegistrations: 1,
        },
        growth: {
          userGrowthRate: 0,
          eventGrowthRate: 0,
          registrationGrowthRate: 0,
        },
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    };
  },
  useEventAnalyticsResource: (enabled: boolean) => {
    resourceMocks.events(enabled);
    return {
      data: { upcomingEvents: [], completedEvents: [] },
      loading: false,
      error: null,
      refresh: vi.fn(),
    };
  },
  useAttendanceAnalyticsResource: (enabled: boolean) => {
    resourceMocks.attendance(enabled);
    return {
      data: {
        summary: {
          registered: 3,
          attended: 2,
          absent: 1,
          unrecorded: 0,
          recorded: 3,
          attendanceRate: 66.6667,
          noShowRate: 33.3333,
          completionRate: 100,
        },
        byPerson: [
          {
            userId: "u1",
            name: "Ann Lee",
            roleInAtCloud: "Mentor",
            systemAuthorizationLevel: "Leader",
            programs: ["EMBA"],
            completedEvents: 2,
            registered: 2,
            attended: 2,
            absent: 0,
            unrecorded: 0,
            recorded: 2,
            attendanceRate: 100,
            noShowRate: 0,
            completionRate: 100,
            lastAttendedAt: "2026-01-02T00:00:00.000Z",
            lastAttendedEvent: "Leadership Night",
          },
          {
            userId: "u2",
            name: "Bob Kim",
            roleInAtCloud: "",
            systemAuthorizationLevel: "Participant",
            programs: ["EMBA"],
            completedEvents: 1,
            registered: 1,
            attended: 0,
            absent: 1,
            unrecorded: 0,
            recorded: 1,
            attendanceRate: 0,
            noShowRate: 100,
            completionRate: 100,
          },
        ],
        byProgram: [
          {
            programId: "p1",
            programTitle: "EMBA",
            programType: "EMBA Mentor Circles",
            completedEvents: 1,
            registered: 3,
            attended: 2,
            absent: 1,
            unrecorded: 0,
            recorded: 3,
            attendanceRate: 66.6667,
            noShowRate: 33.3333,
            completionRate: 100,
          },
        ],
        byEvent: [
          {
            eventId: "e1",
            eventTitle: "Leadership Night",
            eventDate: "2026-01-02T00:00:00.000Z",
            eventType: "Meeting",
            programs: [
              {
                id: "p1",
                title: "EMBA",
                programType: "EMBA Mentor Circles",
              },
            ],
            registered: 3,
            attended: 2,
            absent: 1,
            unrecorded: 0,
            recorded: 3,
            attendanceRate: 66.6667,
            noShowRate: 33.3333,
            completionRate: 100,
          },
        ],
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    };
  },
  useProgramAnalyticsResource: (enabled: boolean) => {
    resourceMocks.programs(enabled);
    return { data: null, loading: false, error: null, refresh: vi.fn() };
  },
  useFinancialSummaryResource: (enabled: boolean) => {
    resourceMocks.financialSummary(enabled);
    return { data: null, loading: false, error: null, refresh: vi.fn() };
  },
  useDonationAnalyticsResource: (enabled: boolean) => {
    resourceMocks.donations(enabled);
    return { data: null, loading: false, error: null, refresh: vi.fn() };
  },
}));

describe("Analytics tabs", () => {
  beforeEach(() => {
    Object.values(resourceMocks).forEach((mock) => mock.mockClear());
  });

  it("enables only the overview resource on the default tab", () => {
    render(
      <MemoryRouter initialEntries={["/analytics"]}>
        <NotificationProvider>
          <Analytics />
        </NotificationProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId("analytics-overview-cards")).toBeInTheDocument();
    expect(resourceMocks.overview).toHaveBeenCalledWith(true);
    expect(resourceMocks.events).toHaveBeenCalledWith(false);
    expect(resourceMocks.attendance).toHaveBeenCalledWith(false);
    expect(resourceMocks.programs).toHaveBeenCalledWith(false);
    expect(resourceMocks.financialSummary).toHaveBeenCalledWith(false);
    expect(resourceMocks.donations).toHaveBeenCalledWith(false);
  });

  it("renders attendance analysis and keeps unrelated resources disabled", () => {
    render(
      <MemoryRouter initialEntries={["/analytics?tab=attendance"]}>
        <NotificationProvider>
          <Analytics />
        </NotificationProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Attendance By Person")).toBeInTheDocument();
    expect(screen.getByText("Attendance By Program")).toBeInTheDocument();
    expect(screen.getByText("Attendance By Event")).toBeInTheDocument();
    expect(screen.getByText("Ann Lee")).toBeInTheDocument();
    expect(screen.getAllByText("EMBA").length).toBeGreaterThan(0);
    expect(resourceMocks.attendance).toHaveBeenCalledWith(true);
    expect(resourceMocks.events).toHaveBeenCalledWith(false);
    expect(resourceMocks.programs).toHaveBeenCalledWith(false);
  });
});

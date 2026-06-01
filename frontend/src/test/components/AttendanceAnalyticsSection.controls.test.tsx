import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttendanceAnalyticsSection } from "../../components/analytics/AttendanceAnalyticsSection";
import type {
  AttendanceAnalytics,
  AttendanceCounts,
  AttendanceEventAnalytics,
  AttendanceProgramAnalytics,
} from "../../services/api/analytics.api";

function counts({
  registered,
  attended,
  absent = 0,
  unrecorded = 0,
}: {
  registered: number;
  attended: number;
  absent?: number;
  unrecorded?: number;
}): AttendanceCounts {
  const recorded = attended + absent;

  return {
    registered,
    attended,
    absent,
    unrecorded,
    recorded,
    attendanceRate: recorded > 0 ? (attended / recorded) * 100 : 0,
    noShowRate: recorded > 0 ? (absent / recorded) * 100 : 0,
    completionRate: registered > 0 ? (recorded / registered) * 100 : 0,
  };
}

const programRows: AttendanceProgramAnalytics[] = [
  ["alpha", "Alpha Program", "EMBA Mentor Circles", 12],
  ["beta", "Beta Program", "Effective Communication Workshops", 9],
  ["delta", "Delta Program", "Webinar", 7],
  ["epsilon", "Epsilon Program", "NextGen", 5],
  ["eta", "Eta Program", "EMBA Mentor Circles", 11],
  ["gamma", "Gamma Program", "Webinar", 8],
  ["iota", "Iota Program", "NextGen", 6],
  ["kappa", "Kappa Program", "Effective Communication Workshops", 10],
  ["lambda", "Lambda Program", "Webinar", 4],
  ["theta", "Theta Program", "EMBA Mentor Circles", 13],
  [
    "zeta",
    "Zypher MCIP",
    "Marketplace Church Incubator Program (MCIP)",
    99,
  ],
].map(([id, title, type, registered]) => {
  const registeredCount = Number(registered);
  const isOffPageNoShow = title === "Zypher MCIP";

  return {
    programId: `program-${id}`,
    programTitle: String(title),
    programType: String(type),
    completedEvents: 2,
    ...counts({
      registered: registeredCount,
      attended: isOffPageNoShow ? 0 : Math.max(1, registeredCount - 2),
      absent: isOffPageNoShow ? registeredCount : 1,
      unrecorded: isOffPageNoShow ? 0 : 1,
    }),
  };
});

const eventRows: AttendanceEventAnalytics[] = [
  ["e01", "Alpha Gathering", "2026-01-01", "Meeting", "EMBA"],
  ["e02", "Beta Gathering", "2026-01-02", "Meeting", "Leadership"],
  ["e03", "Delta Gathering", "2026-01-03", "Office Hour", "EMBA"],
  ["e04", "Epsilon Gathering", "2026-01-04", "Meeting", "Leadership"],
  ["e05", "Eta Gathering", "2026-01-05", "Webinar", "NextGen"],
  ["e06", "Gamma Gathering", "2026-01-06", "Meeting", "EMBA"],
  ["e07", "Iota Gathering", "2026-01-07", "Office Hour", "NextGen"],
  ["e08", "Kappa Gathering", "2026-01-08", "Meeting", "Leadership"],
  ["e09", "Lambda Gathering", "2026-01-09", "Webinar", "EMBA"],
  ["e10", "Theta Gathering", "2026-01-10", "Meeting", "Leadership"],
  ["e11", "Zypher Board Review", "2026-02-01", "Workshop", "Finance"],
].map(([id, title, date, type, program], index) => ({
  eventId: String(id),
  eventTitle: String(title),
  eventDate: String(date),
  eventType: String(type),
  programs: [
    {
      id: `program-${program}`,
      title: String(program),
      programType: String(program),
    },
  ],
  ...counts({
    registered: index === 10 ? 99 : 10 + index,
    attended: index === 10 ? 94 : 8 + index,
    absent: 1,
  }),
}));

const analytics: AttendanceAnalytics = {
  summary: {
    ...counts({ registered: 120, attended: 100, absent: 10, unrecorded: 10 }),
  },
  byPerson: [
    {
      userId: "person-1",
      name: "Ann Lee",
      roleInAtCloud: "Mentor",
      systemAuthorizationLevel: "Leader",
      programs: ["EMBA"],
      completedEvents: 2,
      lastAttendedAt: "2026-01-02T00:00:00.000Z",
      lastAttendedEvent: "Leadership Night",
      ...counts({ registered: 2, attended: 2 }),
    },
  ],
  byProgram: programRows,
  byEvent: eventRows,
};

describe("AttendanceAnalyticsSection controls", () => {
  it("filters, fuzzy-searches, paginates, and sorts the Program sub-tab across the full dataset", () => {
    render(<AttendanceAnalyticsSection analytics={analytics} />);

    fireEvent.click(screen.getByRole("tab", { name: "By Program" }));
    expect(screen.getByText("Attendance By Program")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Zypher MCIP")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Page Size"), {
      target: { value: "25" },
    });
    expect(screen.getByText(/Showing 1-11 of 11 records/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Next page" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Zypher MCIP")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Page Size"), {
      target: { value: "10" },
    });
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Zypher MCIP")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Zypher MCIP")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "Zyphr" },
    });
    expect(screen.getByText("Zypher MCIP")).toBeInTheDocument();
    expect(screen.getByText(/1 of 11 records/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Attendance"), {
      target: { value: "none-attended" },
    });
    expect(screen.getByText("Zypher MCIP")).toBeInTheDocument();
    expect(screen.getByText(/1 of 11 records/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Attendance"), {
      target: { value: "__all" },
    });
    fireEvent.change(screen.getByLabelText("Program Type"), {
      target: { value: "Marketplace Church Incubator Program (MCIP)" },
    });
    expect(screen.getByText("Zypher MCIP")).toBeInTheDocument();
    expect(screen.getByText(/1 of 11 records/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Program Type"), {
      target: { value: "__all" },
    });
    fireEvent.change(screen.getByLabelText("Sort"), {
      target: { value: "registered" },
    });
    fireEvent.change(screen.getByLabelText("Direction"), {
      target: { value: "desc" },
    });

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Zypher MCIP")).toBeInTheDocument();
  });

  it("filters and fuzzy-searches the Event sub-tab across pages before pagination", () => {
    render(<AttendanceAnalyticsSection analytics={analytics} />);

    fireEvent.click(screen.getByRole("tab", { name: "By Event" }));
    expect(screen.getByText("Attendance By Event")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Zypher Board Review")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "Zyphr" },
    });
    expect(screen.getByText("Zypher Board Review")).toBeInTheDocument();
    expect(screen.getByText(/1 of 11 records/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Event Type"), {
      target: { value: "Workshop" },
    });
    expect(screen.getByText("Zypher Board Review")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Program"), {
      target: { value: "Finance" },
    });
    expect(screen.getByText("Zypher Board Review")).toBeInTheDocument();
    expect(screen.getByText(/1 of 11 records/)).toBeInTheDocument();
  });

  it("shows an attendance empty state when there are no completed-event records", () => {
    render(
      <AttendanceAnalyticsSection
        analytics={{
          summary: counts({ registered: 0, attended: 0 }),
          byPerson: [],
          byProgram: [],
          byEvent: [],
        }}
      />
    );

    expect(
      screen.getByText("No completed-event attendance records are available yet.")
    ).toBeInTheDocument();
  });
});

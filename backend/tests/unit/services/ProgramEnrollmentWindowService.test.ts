import { describe, expect, it } from "vitest";
import { getProgramEnrollmentWindow } from "../../../src/services/ProgramEnrollmentWindowService";

describe("ProgramEnrollmentWindowService", () => {
  it("keeps enrollment open through the last day of the program end month", () => {
    const window = getProgramEnrollmentWindow(
      {
        period: {
          startYear: "2025",
          startMonth: "01",
          endYear: "2025",
          endMonth: "01",
        },
      },
      new Date(2025, 0, 31, 12, 0, 0, 0)
    );

    expect(window.hasStartDate).toBe(true);
    expect(window.hasEndDate).toBe(true);
    expect(window.isEnrollmentClosed).toBe(false);
  });

  it("closes enrollment after the program end month", () => {
    const window = getProgramEnrollmentWindow(
      {
        period: {
          startYear: "2025",
          startMonth: "Jan",
          endYear: "2025",
          endMonth: "Jan",
        },
      },
      new Date(2025, 1, 1, 0, 0, 0, 0)
    );

    expect(window.hasStartDate).toBe(true);
    expect(window.hasEndDate).toBe(true);
    expect(window.isEnrollmentClosed).toBe(true);
    expect(window.endDate).toBeInstanceOf(Date);
    expect(window.enrollmentClosesAt).toBeInstanceOf(Date);
  });

  it("keeps enrollment open when the program end month or year is missing", () => {
    const window = getProgramEnrollmentWindow(
      { period: { startYear: "2025", startMonth: "01" } },
      new Date(2025, 1, 1, 0, 0, 0, 0)
    );

    expect(window.hasStartDate).toBe(true);
    expect(window.hasEndDate).toBe(false);
    expect(window.isEnrollmentClosed).toBe(false);
  });
});

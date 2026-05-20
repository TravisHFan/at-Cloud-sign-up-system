import { describe, expect, it } from "vitest";
import { getProgramEnrollmentWindow } from "../../utils/programEnrollmentWindow";

describe("programEnrollmentWindow", () => {
  it("keeps enrollment open through the last day of the program end month", () => {
    const result = getProgramEnrollmentWindow(
      {
        startYear: "2026",
        startMonth: "01",
        endYear: "2026",
        endMonth: "03",
      },
      new Date(2026, 2, 31, 23, 59, 59, 999),
    );

    expect(result.hasStartDate).toBe(true);
    expect(result.hasEndDate).toBe(true);
    expect(result.isEnrollmentClosed).toBe(false);
  });

  it("closes enrollment after the program end month has finished", () => {
    const result = getProgramEnrollmentWindow(
      {
        startYear: "2026",
        startMonth: "Jan",
        endYear: "2026",
        endMonth: "Mar",
      },
      new Date(2026, 3, 1, 0, 0, 0, 0),
    );

    expect(result.isEnrollmentClosed).toBe(true);
    expect(result.enrollmentClosesAt).toEqual(
      new Date(2026, 2, 31, 23, 59, 59, 999),
    );
  });

  it("stays open when the program end month is unavailable", () => {
    const result = getProgramEnrollmentWindow(
      {
        startYear: "2026",
        startMonth: "01",
      },
      new Date(2027, 0, 1, 0, 0, 0, 0),
    );

    expect(result.hasStartDate).toBe(true);
    expect(result.hasEndDate).toBe(false);
    expect(result.isEnrollmentClosed).toBe(false);
  });
});

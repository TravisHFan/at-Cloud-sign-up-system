import { describe, expect, it } from "vitest";
import { getProgramEnrollmentWindow } from "../../../src/services/ProgramEnrollmentWindowService";

describe("ProgramEnrollmentWindowService", () => {
  it("keeps enrollment open through the 45-day window after program start", () => {
    const window = getProgramEnrollmentWindow(
      { period: { startYear: "2025", startMonth: "01" } },
      new Date("2025-02-15T12:00:00.000Z")
    );

    expect(window.hasStartDate).toBe(true);
    expect(window.isEnrollmentClosed).toBe(false);
  });

  it("closes enrollment after the 45-day window", () => {
    const window = getProgramEnrollmentWindow(
      { period: { startYear: "2025", startMonth: "Jan" } },
      new Date("2025-02-16T12:00:00.000Z")
    );

    expect(window.hasStartDate).toBe(true);
    expect(window.isEnrollmentClosed).toBe(true);
    expect(window.enrollmentClosesAt).toBeInstanceOf(Date);
  });

  it("keeps enrollment open when the program start month or year is missing", () => {
    const window = getProgramEnrollmentWindow(
      { period: { startYear: "2025" } },
      new Date("2025-02-16T12:00:00.000Z")
    );

    expect(window.hasStartDate).toBe(false);
    expect(window.isEnrollmentClosed).toBe(false);
  });
});

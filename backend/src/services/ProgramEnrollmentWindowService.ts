type ProgramPeriodLike = {
  startYear?: string | number | null;
  startMonth?: string | number | null;
  endYear?: string | number | null;
  endMonth?: string | number | null;
};

type ProgramLike = {
  period?: ProgramPeriodLike | null;
};

export type ProgramEnrollmentWindow = {
  isEnrollmentClosed: boolean;
  hasStartDate: boolean;
  hasEndDate: boolean;
  startDate?: Date;
  endDate?: Date;
  enrollmentClosesAt?: Date;
};

const MONTH_NAME_TO_INDEX = new Map(
  [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].flatMap((month, index) => [
    [month, index],
    [month.slice(0, 3), index],
  ])
);

const parseMonth = (
  value: ProgramPeriodLike["startMonth"] | ProgramPeriodLike["endMonth"]
) => {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) {
    return numeric - 1;
  }

  return MONTH_NAME_TO_INDEX.get(raw.toLowerCase()) ?? null;
};

const parseYear = (
  value: ProgramPeriodLike["startYear"] | ProgramPeriodLike["endYear"]
) => {
  if (value == null) return null;

  const year = Number(String(value).trim());
  if (!Number.isInteger(year) || year < 1900 || year > 3000) {
    return null;
  }

  return year;
};

export const getProgramEnrollmentWindow = (
  program: ProgramLike,
  now = new Date()
): ProgramEnrollmentWindow => {
  const startYear = parseYear(program.period?.startYear);
  const startMonthIndex = parseMonth(program.period?.startMonth);
  const endYear = parseYear(program.period?.endYear);
  const endMonthIndex = parseMonth(program.period?.endMonth);
  const hasStartDate = startYear != null && startMonthIndex != null;

  if (endYear == null || endMonthIndex == null) {
    return {
      hasStartDate,
      hasEndDate: false,
      isEnrollmentClosed: false,
    };
  }

  const startDate =
    startYear != null && startMonthIndex != null
      ? new Date(startYear, startMonthIndex, 1, 0, 0, 0, 0)
      : undefined;
  const endDate = new Date(endYear, endMonthIndex, 1, 0, 0, 0, 0);
  const enrollmentClosesAt = new Date(
    endYear,
    endMonthIndex + 1,
    0,
    23,
    59,
    59,
    999
  );

  return {
    hasStartDate,
    hasEndDate: true,
    startDate,
    endDate,
    enrollmentClosesAt,
    isEnrollmentClosed: now.getTime() > enrollmentClosesAt.getTime(),
  };
};

export const PROGRAM_ENROLLMENT_CLOSED_MESSAGE =
  "Enrollment is closed because this program has finished.";

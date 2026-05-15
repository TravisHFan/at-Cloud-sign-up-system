export const PROGRAM_ENROLLMENT_GRACE_DAYS = 45;

type ProgramPeriodLike = {
  startYear?: string | number | null;
  startMonth?: string | number | null;
};

type ProgramLike = {
  period?: ProgramPeriodLike | null;
};

export type ProgramEnrollmentWindow = {
  isEnrollmentClosed: boolean;
  hasStartDate: boolean;
  startDate?: Date;
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

const parseStartMonth = (value: ProgramPeriodLike["startMonth"]) => {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) {
    return numeric - 1;
  }

  return MONTH_NAME_TO_INDEX.get(raw.toLowerCase()) ?? null;
};

const parseStartYear = (value: ProgramPeriodLike["startYear"]) => {
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
  const year = parseStartYear(program.period?.startYear);
  const monthIndex = parseStartMonth(program.period?.startMonth);

  if (year == null || monthIndex == null) {
    return {
      hasStartDate: false,
      isEnrollmentClosed: false,
    };
  }

  const startDate = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const enrollmentClosesAt = new Date(startDate);
  enrollmentClosesAt.setDate(
    enrollmentClosesAt.getDate() + PROGRAM_ENROLLMENT_GRACE_DAYS
  );
  enrollmentClosesAt.setHours(23, 59, 59, 999);

  return {
    hasStartDate: true,
    startDate,
    enrollmentClosesAt,
    isEnrollmentClosed: now.getTime() > enrollmentClosesAt.getTime(),
  };
};

export const PROGRAM_ENROLLMENT_CLOSED_MESSAGE =
  "Enrollment is closed. Program enrollment is only available for 45 days after the program start date.";

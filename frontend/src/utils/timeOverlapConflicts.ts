export interface TimeOverlapConflictProgram {
  id: string;
  title: string;
}

export interface TimeOverlapConflict {
  id: string;
  title: string;
  date?: string;
  endDate?: string;
  time?: string;
  endTime?: string;
  timeZone?: string;
  programLabels?: string[];
  programs?: TimeOverlapConflictProgram[];
}

const getProgramLabel = (conflict: TimeOverlapConflict) => {
  if (conflict.programs?.length) {
    return conflict.programs
      .map((program) => program.title || "Untitled program")
      .join(", ");
  }

  if (conflict.programLabels?.length) {
    return "Program information unavailable";
  }

  return "Independent event";
};

const getTimeLabel = (conflict: TimeOverlapConflict) => {
  if (!conflict.date || !conflict.time) return "";

  const endDate = conflict.endDate || conflict.date;
  const endTime = conflict.endTime ? ` - ${endDate} ${conflict.endTime}` : "";
  const timeZone = conflict.timeZone ? ` (${conflict.timeZone})` : "";
  return `\n   Time: ${conflict.date} ${conflict.time}${endTime}${timeZone}`;
};

export const buildTimeOverlapConfirmationMessage = (
  conflicts: TimeOverlapConflict[],
) => {
  const count = conflicts.length;
  const noun = count === 1 ? "event" : "events";
  const rows = conflicts
    .map((conflict, index) => {
      const title = conflict.title || "Untitled event";
      return `${index + 1}. ${title}\n   Program: ${getProgramLabel(
        conflict,
      )}${getTimeLabel(conflict)}`;
    })
    .join("\n\n");

  return `The time span you selected overlaps with ${count} existing ${noun}.\n\n${rows}\n\nDo you want to save this event anyway?`;
};

import {
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import type {
  AttendanceAnalytics,
  AttendanceCounts,
} from "../../services/api/analytics.api";

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "green" | "red" | "amber";
  icon: typeof ClipboardDocumentCheckIcon;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className={`${tones[tone]} rounded-lg p-5 flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}

function CountCells({ row }: { row: AttendanceCounts }) {
  return (
    <>
      <td className="px-3 py-2 text-right">{row.registered}</td>
      <td className="px-3 py-2 text-right text-green-700">{row.attended}</td>
      <td className="px-3 py-2 text-right text-red-700">{row.absent}</td>
      <td className="px-3 py-2 text-right text-amber-700">
        {row.unrecorded}
      </td>
      <td className="px-3 py-2 text-right font-medium">
        {formatPercent(row.attendanceRate)}
      </td>
    </>
  );
}

export function AttendanceAnalyticsSection({
  analytics,
}: {
  analytics: AttendanceAnalytics;
}) {
  const hasData = analytics.summary.registered > 0;

  if (!hasData) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Attendance Analytics
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          No completed-event attendance records are available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Registered"
          value={analytics.summary.registered}
          tone="blue"
          icon={ClipboardDocumentCheckIcon}
        />
        <SummaryCard
          label="Attended"
          value={analytics.summary.attended}
          tone="green"
          icon={CheckCircleIcon}
        />
        <SummaryCard
          label="Absent"
          value={analytics.summary.absent}
          tone="red"
          icon={XCircleIcon}
        />
        <SummaryCard
          label="Unrecorded"
          value={analytics.summary.unrecorded}
          tone="amber"
          icon={ClockIcon}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500">Recorded Attendance Rate</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatPercent(analytics.summary.attendanceRate)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500">Attendance Completion</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatPercent(analytics.summary.completionRate)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500">No-show Rate</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatPercent(analytics.summary.noShowRate)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Attendance By Person
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Programs</th>
                <th className="px-3 py-2 font-medium text-right">
                  Registered
                </th>
                <th className="px-3 py-2 font-medium text-right">Attended</th>
                <th className="px-3 py-2 font-medium text-right">Absent</th>
                <th className="px-3 py-2 font-medium text-right">
                  Unrecorded
                </th>
                <th className="px-3 py-2 font-medium text-right">Rate</th>
                <th className="px-3 py-2 font-medium">Last Attended</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.byPerson.map((person) => (
                <tr key={person.userId}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-900">
                      {person.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {person.roleInAtCloud ||
                        person.systemAuthorizationLevel}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {person.programs.slice(0, 2).join(", ")}
                    {person.programs.length > 2
                      ? ` +${person.programs.length - 2}`
                      : ""}
                  </td>
                  <CountCells row={person} />
                  <td className="px-3 py-3 text-gray-600">
                    <div>{formatDate(person.lastAttendedAt)}</div>
                    <div className="max-w-44 truncate text-xs">
                      {person.lastAttendedEvent}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Attendance By Program
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2 font-medium">Program</th>
                <th className="px-3 py-2 font-medium text-right">Events</th>
                <th className="px-3 py-2 font-medium text-right">
                  Registered
                </th>
                <th className="px-3 py-2 font-medium text-right">Attended</th>
                <th className="px-3 py-2 font-medium text-right">Absent</th>
                <th className="px-3 py-2 font-medium text-right">
                  Unrecorded
                </th>
                <th className="px-3 py-2 font-medium text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.byProgram.map((program) => (
                <tr key={program.programId}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-900">
                      {program.programTitle}
                    </div>
                    <div className="text-xs text-gray-500">
                      {program.programType}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {program.completedEvents}
                  </td>
                  <CountCells row={program} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Attendance By Event
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Programs</th>
                <th className="px-3 py-2 font-medium text-right">
                  Registered
                </th>
                <th className="px-3 py-2 font-medium text-right">Attended</th>
                <th className="px-3 py-2 font-medium text-right">Absent</th>
                <th className="px-3 py-2 font-medium text-right">
                  Unrecorded
                </th>
                <th className="px-3 py-2 font-medium text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.byEvent.map((event) => (
                <tr key={event.eventId}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-900">
                      {event.eventTitle}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(event.eventDate)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {event.programs.map((program) => program.title).join(", ")}
                  </td>
                  <CountCells row={event} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import {
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FireIcon,
  SparklesIcon,
  UserGroupIcon,
  UserPlusIcon,
} from "@heroicons/react/24/solid";
import type { AnalyticsOverview } from "../../services/api/analytics.api";

export interface AnalyticsOverviewCardsProps {
  analytics: AnalyticsOverview;
}

type Tone = "blue" | "green" | "purple" | "amber" | "rose" | "slate";

const toneClasses: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  purple: "bg-purple-50 text-purple-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-50 text-slate-700",
};

const valueToneClasses: Record<Tone, string> = {
  blue: "text-blue-900",
  green: "text-green-900",
  purple: "text-purple-900",
  amber: "text-amber-900",
  rose: "text-rose-900",
  slate: "text-slate-900",
};

function formatPercent(value: number | undefined) {
  return `${(value ?? 0).toFixed(1)}%`;
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

function MetricCard({
  label,
  value,
  detail,
  tone,
  icon: Icon,
  testId,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone: Tone;
  icon: typeof ChartBarIcon;
  testId: string;
}) {
  return (
    <div
      className={`${toneClasses[tone]} rounded-lg p-5 flex flex-col gap-2`}
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5" aria-hidden="true" />
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p
        className={`text-2xl font-semibold ${valueToneClasses[tone]}`}
        aria-label={`${testId}-value`}
      >
        {value}
      </p>
      {detail && <p className="text-xs opacity-80">{detail}</p>}
    </div>
  );
}

function SectionPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-gray-500">{message}</p>;
}

export function AnalyticsOverviewCards({
  analytics,
}: AnalyticsOverviewCardsProps) {
  const { overview, growth } = analytics;
  const last30Days = analytics.last30Days ?? {
    newUsers: 0,
    newEvents: 0,
    registrations: 0,
    attendanceCompletionRate: 0,
    attendanceRate: 0,
  };
  const needsAttention = analytics.needsAttention ?? {
    lowSignupUpcomingEvents: 0,
    completedEventsMissingAttendance: 0,
    unrecordedAttendance: 0,
    waitlistedRegistrations: 0,
  };
  const topEvents = analytics.topEvents ?? [];
  const topPrograms = analytics.topPrograms ?? [];
  const recentActivity = analytics.recentActivity ?? [];

  const attentionItems = [
    {
      label: "Upcoming events below 50% signup",
      value: needsAttention.lowSignupUpcomingEvents,
    },
    {
      label: "Completed events missing attendance",
      value: needsAttention.completedEventsMissingAttendance,
    },
    {
      label: "Unrecorded attendance entries",
      value: needsAttention.unrecordedAttendance,
    },
    {
      label: "Waitlisted registrations",
      value: needsAttention.waitlistedRegistrations,
    },
  ];

  return (
    <div className="space-y-6" data-testid="analytics-overview-cards">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Total Events"
          value={overview.totalEvents}
          detail={`${overview.upcomingEvents} upcoming`}
          tone="blue"
          icon={CalendarDaysIcon}
          testId="analytics-card-total-events"
        />
        <MetricCard
          label="Total Users"
          value={overview.totalUsers}
          detail={`${overview.activeUsers} active in 30 days`}
          tone="green"
          icon={UserPlusIcon}
          testId="analytics-card-total-users"
        />
        <MetricCard
          label="Active Participants"
          value={overview.activeParticipants}
          detail={`${overview.totalRegistrations} total registrations`}
          tone="purple"
          icon={UserGroupIcon}
          testId="analytics-card-active-participants"
        />
        <MetricCard
          label="Avg. Signup Rate"
          value={formatPercent(overview.averageSignupRate)}
          detail={`${overview.recentRegistrations} registrations this week`}
          tone="amber"
          icon={ChartBarIcon}
          testId="analytics-card-avg-signup-rate"
        />
        <MetricCard
          label="Completed Events"
          value={overview.completedEvents}
          detail="Ready for attendance review"
          tone="slate"
          icon={ClipboardDocumentCheckIcon}
          testId="analytics-card-completed-events"
        />
        <MetricCard
          label="30-Day Registrations"
          value={last30Days.registrations}
          detail={`${formatPercent(growth.registrationGrowthRate)} month growth`}
          tone="blue"
          icon={FireIcon}
          testId="analytics-card-30-day-registrations"
        />
        <MetricCard
          label="30-Day New Users"
          value={last30Days.newUsers}
          detail={`${formatPercent(growth.userGrowthRate)} month growth`}
          tone="green"
          icon={SparklesIcon}
          testId="analytics-card-30-day-users"
        />
        <MetricCard
          label="Attendance Completion"
          value={formatPercent(last30Days.attendanceCompletionRate)}
          detail={`${formatPercent(last30Days.attendanceRate)} attendance rate`}
          tone="rose"
          icon={ClockIcon}
          testId="analytics-card-attendance-completion"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SectionPanel title="Needs Attention">
          <div className="space-y-3">
            {attentionItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon
                    className={`h-5 w-5 ${
                      item.value > 0 ? "text-amber-500" : "text-gray-300"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </div>
                <span className="text-base font-semibold text-gray-900">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title="Recent Activity">
          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.person}
                  </p>
                  <p className="text-sm text-gray-600">
                    Registered for {activity.eventTitle}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(activity.createdAt)}
                    {activity.eventDate ? ` · Event ${formatDate(activity.eventDate)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No recent activity yet." />
          )}
        </SectionPanel>

        <SectionPanel title="30-Day Pulse">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                New Events
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {last30Days.newEvents}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Registrations
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {last30Days.registrations}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Attendance Done
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {formatPercent(last30Days.attendanceCompletionRate)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Attendance Rate
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {formatPercent(last30Days.attendanceRate)}
              </p>
            </div>
          </div>
        </SectionPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionPanel title="Top Events">
          {topEvents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                    <th className="py-2 pr-3 font-medium">Event</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Registered
                    </th>
                    <th className="px-3 py-2 font-medium text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-gray-900">
                          {event.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(event.date)} · {event.type || event.status}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-700">
                        {event.registrations}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">
                        {formatPercent(event.signupRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No event registration data yet." />
          )}
        </SectionPanel>

        <SectionPanel title="Top Programs">
          {topPrograms.length > 0 ? (
            <div className="space-y-3">
              {topPrograms.map((program) => (
                <div
                  key={program.id}
                  className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{program.title}</p>
                    <p className="text-xs text-gray-500">
                      {program.programType || "Program"} · {program.events} events
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      {program.registrations}
                    </p>
                    <p className="text-xs text-gray-500">registrations</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No labeled program activity yet." />
          )}
        </SectionPanel>
      </div>
    </div>
  );
}

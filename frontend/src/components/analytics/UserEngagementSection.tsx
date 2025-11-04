import { getEngagementBadgeClassNames } from "../../constants/ui";

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-600">{label}:</span>
      <span className={`font-medium ${accent || ""}`}>{value}</span>
    </div>
  );
}

export interface MostActiveUser {
  userId: string;
  name: string;
  roleInAtCloud: string;
  eventCount: number;
}

export interface UserEngagementSectionProps {
  mostActiveUsers: MostActiveUser[];
  uniqueParticipants: number;
  userSignups: number;
  guestSignups: number;
  uniqueGuests: number;
  totalEvents: number;
  avgRolesPerParticipant: number;
}

export function UserEngagementSection({
  mostActiveUsers,
  uniqueParticipants,
  userSignups,
  guestSignups,
  uniqueGuests,
  totalEvents,
  avgRolesPerParticipant,
}: UserEngagementSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Most Active Participants
        </h3>
        <div className="space-y-3">
          {mostActiveUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No data available.</p>
          ) : (
            mostActiveUsers.map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between"
              >
                <span className="text-sm text-gray-700 truncate">
                  {user.name}
                </span>
                <span
                  className={`${getEngagementBadgeClassNames(
                    user.eventCount
                  )} px-2 py-1 rounded-full text-xs font-medium`}
                >
                  {user.eventCount} {user.eventCount === 1 ? "event" : "events"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Engagement Summary
        </h3>
        <div className="space-y-3">
          <SummaryRow label="Unique Participants" value={uniqueParticipants} />
          <SummaryRow label="Total Role Signups" value={userSignups} />
          <SummaryRow label="Guest Signups" value={guestSignups} />
          <SummaryRow label="Unique Guests" value={uniqueGuests} />
          <SummaryRow label="Total Unique Events" value={totalEvents} />
          <SummaryRow
            label="Avg. Roles per Participant"
            value={avgRolesPerParticipant.toFixed(1)}
          />
        </div>
      </div>
    </div>
  );
}

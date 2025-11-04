import {
  ShieldCheckIcon,
  Cog8ToothIcon,
  UsersIcon,
  UserGroupIcon,
  AcademicCapIcon,
  CloudIcon,
} from "@heroicons/react/24/solid";
import { getRoleBadgeClassNames } from "../../constants/ui";

// Mapping plural display labels to canonical singular keys for color lookup
const ROLE_LABEL_NORMALIZATION: Record<string, string> = {
  Administrators: "Administrator",
  Leaders: "Leader",
  Participants: "Participant",
  "Guest Experts": "Guest Expert",
};

function roleIcon(label: string) {
  const normalized = ROLE_LABEL_NORMALIZATION[label] || label;
  switch (normalized) {
    case "Super Admin":
      return (
        <ShieldCheckIcon
          className="w-4 h-4 text-purple-500"
          aria-hidden="true"
        />
      );
    case "Administrator":
      return (
        <Cog8ToothIcon className="w-4 h-4 text-red-500" aria-hidden="true" />
      );
    case "Leader":
      return (
        <UserGroupIcon className="w-4 h-4 text-yellow-500" aria-hidden="true" />
      );
    case "Guest Expert":
      return (
        <AcademicCapIcon className="w-4 h-4 text-cyan-500" aria-hidden="true" />
      );
    case "Participant":
      return (
        <UsersIcon className="w-4 h-4 text-green-500" aria-hidden="true" />
      );
    case "@Cloud Co-workers":
      return (
        <CloudIcon className="w-4 h-4 text-orange-500" aria-hidden="true" />
      );
    default:
      return <UsersIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />;
  }
}

function DistributionRow({ label, value }: { label: string; value?: number }) {
  const normalized = ROLE_LABEL_NORMALIZATION[label] || label;
  // Build a stable slug for data-testid attributes (remove leading/trailing hyphens)
  const slug = normalized
    .replace(/[^a-z0-9]+/gi, "-") // replace non-alphanumerics with hyphen
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, "") // trim leading/trailing hyphens
    .toLowerCase();
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600 flex items-center gap-2">
        {roleIcon(label)} <span>{label}:</span>
      </span>
      <span
        className={`${getRoleBadgeClassNames(
          normalized
        )} px-2 py-1 rounded-full text-xs font-medium`}
        data-testid={`role-dist-${slug}`}
      >
        {value ?? 0}
      </span>
    </div>
  );
}

export interface RoleStats {
  superAdmin: number;
  administrators: number;
  leaders: number;
  guestExperts: number;
  participants: number;
  atCloudLeaders: number;
}

export interface RoleFormatDistributionProps {
  roleStats: RoleStats;
  formatStats: Record<string, number>;
}

export function RoleFormatDistribution({
  roleStats,
  formatStats,
}: RoleFormatDistributionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          System Authorization Level Distribution
        </h3>
        <div className="space-y-3">
          <DistributionRow label="Super Admin" value={roleStats.superAdmin} />
          <DistributionRow
            label="Administrators"
            value={roleStats.administrators}
          />
          <DistributionRow label="Leaders" value={roleStats.leaders} />
          <DistributionRow
            label="Guest Experts"
            value={roleStats.guestExperts}
          />
          <DistributionRow
            label="Participants"
            value={roleStats.participants}
          />
          <DistributionRow
            label="@Cloud Co-workers"
            value={roleStats.atCloudLeaders}
          />
        </div>
      </div>
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Event Format Distribution
        </h3>
        <div className="space-y-3">
          {Object.entries(formatStats).map(([format, count]) => (
            <div key={format} className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{format}:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

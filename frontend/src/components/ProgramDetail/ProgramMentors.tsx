import { Link } from "react-router-dom";
import { getAvatarAlt } from "../../utils/avatarUtils";

interface Mentor {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: "male" | "female";
  avatar?: string;
  roleInAtCloud?: string;
}

interface ProgramMentorsProps {
  mentors: Mentor[];
  currentUserId: string | null;
  currentUserRole: string | null;
  accessReason:
    | "admin"
    | "mentor"
    | "creator"
    | "free"
    | "purchased"
    | "not_purchased"
    | null;
}

/**
 * ProgramMentors Component
 *
 * Displays program mentors with avatars, names, roles, and contact information.
 *
 * Features:
 * - Grid layout (1 col mobile, 2 cols tablet, 3 cols desktop)
 * - Avatar display with gender-based default fallback
 * - Profile navigation for admins/leaders
 * - Contact information (conditional on access: admins or enrolled users)
 * - Role in @Cloud display
 * - Hover effects for clickable profiles
 */
export default function ProgramMentors({
  mentors,
  currentUserId,
  currentUserRole,
  accessReason,
}: ProgramMentorsProps) {
  if (!mentors || mentors.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Mentors</h2>
      <p className="text-gray-600 text-sm mb-4 italic">
        — Spiritual Guides and Leadership Coaches
        <br />
        Mentors are seasoned ministry & business leaders who model
        Christ-centered leadership and guide others in faith, personal growth,
        and practical skills.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mentors.map((m) => {
          // Use avatar URL directly from database (backend updates it atomically)
          let avatarUrl = m.avatar;

          if (!avatarUrl || avatarUrl.includes("default-avatar")) {
            // Use default avatar based on gender
            const gender =
              (m.gender as "male" | "female" | undefined) || "male";
            avatarUrl =
              gender === "male"
                ? "/default-avatar-male.jpg"
                : "/default-avatar-female.jpg";
          }

          // Check if current user can see mentor contact info
          // Visible to: Admins, Mentees, and Class Reps
          const isAdmin =
            currentUserRole === "Super Admin" ||
            currentUserRole === "Administrator";
          const isEnrolled =
            accessReason === "purchased" || accessReason === "free";
          const canViewContact = isAdmin || isEnrolled;

          const isOwnCard = currentUserId === m.userId;
          const profileLink = isOwnCard
            ? "/dashboard/profile"
            : `/dashboard/profile/${m.userId}`;

          // Check if user has permission to view other profiles
          const canViewProfiles =
            currentUserRole === "Super Admin" ||
            currentUserRole === "Administrator" ||
            currentUserRole === "Leader";

          const mentorInfoContent = (
            <div className="flex items-start space-x-3 mb-3">
              <img
                src={avatarUrl}
                alt={getAvatarAlt(
                  m.firstName || "",
                  m.lastName || "",
                  !!m.avatar,
                )}
                className="h-12 w-12 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1">
                <div
                  className={`font-medium text-gray-900 ${
                    canViewProfiles
                      ? "hover:text-blue-600 transition-colors"
                      : ""
                  }`}
                >
                  {[m.firstName, m.lastName].filter(Boolean).join(" ") ||
                    "Mentor"}
                </div>
                {m.roleInAtCloud && (
                  <div className="text-sm text-gray-600">{m.roleInAtCloud}</div>
                )}
              </div>
            </div>
          );

          return (
            <div
              key={m.userId}
              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
            >
              {canViewProfiles ? (
                <Link to={profileLink} className="block">
                  {mentorInfoContent}
                </Link>
              ) : (
                mentorInfoContent
              )}
              {canViewContact && m.email && (
                <div className="space-y-1">
                  <div className="flex items-center text-sm text-gray-600">
                    <img
                      src="/mail.svg"
                      alt="Mail icon"
                      className="w-3.5 h-3.5 mr-3"
                    />
                    <a
                      href={`mailto:${m.email}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {m.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

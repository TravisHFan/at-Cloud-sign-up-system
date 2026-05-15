import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  programService,
  apiClient,
  type ProgramParticipant,
  type ProgramUnenrollPreview,
} from "../../services/api";
import { formatCurrency } from "../../utils/currency";
import { getAvatarAlt } from "../../utils/avatarUtils";
import { useAvatarUpdates } from "../../hooks/useAvatarUpdates";
import { useAuth } from "../../contexts/AuthContext";
import { useToastReplacement } from "../../contexts/NotificationModalContext";

// Helper function to get user ID (handles both _id and id)
function getUserId(user: ProgramParticipant["user"] | undefined): string {
  if (!user) return "";
  return String(user.id || user._id || "");
}

interface AdminEnrollmentPromptProps {
  onEnroll: (enrollAs: "mentee" | "classRep") => void;
  isLoading: boolean;
}

function AdminEnrollmentPrompt({
  onEnroll,
  isLoading,
}: AdminEnrollmentPromptProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <p className="text-sm text-blue-800 mb-3 font-medium">
        As an administrator, you can enroll in this program for free:
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => onEnroll("mentee")}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
        >
          {isLoading ? "Enrolling..." : "Enroll as Mentee"}
        </button>
        <button
          onClick={() => onEnroll("classRep")}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-purple-400"
        >
          {isLoading ? "Enrolling..." : "Enroll as Class Rep"}
        </button>
      </div>
    </div>
  );
}

interface UserCardProps {
  participant: ProgramParticipant;
  showContact: boolean;
  onUnenroll?: () => void;
  isUnenrolling?: boolean;
  canUnenroll?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
}

function UserCard({
  participant,
  showContact,
  onUnenroll,
  isUnenrolling,
  canUnenroll,
  currentUserId,
  currentUserRole,
}: UserCardProps) {
  const { user, isPaid } = participant;

  // Use avatar URL directly from database
  let avatarUrl = user.avatar;

  if (!avatarUrl || avatarUrl.includes("default-avatar")) {
    // Use default avatar based on gender
    const gender = (user.gender as "male" | "female" | undefined) || "male";
    avatarUrl =
      gender === "male"
        ? "/default-avatar-male.jpg"
        : "/default-avatar-female.jpg";
  }

  const userId = getUserId({ ...user });
  const isOwnCard = currentUserId && userId === currentUserId;
  const profileLink = isOwnCard
    ? "/dashboard/profile"
    : `/dashboard/profile/${userId}`;

  // Check if user has permission to view other profiles
  const canViewProfiles =
    currentUserRole === "Super Admin" ||
    currentUserRole === "Administrator" ||
    currentUserRole === "Leader";

  const userInfoContent = (
    <div className="flex items-start space-x-3 mb-3">
      <img
        src={avatarUrl}
        alt={getAvatarAlt(user.firstName, user.lastName, !!user.avatar)}
        className="h-12 w-12 rounded-full object-cover flex-shrink-0"
      />
      <div className="flex-1">
        <div
          className={`font-medium text-gray-900 mb-1 ${
            canViewProfiles ? "hover:text-blue-600 transition-colors" : ""
          }`}
        >
          {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
            "Participant"}
          {!isPaid && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              Admin
            </span>
          )}
        </div>
        {user.roleInAtCloud && (
          <div className="text-sm text-gray-600">{user.roleInAtCloud}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      {canViewProfiles ? (
        <Link to={profileLink} className="block">
          {userInfoContent}
        </Link>
      ) : (
        userInfoContent
      )}
      {showContact && (
        <div className="space-y-1">
          <div className="flex items-center text-sm text-gray-600">
            <img src="/mail.svg" alt="Mail icon" className="w-3.5 h-3.5 mr-3" />
            <a
              href={`mailto:${user.email}`}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {user.email}
            </a>
          </div>
          {user.phone && (
            <div className="flex items-center text-sm text-gray-600">
              <img
                src="/phone.svg"
                alt="Phone icon"
                className="w-3.5 h-3.5 mr-3"
              />
              <span>{user.phone}</span>
            </div>
          )}
        </div>
      )}
      {canUnenroll && onUnenroll && (
        <button
          onClick={onUnenroll}
          disabled={isUnenrolling}
          className="mt-3 w-full px-3 py-1.5 text-sm bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {isUnenrolling ? "Unenrolling..." : "Unenroll"}
        </button>
      )}
    </div>
  );
}

interface ParticipantsSectionProps {
  programId: string;
  program: {
    id: string;
    mentors?: Array<{ userId: string }>;
  };
  onEnrollmentChanged?: () => void;
}

export function ProgramParticipants({
  programId,
  program,
  onEnrollmentChanged,
}: ParticipantsSectionProps) {
  const { currentUser } = useAuth();
  const notification = useToastReplacement();
  const avatarUpdateCounter = useAvatarUpdates();

  const [mentees, setMentees] = useState<ProgramParticipant[]>([]);
  const [classReps, setClassReps] = useState<ProgramParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [loadingUnenrollPreview, setLoadingUnenrollPreview] = useState(false);
  const [selfUnenrollConfirm, setSelfUnenrollConfirm] =
    useState<ProgramUnenrollPreview | null>(null);

  const user = currentUser;

  // Check if current user is admin
  const isAdmin =
    user?.role === "Super Admin" || user?.role === "Administrator";

  // Check if current user is enrolled
  const currentUserMentee = mentees.find(
    (m) => getUserId(m.user) === String(user?.id)
  );
  const currentUserClassRep = classReps.find(
    (c) => getUserId(c.user) === String(user?.id)
  );
  const isEnrolled = !!(currentUserMentee || currentUserClassRep);
  const isMentor = program.mentors?.some((m) => m.userId === user?.id);
  const canViewContact = !!(isAdmin || isMentor || currentUserClassRep);
  const canSelfUnenroll = !!user && !isAdmin;

  // Fetch participants
  const fetchParticipants = async () => {
    try {
      setLoading(true);
      const data = await programService.getParticipants(programId);
      setMentees(data.mentees);
      setClassReps(data.classReps);
    } catch (error) {
      console.error("Error fetching participants:", error);
      notification.error("Failed to load participants. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, avatarUpdateCounter]);

  const handleEnroll = async (enrollAs: "mentee" | "classRep") => {
    try {
      setEnrolling(true);
      await apiClient.adminEnroll(programId, enrollAs);
      notification.success(
        `Successfully enrolled as ${
          enrollAs === "mentee" ? "mentee" : "class representative"
        }!`
      );
      await fetchParticipants();
    } catch (error) {
      console.error("Error enrolling:", error);
      notification.error("Failed to enroll. Please try again.");
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async () => {
    try {
      setUnenrolling(true);
      await apiClient.adminUnenroll(programId);
      notification.success("Successfully unenrolled from program.");
      await fetchParticipants();
      onEnrollmentChanged?.();
    } catch (error) {
      console.error("Error unenrolling:", error);
      notification.error("Failed to unenroll. Please try again.");
    } finally {
      setUnenrolling(false);
    }
  };

  const getEnrollmentLabel = (type: "mentee" | "classRep") =>
    type === "classRep" ? "class representative" : "mentee";

  const handleSelfUnenrollClick = async () => {
    try {
      setLoadingUnenrollPreview(true);
      const preview = await programService.getUnenrollPreview(programId);
      setSelfUnenrollConfirm(preview);
    } catch (error) {
      console.error("Error loading unenroll preview:", error);
      notification.error(
        "Failed to load unenrollment details. Please try again.",
      );
    } finally {
      setLoadingUnenrollPreview(false);
    }
  };

  const handleConfirmSelfUnenroll = async () => {
    if (!selfUnenrollConfirm) return;

    try {
      setUnenrolling(true);
      const result = await programService.selfUnenrollProgram(programId);
      await fetchParticipants();
      if (result.refundStatus !== "pending_approval") {
        onEnrollmentChanged?.();
      }
      setSelfUnenrollConfirm(null);

      if (result.refundStatus === "processing") {
        notification.success(
          "You have been unenrolled. Your refund request has been submitted.",
        );
      } else if (result.refundStatus === "pending_approval") {
        notification.success(
          result.existingRequest
            ? "Your earlier request is still waiting for administrator review."
            : "Your request has been sent to administrators for review. You will remain enrolled until a decision is made.",
        );
      } else if (result.refundStatus === "failed") {
        notification.error(
          "You have been unenrolled, but the automatic refund request failed. Please contact support.",
        );
      } else {
        notification.success("You have been unenrolled from this program.");
      }
    } catch (error) {
      console.error("Error self-unenrolling:", error);
      notification.error("Failed to unenroll. Please try again.");
    } finally {
      setUnenrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Admin enrollment/unenrollment controls (shown at top) */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* Show enrollment prompt if not enrolled anywhere */}
          {!isEnrolled && (
            <AdminEnrollmentPrompt
              onEnroll={handleEnroll}
              isLoading={enrolling}
            />
          )}

          {/* Show unenroll button if enrolled (non-paid only) */}
          {isEnrolled && (
            <>
              {currentUserMentee && !currentUserMentee.isPaid && (
                <div className="mb-2">
                  <button
                    onClick={handleUnenroll}
                    disabled={unenrolling}
                    className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {unenrolling
                      ? "Unenrolling..."
                      : "Unenroll from Mentees"}
                  </button>
                </div>
              )}
              {currentUserClassRep && !currentUserClassRep.isPaid && (
                <div>
                  <button
                    onClick={handleUnenroll}
                    disabled={unenrolling}
                    className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {unenrolling
                      ? "Unenrolling..."
                      : "Unenroll from Class Representatives"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Class Representatives Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Class Representatives
        </h2>
        <p className="text-gray-600 text-sm mb-4 italic">
          Class representatives, are peer leaders chosen within each mentorship
          cohort to support coordination, communication, and community building.
        </p>

        {classReps.length === 0 ? (
          <p className="text-gray-600 text-center py-4">
            No class representatives enrolled yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classReps.map((classRep) => (
              <UserCard
                key={getUserId(classRep.user)}
                participant={classRep}
                showContact={canViewContact}
                currentUserId={user?.id}
                currentUserRole={user?.role}
                onUnenroll={
                  getUserId(classRep.user) === String(user?.id) &&
                  ((isAdmin && !classRep.isPaid) || canSelfUnenroll)
                    ? isAdmin
                      ? handleUnenroll
                      : handleSelfUnenrollClick
                    : undefined
                }
                isUnenrolling={unenrolling || loadingUnenrollPreview}
                canUnenroll={
                  getUserId(classRep.user) === String(user?.id) &&
                  ((isAdmin && !classRep.isPaid) || canSelfUnenroll)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Mentees Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Mentees</h2>
        <p className="text-gray-600 text-sm mb-4 italic">
          — Emerging Leaders in Growth and Service
          <br />
          Mentees are participants who commit to a season of intentional
          learning, reflection, and transformation under the guidance of
          mentors.
        </p>

        {mentees.length === 0 ? (
          <p className="text-gray-600 text-center py-4">
            No mentees enrolled yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mentees.map((mentee) => (
              <UserCard
                key={getUserId(mentee.user)}
                participant={mentee}
                showContact={canViewContact}
                currentUserId={user?.id}
                currentUserRole={user?.role}
                onUnenroll={
                  getUserId(mentee.user) === String(user?.id) &&
                  ((isAdmin && !mentee.isPaid) || canSelfUnenroll)
                    ? isAdmin
                      ? handleUnenroll
                      : handleSelfUnenrollClick
                    : undefined
                }
                isUnenrolling={unenrolling || loadingUnenrollPreview}
                canUnenroll={
                  getUserId(mentee.user) === String(user?.id) &&
                  ((isAdmin && !mentee.isPaid) || canSelfUnenroll)
                }
              />
            ))}
          </div>
        )}
      </div>

      {selfUnenrollConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selfUnenrollConfirm.refundEligible
                ? "Leave Program and Request Refund"
                : selfUnenrollConfirm.requiresApproval
                  ? "Request Admin Approval"
                : "Unenroll Without Refund"}
            </h3>

            <p className="text-gray-700 mb-4">
              You are currently enrolled as a{" "}
              <strong>
                {getEnrollmentLabel(selfUnenrollConfirm.enrollmentType)}
              </strong>
              {". "}
              {selfUnenrollConfirm.requiresApproval
                ? "If you continue, your request will be sent to administrators."
                : "If you continue, you will be removed from this program immediately."}
            </p>

            {selfUnenrollConfirm.refundEligible ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  Your payment is within the 30-day refund window. A full refund
                  of{" "}
                  <strong>
                    {formatCurrency(selfUnenrollConfirm.refundAmount)}
                  </strong>{" "}
                  will be requested and returned to your original payment
                  method.
                </p>
              </div>
            ) : selfUnenrollConfirm.requiresApproval ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-900">
                  This payment is outside the 30-day refund window, so an
                  administrator must review the request. If approved, you will
                  be unenrolled and the refund will be submitted. Until an admin
                  responds, you will remain enrolled.
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700">
                  A refund is not available for this enrollment. Are you sure you
                  want to unenroll?
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelfUnenrollConfirm(null)}
                disabled={unenrolling}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSelfUnenroll}
                disabled={unenrolling}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {unenrolling
                  ? selfUnenrollConfirm.requiresApproval
                    ? "Sending..."
                    : "Unenrolling..."
                  : selfUnenrollConfirm.refundEligible
                    ? "Yes, Unenroll and Refund"
                    : selfUnenrollConfirm.requiresApproval
                      ? "Send Request"
                    : "Yes, Unenroll"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

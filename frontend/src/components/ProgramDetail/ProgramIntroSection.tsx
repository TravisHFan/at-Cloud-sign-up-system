import { useNavigate } from "react-router-dom";

interface ProgramIntroSectionProps {
  programId: string;
  introduction?: string;
  flyerUrl?: string;
  isFree?: boolean;
  hasAccess: boolean | null;
  accessReason:
    | "admin"
    | "mentor"
    | "free"
    | "purchased"
    | "not_purchased"
    | null;
}

/**
 * ProgramIntroSection Component
 *
 * Displays program introduction text and enrollment status:
 * - Introduction text with proper whitespace handling
 * - Enrollment CTA for non-enrolled users (paid programs only)
 * - Success message for enrolled users with role-specific messaging
 * - Optional program flyer image display
 *
 * Features:
 * - Conditional enrollment messaging based on access reason (admin/mentor/purchased)
 * - "Enroll Now" button with navigation to enrollment page
 * - Responsive flyer image display with proper sizing
 * - Free program awareness (no enrollment UI for free programs)
 *
 * Extracted from ProgramDetail.tsx (Phase 6.5.3)
 */
export default function ProgramIntroSection({
  programId,
  introduction,
  flyerUrl,
  isFree,
  hasAccess,
  accessReason,
}: ProgramIntroSectionProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* Introduction Section */}
      {introduction && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Introduction
              </h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {introduction}
              </p>

              {/* Enrollment CTA or Thank You Message */}
              {!isFree &&
                hasAccess !== null &&
                (hasAccess ? (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <img
                        src="/check.svg"
                        alt="Enrolled"
                        className="w-6 h-6 mr-3"
                      />
                      <div>
                        <p className="font-semibold text-green-900">
                          {accessReason === "admin" || accessReason === "mentor"
                            ? "Congratulations!"
                            : "You're enrolled!"}
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          {accessReason === "admin"
                            ? "As an administrator, you have full access to all programs."
                            : accessReason === "mentor"
                            ? "As a mentor of this program, you have full access."
                            : "Thank you for enrolling. You now have access to all events in this program."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6">
                    <button
                      onClick={() =>
                        navigate(`/dashboard/programs/${programId}/enroll`)
                      }
                      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <span>Enroll Now</span>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Program Flyer (optional) */}
      {flyerUrl && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Program Flyer
          </h2>
          <div className="flex">
            <img
              src={flyerUrl}
              alt="Program flyer"
              className="w-full max-w-2xl h-auto rounded border border-gray-200 object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

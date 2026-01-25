import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { programService } from "../services/api";
import { Icon } from "../components/common";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Multiline from "../components/common/Multiline";
import { formatCurrency } from "../utils/currency";
import { getAvatarAlt } from "../utils/avatarUtils";
import type { ProgramType } from "../constants/programTypes";

interface Mentor {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: "male" | "female";
  avatar?: string;
  roleInAtCloud?: string;
}

interface Program {
  id: string;
  title: string;
  programType: ProgramType;
  hostedBy?: string;
  period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  introduction?: string;
  flyerUrl?: string;
  earlyBirdDeadline?: string;
  mentors?: Mentor[];
  isFree?: boolean;
  fullPriceTicket?: number;
  classRepDiscount?: number;
  earlyBirdDiscount?: number;
  classRepLimit?: number;
  classRepCount?: number;
}

/**
 * Check if the program has ended based on its end month/year
 * A program is considered finished if the end month/year is before the current month/year
 */
function isProgramFinished(period?: Program["period"]): boolean {
  if (!period?.endYear || !period?.endMonth) {
    return false; // No end date means not finished
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const endYear = parseInt(period.endYear, 10);
  const endMonth = parseInt(period.endMonth, 10);

  if (isNaN(endYear) || isNaN(endMonth)) {
    return false;
  }

  // Program is finished if end date is strictly before current month
  if (endYear < currentYear) {
    return true;
  }
  if (endYear === currentYear && endMonth < currentMonth) {
    return true;
  }

  return false;
}

/**
 * Format period for display (e.g., "September 2026 – May 2027")
 */
function formatPeriod(period?: Program["period"]): string {
  if (!period) return "";

  const monthCodeToName: Record<string, string> = {
    "01": "January",
    "02": "February",
    "03": "March",
    "04": "April",
    "05": "May",
    "06": "June",
    "07": "July",
    "08": "August",
    "09": "September",
    "10": "October",
    "11": "November",
    "12": "December",
  };

  const normalize = (m?: string) =>
    m && monthCodeToName[m] ? monthCodeToName[m] : m;
  const s = [normalize(period.startMonth), period.startYear]
    .filter(Boolean)
    .join(" ");
  const e = [normalize(period.endMonth), period.endYear]
    .filter(Boolean)
    .join(" ");
  return [s, e].filter(Boolean).join(" – ");
}

/**
 * PublicProgram Page
 *
 * Public-facing program detail page that can be shared without login.
 * - Shows program info, mentors, pricing
 * - If program is finished (end month passed): shows completion message
 * - If program not found: shows 404
 * - "Enroll Now" redirects to login with return URL
 */
export default function PublicProgram() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function loadProgram() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await programService.getById(id);
        if (cancelled) return;
        setProgram(data as Program);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load program:", err);
        setError("Program not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProgram();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleEnrollClick = () => {
    // Redirect to login with return URL to enrollment page
    const returnUrl = `/dashboard/programs/${id}/enroll`;
    navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center px-4">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <Icon
              name="x-circle"
              className="w-16 h-16 text-red-400 mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Program Not Found
            </h1>
            <p className="text-gray-600 mb-6">
              This program may have been removed or the link is invalid.
            </p>
            <Link
              to="/events"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Browse Public Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isFinished = isProgramFinished(program.period);

  // Program Finished View
  if (isFinished) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            {/* Success/Completion Icon */}
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {program.title}
            </h1>

            <p className="text-lg text-gray-600 mb-2">
              {formatPeriod(program.period)}
            </p>

            <div className="my-8 py-6 border-t border-b border-gray-200">
              <p className="text-xl text-gray-700">
                This program has been completed.
              </p>
              <p className="text-gray-500 mt-2">
                Thank you to all participants and mentors for their dedication!
              </p>
            </div>

            <p className="text-gray-600 mb-6">
              Interested in joining a future program?
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Sign In to Explore Programs
              </Link>
              <Link
                to="/events"
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Browse Public Events
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Program View
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {program.title}
          </h1>

          {/* Program Type & Period */}
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            {program.programType && (
              <div className="flex items-center">
                <Icon name="document-text" className="w-5 h-5 mr-2" />
                <span>{program.programType}</span>
              </div>
            )}
            {program.period && (
              <div className="flex items-center">
                <Icon name="calendar" className="w-5 h-5 mr-2" />
                <span>{formatPeriod(program.period)}</span>
              </div>
            )}
            {program.hostedBy && (
              <div className="flex items-center">
                <Icon name="user" className="w-5 h-5 mr-2" />
                <span>{program.hostedBy}</span>
              </div>
            )}
          </div>
        </div>

        {/* Flyer Image */}
        {program.flyerUrl && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <img
              src={program.flyerUrl}
              alt={`${program.title} flyer`}
              className="w-full max-w-2xl mx-auto rounded-lg"
            />
          </div>
        )}

        {/* Introduction */}
        {program.introduction && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              About This Program
            </h2>
            <div className="text-gray-700 leading-relaxed">
              <Multiline text={program.introduction} />
            </div>
          </div>
        )}

        {/* Mentors */}
        {program.mentors && program.mentors.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Mentors
            </h2>
            <p className="text-gray-600 text-sm mb-4 italic">
              — Spiritual Guides and Leadership Coaches
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {program.mentors.map((mentor) => {
                let avatarUrl = mentor.avatar;
                if (!avatarUrl || avatarUrl.includes("default-avatar")) {
                  const gender = mentor.gender || "male";
                  avatarUrl =
                    gender === "male"
                      ? "/default-avatar-male.jpg"
                      : "/default-avatar-female.jpg";
                }

                return (
                  <div
                    key={mentor.userId}
                    className="bg-gray-50 rounded-lg p-4"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={avatarUrl}
                        alt={getAvatarAlt(
                          mentor.firstName || "",
                          mentor.lastName || "",
                          !!mentor.avatar,
                        )}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-medium text-gray-900">
                          {[mentor.firstName, mentor.lastName]
                            .filter(Boolean)
                            .join(" ") || "Mentor"}
                        </div>
                        {mentor.roleInAtCloud && (
                          <div className="text-sm text-gray-600">
                            {mentor.roleInAtCloud}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pricing */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Tuition</h2>
          {program.isFree ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                <svg
                  className="w-5 h-5 text-green-500 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-lg font-medium text-green-800">
                  This is a free program
                </span>
              </div>
            </div>
          ) : program.fullPriceTicket ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-600 mb-1">
                    Full Price Ticket
                  </div>
                  <div className="text-xl font-semibold text-gray-900">
                    {formatCurrency(program.fullPriceTicket)}
                  </div>
                </div>
                {program.classRepDiscount != null &&
                  program.classRepDiscount > 0 && (
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-sm text-purple-700 mb-1">
                        Class Rep Discount
                      </div>
                      <div className="text-xl font-semibold text-purple-900">
                        {formatCurrency(program.classRepDiscount)}
                      </div>
                      {program.classRepLimit != null &&
                        program.classRepLimit > 0 && (
                          <div className="text-xs text-purple-600 mt-1">
                            {program.classRepCount ?? 0} /{" "}
                            {program.classRepLimit} slots filled
                          </div>
                        )}
                    </div>
                  )}
                {program.earlyBirdDiscount != null &&
                  program.earlyBirdDiscount > 0 && (
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className="text-sm text-yellow-700 mb-1">
                        Early Bird Discount
                      </div>
                      <div className="text-xl font-semibold text-yellow-900">
                        {formatCurrency(program.earlyBirdDiscount)}
                      </div>
                      {program.earlyBirdDeadline && (
                        <div className="text-xs text-yellow-600 mt-1">
                          Until{" "}
                          {new Date(
                            program.earlyBirdDeadline,
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Tuition information coming soon.</p>
          )}
        </div>

        {/* Enroll CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-sm p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Ready to Join?</h2>
          <p className="text-blue-100 mb-6">
            Sign in or create an account to enroll in this program.
          </p>
          <button
            onClick={handleEnrollClick}
            className="inline-flex items-center px-8 py-3 border border-transparent text-lg font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 transition-colors"
          >
            Enroll Now
          </button>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <Link to="/events" className="hover:text-blue-600">
            Browse Public Events
          </Link>
          <span className="mx-2">•</span>
          <Link to="/login" className="hover:text-blue-600">
            Sign In
          </Link>
          <span className="mx-2">•</span>
          <Link to="/register" className="hover:text-blue-600">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}

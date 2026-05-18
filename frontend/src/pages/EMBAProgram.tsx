import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  annualMembershipService,
  programService,
  purchaseService,
} from "../services/api";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/common/LoadingSpinner";
import type { ProgramType } from "../constants/programTypes";
import type { AnnualMembership } from "../types/annualMembership";
import { formatCurrency } from "../utils/currency";

interface ProgramCard {
  id: string;
  name: string;
  timeSpan: string;
  type: ProgramType;
  isFree?: boolean;
  hasAccess?: boolean;
  accessReason?:
    | "admin"
    | "mentor"
    | "class_rep"
    | "creator"
    | "free"
    | "membership"
    | "purchased"
    | "not_purchased";
}

const EMBA_COLORS = {
  card: "bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 hover:from-blue-100 hover:to-indigo-200",
  badge: "bg-blue-100 text-blue-800 border-blue-300",
  title: "group-hover:text-blue-700",
  dot: "bg-blue-500 group-hover:bg-blue-700",
  shadow: "hover:shadow-blue-200/50",
};

const monthCodeToShort: Record<string, string> = {
  "01": "Jan",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Aug",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dec",
};
const fullToShort: Record<string, string> = {
  January: "Jan",
  February: "Feb",
  March: "Mar",
  April: "Apr",
  May: "May",
  June: "Jun",
  July: "Jul",
  August: "Aug",
  September: "Sep",
  October: "Oct",
  November: "Nov",
  December: "Dec",
};
const toShortMonth = (m?: string) => {
  if (!m) return "";
  if (monthCodeToShort[m]) return monthCodeToShort[m];
  if (fullToShort[m]) return fullToShort[m];
  return String(m).slice(0, 3);
};
const formatTimeSpan = (period?: {
  startYear?: string;
  startMonth?: string;
  endYear?: string;
  endMonth?: string;
}) => {
  if (!period) return "";
  const s = [toShortMonth(period.startMonth), period.startYear]
    .filter(Boolean)
    .join(" ");
  const e = [toShortMonth(period.endMonth), period.endYear]
    .filter(Boolean)
    .join(" ");
  return [s, e].filter(Boolean).join(" - ");
};

export default function EMBAProgram() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [programs, setPrograms] = useState<ProgramCard[]>([]);
  const [membershipOptionsByProgram, setMembershipOptionsByProgram] = useState<
    Record<string, AnnualMembership[]>
  >({});
  const [membershipPrompt, setMembershipPrompt] = useState<{
    programId: string;
    options: AnnualMembership[];
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnrollClick = useCallback(
    (e: React.MouseEvent, programId: string) => {
      e.stopPropagation();
      if (currentUser) {
        const options = membershipOptionsByProgram[programId] || [];
        if (options.length > 0) {
          setMembershipPrompt({ programId, options });
          return;
        }
        navigate(`/dashboard/programs/${programId}/enroll`);
      } else {
        setShowLoginModal(true);
      }
    },
    [currentUser, membershipOptionsByProgram, navigate],
  );

  const [showController, setShowController] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterYear, setFilterYear] = useState<string>("all");

  const [rawPrograms, setRawPrograms] = useState<
    Array<{
      id: string;
      name: string;
      type: ProgramCard["type"];
      isFree?: boolean;
      timeSpan: string;
      period?: {
        startYear?: string;
        startMonth?: string;
        endYear?: string;
        endMonth?: string;
      };
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const list = (await programService.list()) as Array<{
          id?: string;
          _id?: string;
          title?: string;
          programType: ProgramCard["type"];
          isFree?: boolean;
          period?: {
            startYear?: string;
            startMonth?: string;
            endYear?: string;
            endMonth?: string;
          };
        }>;
        if (cancelled) return;
        const mapped = (list || [])
          .filter((p) => p.programType === "EMBA Mentor Circles")
          .map((p) => ({
            id: (p.id || p._id || "").toString(),
            name: p.title || "(Untitled Program)",
            type: p.programType,
            isFree: p.isFree,
            timeSpan: formatTimeSpan(p.period),
            period: p.period,
          }));
        setRawPrograms(mapped);
      } catch (err) {
        console.error("Failed to load EMBA programs", err);
        if (!cancelled)
          setError("Failed to load EMBA programs. Please try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let filtered = [...rawPrograms];

    if (filterYear !== "all") {
      filtered = filtered.filter((p) => p.period?.startYear === filterYear);
    }

    filtered.sort((a, b) => {
      const aYear = parseInt(a.period?.startYear || "0");
      const bYear = parseInt(b.period?.startYear || "0");
      const aMonth = parseInt(a.period?.startMonth || "0");
      const bMonth = parseInt(b.period?.startMonth || "0");
      const aTime = aYear * 12 + aMonth;
      const bTime = bYear * 12 + bMonth;
      return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
    });

    const programCards: ProgramCard[] = filtered.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      timeSpan: p.timeSpan,
      isFree: p.isFree,
      hasAccess: undefined,
      accessReason: undefined,
    }));

    setPrograms(programCards);
  }, [rawPrograms, sortOrder, filterYear]);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const memberships = await annualMembershipService.list();
        if (cancelled) return;
        const map: Record<string, AnnualMembership[]> = {};
        memberships
          .filter(
            (membership) =>
              !membership.purchased && !membership.adminAccess && membership.isActive,
          )
          .forEach((membership) => {
            membership.programs.forEach((program) => {
              const programId = program.id || program._id;
              if (!programId) return;
              map[programId] = [...(map[programId] || []), membership];
            });
          });
        setMembershipOptionsByProgram(map);
      } catch (error) {
        console.error("Failed to load annual membership options", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (programs.length === 0 || !currentUser) {
      if (!currentUser && programs.length > 0) {
        setPrograms((prev) =>
          prev.map((p) =>
            p.isFree
              ? p
              : { ...p, hasAccess: false, accessReason: "not_purchased" },
          ),
        );
      }
      return;
    }

    const checkAllAccess = async () => {
      try {
        const accessChecks = programs.map(async (program) => {
          try {
            const result = await purchaseService.checkProgramAccess(program.id);
            return {
              id: program.id,
              hasAccess: result.hasAccess,
              accessReason: result.reason,
            };
          } catch (error) {
            console.error(
              `Failed to check access for program ${program.id}`,
              error,
            );
            return {
              id: program.id,
              hasAccess: false,
              accessReason: "not_purchased" as const,
            };
          }
        });

        const results = await Promise.all(accessChecks);
        setPrograms((prev) =>
          prev.map((program) => {
            const result = results.find((r) => r.id === program.id);
            return result
              ? {
                  ...program,
                  hasAccess: result.hasAccess,
                  accessReason: result.accessReason,
                }
              : program;
          }),
        );
      } catch (error) {
        console.error("Failed to check program access", error);
      }
    };

    checkAllAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs.length, currentUser?.id]);

  const availableYears = Array.from(
    new Set(rawPrograms.map((p) => p.period?.startYear).filter(Boolean)),
  ).sort();

  const handleProgramClick = (program: ProgramCard) => {
    navigate(`/dashboard/programs/${program.id}`);
  };

  const handleCreateProgram = () => {
    navigate("/dashboard/programs/new");
  };

  const canCreateProgram =
    !!currentUser &&
    (currentUser.role === "Super Admin" ||
      currentUser.role === "Administrator" ||
      currentUser.role === "Leader");

  if (loading && programs.length === 0) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  EMBA Program
                </h1>
                <p className="mt-2 text-gray-600">
                  EMBA Mentor Circles program series.
                </p>
              </div>
              <button
                onClick={() => setShowController(!showController)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-all duration-200 text-sm font-medium text-gray-700"
              >
                {showController ? (
                  <>
                    <ChevronUpIcon className="w-4 h-4" />
                    Hide Controls
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="w-4 h-4" />
                    Show Controls
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 px-4 py-3">
              {error}
            </div>
          )}

          {/* Controller Section */}
          {showController && (
            <div className="mb-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Filter Zone — Start Year only */}
              <div className="p-4 bg-blue-50 border-b border-blue-100">
                <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z"
                    />
                  </svg>
                  Filters
                </h3>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="emba-filter-year"
                      className="text-sm font-medium text-gray-700"
                    >
                      Start Year:
                    </label>
                    <select
                      id="emba-filter-year"
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sorter Zone */}
              <div className="p-4 bg-green-50">
                <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 5v4m4-4v4m4-4v4"
                    />
                  </svg>
                  Sort Options
                </h3>
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="emba-sort-order"
                      className="text-sm font-medium text-gray-700"
                    >
                      Sort by Start Time:
                    </label>
                    <select
                      id="emba-sort-order"
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as "asc" | "desc")
                      }
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                  <div className="text-sm text-gray-500">
                    {programs.length} program{programs.length !== 1 ? "s" : ""}{" "}
                    found
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Programs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(loading ? [] : programs).map((program) => {
              const showEnrollButton =
                !program.isFree &&
                program.hasAccess === false &&
                program.accessReason === "not_purchased";

              return (
                <div
                  key={program.id}
                  className={`rounded-lg shadow-sm border transition-all duration-300 group ${EMBA_COLORS.card} ${EMBA_COLORS.shadow} relative`}
                  style={{ aspectRatio: "3/4" }}
                >
                  <div
                    onClick={() => handleProgramClick(program)}
                    className="p-6 h-full flex flex-col justify-between cursor-pointer"
                  >
                    <div className="mb-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${EMBA_COLORS.badge}`}
                      >
                        {program.type}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3
                        className={`text-xl font-bold text-gray-900 transition-colors ${EMBA_COLORS.title}`}
                      >
                        {program.name}
                      </h3>
                      <p className="mt-4 text-sm text-gray-700 leading-relaxed font-medium">
                        {program.timeSpan}
                      </p>
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/30 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 uppercase tracking-wider font-bold">
                          Program Series
                        </span>
                        {!program.isFree && !showEnrollButton && (
                          <div
                            className={`w-3 h-3 rounded-full transition-colors ${EMBA_COLORS.dot}`}
                          ></div>
                        )}
                      </div>
                      {program.isFree && (
                        <img
                          src="/check.svg"
                          alt="Free Program"
                          className="w-8 h-8 text-green-600 absolute -bottom-2 -right-2"
                        />
                      )}
                      {!program.isFree &&
                        program.hasAccess &&
                        (program.accessReason === "purchased" ||
                          program.accessReason === "admin" ||
                          program.accessReason === "class_rep" ||
                          program.accessReason === "membership" ||
                          program.accessReason === "mentor") && (
                          <img
                            src="/check.svg"
                            alt="Enrolled"
                            className="w-8 h-8 text-green-600 absolute -bottom-2 -right-2"
                          />
                        )}
                      {showEnrollButton && (
                        <button
                          onClick={(e) => handleEnrollClick(e, program.id)}
                          className="absolute -bottom-2 -right-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-4 rounded-md shadow-md hover:shadow-lg transition-all duration-200"
                        >
                          Enroll
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && programs.length > 0 && (
              <div className="col-span-1 sm:col-span-2 lg:grid-cols-3 xl:col-span-4 flex justify-center items-center min-h-48">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}

            {!loading && programs.length === 0 && (
              <div className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-700">
                  <p className="font-medium">
                    No EMBA Mentor Circles programs found.
                  </p>
                  {canCreateProgram ? (
                    <p className="text-sm text-gray-500 mt-1">
                      Click &quot;Create Program&quot; to add your first
                      program.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">
                      Programs will appear here once they are created.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Create Program Button - Visible to Super Admin, Administrator, and Leader */}
            {canCreateProgram && (
              <div
                onClick={handleCreateProgram}
                className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-lg shadow-sm border-2 border-dashed border-gray-300 hover:border-green-400 hover:from-green-50 hover:to-emerald-100 transition-all duration-300 cursor-pointer group flex items-center justify-center hover:shadow-green-200/50"
                style={{ aspectRatio: "3/4" }}
              >
                <div className="text-center">
                  <PlusIcon className="w-12 h-12 text-gray-400 group-hover:text-green-600 transition-colors mx-auto mb-4" />
                  <p className="text-base font-semibold text-gray-700 group-hover:text-green-700 transition-colors">
                    Create Program
                  </p>
                  <p className="text-sm text-gray-500 mt-2 group-hover:text-green-600 transition-colors">
                    Add a new program series
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4 w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Login Required
            </h3>
            <p className="text-gray-600 mb-6">
              Please log in or create an account to complete your enrollment.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLoginModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => navigate("/login")}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      )}

      {membershipPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Annual Membership Option
            </h3>
            <p className="mt-2 text-sm leading-6 text-gray-700">
              This program is included in{" "}
              <strong>{membershipPrompt.options[0].title}</strong>. You can
              unlock it together with{" "}
              {membershipPrompt.options[0].programs
                .map((program) => program.title)
                .join(", ")}{" "}
              for {formatCurrency(membershipPrompt.options[0].price)}.
            </p>
            {membershipPrompt.options.length > 1 && (
              <p className="mt-2 text-sm text-gray-600">
                There are {membershipPrompt.options.length} annual membership
                options for this program.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  const programId = membershipPrompt.programId;
                  setMembershipPrompt(null);
                  navigate(`/dashboard/programs/${programId}/enroll`);
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Continue Enrollment
              </button>
              <button
                onClick={() =>
                  navigate(
                    `/dashboard/annual-memberships/${membershipPrompt.options[0].id}`,
                  )
                }
                className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
              >
                View Membership
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

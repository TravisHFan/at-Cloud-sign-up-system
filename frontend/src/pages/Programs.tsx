import { PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { programService } from "../services/api";

// Card model for UI
interface ProgramCard {
  id: string;
  name: string;
  timeSpan: string;
  type: "EMBA Mentor Circles" | "Effective Communication Workshops";
}

// Static helpers live at module scope to avoid exhaustive-deps warnings
const getProgramTypeColors = (type: ProgramCard["type"]) => {
  switch (type) {
    case "EMBA Mentor Circles":
      return {
        card: "bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 hover:from-blue-100 hover:to-indigo-200",
        badge: "bg-blue-100 text-blue-800 border-blue-300",
        title: "group-hover:text-blue-700",
        dot: "bg-blue-500 group-hover:bg-blue-700",
        shadow: "hover:shadow-blue-200/50",
      };
    case "Effective Communication Workshops":
      return {
        card: "bg-gradient-to-br from-orange-50 to-amber-100 border-orange-200 hover:from-orange-100 hover:to-amber-200",
        badge: "bg-orange-100 text-orange-800 border-orange-300",
        title: "group-hover:text-orange-700",
        dot: "bg-orange-500 group-hover:bg-orange-700",
        shadow: "hover:shadow-orange-200/50",
      };
    default:
      return {
        card: "bg-gradient-to-br from-gray-50 to-slate-100 border-gray-200 hover:from-gray-100 hover:to-slate-200",
        badge: "bg-gray-100 text-gray-800 border-gray-300",
        title: "group-hover:text-gray-700",
        dot: "bg-gray-500 group-hover:bg-gray-700",
        shadow: "hover:shadow-gray-200/50",
      };
  }
};
// Helpers to format period
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
  // fallback: first 3 letters
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

export default function Programs() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<ProgramCard[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sort and filter states
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Store raw program data with period info for sorting
  const [rawPrograms, setRawPrograms] = useState<
    Array<{
      id: string;
      name: string;
      type: ProgramCard["type"];
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
          period?: {
            startYear?: string;
            startMonth?: string;
            endYear?: string;
            endMonth?: string;
          };
        }>;
        if (cancelled) return;
        const mapped = (list || []).map((p) => ({
          id: (p.id || p._id || "").toString(),
          name: p.title || "(Untitled Program)",
          type: p.programType,
          timeSpan: formatTimeSpan(p.period),
          period: p.period,
        }));
        setRawPrograms(mapped);
      } catch (err) {
        console.error("Failed to load programs", err);
        if (!cancelled)
          setError("Failed to load programs. Please try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Process programs with sorting and filtering
  useEffect(() => {
    let filtered = [...rawPrograms];

    // Filter by year
    if (filterYear !== "all") {
      filtered = filtered.filter((p) => p.period?.startYear === filterYear);
    }

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((p) => p.type === filterType);
    }

    // Sort by start time (year + month)
    filtered.sort((a, b) => {
      const aYear = parseInt(a.period?.startYear || "0");
      const bYear = parseInt(b.period?.startYear || "0");
      const aMonth = parseInt(a.period?.startMonth || "0");
      const bMonth = parseInt(b.period?.startMonth || "0");

      const aTime = aYear * 12 + aMonth;
      const bTime = bYear * 12 + bMonth;

      return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
    });

    // Convert to ProgramCard format for display
    const programCards: ProgramCard[] = filtered.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      timeSpan: p.timeSpan,
    }));

    setPrograms(programCards);
  }, [rawPrograms, sortOrder, filterYear, filterType]);

  // Get unique years and types for filter dropdowns
  const availableYears = Array.from(
    new Set(rawPrograms.map((p) => p.period?.startYear).filter(Boolean))
  ).sort();
  const availableTypes = Array.from(
    new Set(rawPrograms.map((p) => p.type))
  ).sort();

  const handleCreateProgram = () => {
    navigate("/dashboard/programs/new");
  };

  const handleProgramClick = (program: ProgramCard) => {
    navigate(`/dashboard/programs/${program.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
          <p className="mt-2 text-gray-600">
            Multi-month program series comprising various events and activities.
          </p>
        </div>

        {/* Status banners */}
        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            {error}
          </div>
        )}

        {/* Sort and Filter Controls */}
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Sort Control */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="sort-order"
                className="text-sm font-medium text-gray-700"
              >
                Sort by Start Time:
              </label>
              <select
                id="sort-order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>

            {/* Filter by Year */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="filter-year"
                className="text-sm font-medium text-gray-700"
              >
                Start Year:
              </label>
              <select
                id="filter-year"
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

            {/* Filter by Program Type */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="filter-type"
                className="text-sm font-medium text-gray-700"
              >
                Program Type:
              </label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-500">
            {programs.length} program{programs.length !== 1 ? "s" : ""} found
          </div>
        </div>

        {/* Programs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Program Cards */}
          {(loading ? [] : programs).map((program) => {
            const colors = getProgramTypeColors(program.type);
            return (
              <div
                key={program.id}
                onClick={() => handleProgramClick(program)}
                className={`rounded-lg shadow-sm border transition-all duration-300 cursor-pointer group ${colors.card} ${colors.shadow}`}
                style={{ aspectRatio: "3/4" }} // Height > Width
              >
                <div className="p-6 h-full flex flex-col justify-between">
                  {/* Program Type Badge */}
                  <div className="mb-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${colors.badge}`}
                    >
                      {program.type}
                    </span>
                  </div>

                  {/* Program Content */}
                  <div className="flex-1">
                    <h3
                      className={`text-xl font-bold text-gray-900 transition-colors ${colors.title}`}
                    >
                      {program.name}
                    </h3>
                    <p className="mt-4 text-sm text-gray-700 leading-relaxed font-medium">
                      {program.timeSpan}
                    </p>
                  </div>

                  {/* Bottom Info */}
                  <div className="mt-6 pt-4 border-t border-white/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 uppercase tracking-wider font-bold">
                        Program Series
                      </span>
                      <div
                        className={`w-3 h-3 rounded-full transition-colors ${colors.dot}`}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading placeholder */}
          {loading && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 flex justify-center items-center min-h-48">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Empty state (when not loading and no programs) */}
          {!loading && programs.length === 0 && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4">
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-700">
                <p className="font-medium">No programs found.</p>
                <p className="text-sm text-gray-500 mt-1">
                  Click “Create Program” to add your first program.
                </p>
              </div>
            </div>
          )}

          {/* Create Program Button */}
          <div
            onClick={handleCreateProgram}
            className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-lg shadow-sm border-2 border-dashed border-gray-300 hover:border-green-400 hover:from-green-50 hover:to-emerald-100 transition-all duration-300 cursor-pointer group flex items-center justify-center hover:shadow-green-200/50"
            style={{ aspectRatio: "3/4" }} // Height > Width
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
        </div>
      </div>
    </div>
  );
}

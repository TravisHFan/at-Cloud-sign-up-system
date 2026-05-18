import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { annualMembershipService, programService } from "../services/api";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { formatCurrency } from "../utils/currency";
import type { AnnualMembership } from "../types/annualMembership";
import type { ProgramType } from "../constants/programTypes";

type ProgramOption = {
  id: string;
  title: string;
  programType: ProgramType | string;
  period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  fullPriceTicket?: number;
};

const monthShort: Record<string, string> = {
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

function formatPeriod(period?: ProgramOption["period"]) {
  if (!period) return "No period set";
  const start = [monthShort[period.startMonth || ""] || period.startMonth, period.startYear]
    .filter(Boolean)
    .join(" ");
  const end = [monthShort[period.endMonth || ""] || period.endMonth, period.endYear]
    .filter(Boolean)
    .join(" ");
  return [start, end].filter(Boolean).join(" - ") || "No period set";
}

function dollarsToCents(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return NaN;
  return Math.round(numeric * 100);
}

export default function AnnualMembershipForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editing = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membership, setMembership] = useState<AnnualMembership | null>(null);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"title" | "start">("title");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [programData, membershipData] = await Promise.all([
          programService.list(),
          editing && id ? annualMembershipService.getById(id) : null,
        ]);

        if (cancelled) return;

        const mappedPrograms = (programData as Array<{
          id?: string;
          _id?: string;
          title?: string;
          programType: ProgramType | string;
          period?: ProgramOption["period"];
          fullPriceTicket?: number;
        }>)
          .map((program) => ({
            id: (program.id || program._id || "").toString(),
            title: program.title || "(Untitled Program)",
            programType: program.programType,
            period: program.period,
            fullPriceTicket: program.fullPriceTicket,
          }))
          .filter((program) => program.id);

        setPrograms(mappedPrograms);

        if (membershipData) {
          setMembership(membershipData);
          setTitle(membershipData.title);
          setPrice((membershipData.price / 100).toFixed(2));
          setIsActive(membershipData.isActive !== false);
          setSelectedProgramIds(
            membershipData.programs
              .map((program) => program.id || program._id || "")
              .filter(Boolean),
          );
        }
      } catch (err) {
        console.error("Failed to load annual membership form", err);
        if (!cancelled)
          setError("Failed to load annual membership setup. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, id]);

  const availableTypes = useMemo(
    () => Array.from(new Set(programs.map((program) => program.programType))).sort(),
    [programs],
  );

  const filteredPrograms = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = programs.filter((program) => {
      const matchesSearch =
        !term ||
        program.title.toLowerCase().includes(term) ||
        String(program.programType).toLowerCase().includes(term);
      const matchesType =
        typeFilter === "all" || program.programType === typeFilter;
      return matchesSearch && matchesType;
    });

    list.sort((a, b) => {
      if (sortBy === "start") {
        const aKey = `${a.period?.startYear || "9999"}${a.period?.startMonth || "99"}`;
        const bKey = `${b.period?.startYear || "9999"}${b.period?.startMonth || "99"}`;
        return aKey.localeCompare(bKey);
      }
      return a.title.localeCompare(b.title);
    });

    return list;
  }, [programs, search, typeFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredPrograms.length / pageSize));
  const pagePrograms = filteredPrograms.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, sortBy]);

  const toggleProgram = (programId: string) => {
    setSelectedProgramIds((prev) =>
      prev.includes(programId)
        ? prev.filter((id) => id !== programId)
        : [...prev, programId],
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cents = dollarsToCents(price);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!Number.isInteger(cents) || cents < 50) {
      setError("Price must be at least $0.50.");
      return;
    }
    if (selectedProgramIds.length === 0) {
      setError("Please select at least one program.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = {
        title: title.trim(),
        price: cents,
        programIds: selectedProgramIds,
        isActive,
      };
      const saved = editing && id
        ? await annualMembershipService.update(id, payload)
        : await annualMembershipService.create(payload);
      navigate(`/dashboard/annual-memberships/${saved.id}`);
    } catch (err) {
      console.error("Failed to save annual membership", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save annual membership.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="min-h-full bg-gray-50 p-6">
      <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {editing ? "Edit Annual Membership" : "Create Annual Membership"}
          </h1>
          <p className="mt-2 text-gray-600">
            Build a suite of programs that users can unlock with one purchase.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <label
                htmlFor="membership-title"
                className="block text-sm font-medium text-gray-700"
              >
                Title
              </label>
              <input
                id="membership-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                placeholder="2026-2027 NextGen Annual Membership"
              />
            </div>
            <div>
              <label
                htmlFor="membership-price"
                className="block text-sm font-medium text-gray-700"
              >
                Price
              </label>
              <div className="mt-2 flex rounded-md shadow-sm">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500">
                  $
                </span>
                <input
                  id="membership-price"
                  type="number"
                  min="0.50"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="block w-full rounded-r-md border border-gray-300 px-3 py-2 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                  placeholder="100.00"
                />
              </div>
            </div>
          </div>

          <label className="mt-5 inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="rounded border-gray-300 text-cyan-700 focus:ring-cyan-600"
            />
            Active and visible to users
          </label>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label
                htmlFor="program-search"
                className="block text-sm font-medium text-gray-700"
              >
                Filter Programs
              </label>
              <input
                id="program-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                placeholder="Search by title or type"
              />
            </div>
            <div>
              <label
                htmlFor="program-type"
                className="block text-sm font-medium text-gray-700"
              >
                Program Type
              </label>
              <select
                id="program-type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600"
              >
                <option value="all">All Types</option>
                {availableTypes.map((type) => (
                  <option key={String(type)} value={String(type)}>
                    {String(type)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="program-sort"
                className="block text-sm font-medium text-gray-700"
              >
                Sort
              </label>
              <select
                id="program-sort"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as "title" | "start")
                }
                className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600"
              >
                <option value="title">Title</option>
                <option value="start">Start Time</option>
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            {selectedProgramIds.length} selected. Membership price:{" "}
            {Number.isFinite(dollarsToCents(price))
              ? formatCurrency(Math.max(0, dollarsToCents(price)))
              : "$0.00"}
          </div>

          <div className="mt-5 divide-y divide-gray-200 rounded-lg border border-gray-200">
            {pagePrograms.map((program) => (
              <label
                key={program.id}
                className="flex cursor-pointer items-start gap-3 p-4 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedProgramIds.includes(program.id)}
                  onChange={() => toggleProgram(program.id)}
                  className="mt-1 rounded border-gray-300 text-cyan-700 focus:ring-cyan-600"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    {program.title}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {program.programType} · {formatPeriod(program.period)}
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {formatCurrency(program.fullPriceTicket || 0)}
                </div>
              </label>
            ))}
          </div>

          {filteredPrograms.length === 0 && (
            <div className="mt-5 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-600">
              No programs match these filters.
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
                className="rounded-md border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
                disabled={page >= totalPages}
                className="rounded-md border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() =>
              navigate(
                membership
                  ? `/dashboard/annual-memberships/${membership.id}`
                  : "/dashboard/annual-memberships",
              )
            }
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : editing ? "Save Changes" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

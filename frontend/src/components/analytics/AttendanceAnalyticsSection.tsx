import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import Pagination from "../common/Pagination";
import { TabNav } from "../ui";
import type { TabNavItem } from "../ui";
import type {
  AttendanceAnalytics,
  AttendanceCounts,
  AttendanceEventAnalytics,
  AttendancePersonAnalytics,
  AttendanceProgramAnalytics,
} from "../../services/api/analytics.api";

type AttendanceSubTab = "person" | "program" | "event";
type SortDirection = "asc" | "desc";
type SortValue = string | number | null | undefined;
type SearchField = string | number | null | undefined | SearchField[];

type FilterOption = {
  value: string;
  label: string;
};

type FilterConfig<T> = {
  id: string;
  label: string;
  options: FilterOption[];
  predicate: (row: T, value: string) => boolean;
};

type SortOption<T> = {
  value: string;
  label: string;
  getValue: (row: T) => SortValue;
};

type AttendanceTableColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  className?: string;
  render: (row: T) => ReactNode;
};

const ALL_FILTER_VALUE = "__all";
const DEFAULT_PAGE_SIZE = 10;
const pageSizeOptions = [10, 25, 50];

const attendanceSubTabs: TabNavItem<AttendanceSubTab>[] = [
  { id: "person", label: "By Person" },
  { id: "program", label: "By Program" },
  { id: "event", label: "By Event" },
];

const attendanceStatusOptions: FilterOption[] = [
  { value: ALL_FILTER_VALUE, label: "All attendance" },
  { value: "has-attended", label: "Has attended" },
  { value: "has-absent", label: "Has absent" },
  { value: "has-unrecorded", label: "Has unrecorded" },
  { value: "perfect", label: "Perfect attendance" },
  { value: "below-half", label: "Below 50%" },
  { value: "none-attended", label: "No attended records" },
];

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function flattenSearchFields(fields: SearchField[]): string[] {
  return fields.flatMap((field): string[] => {
    if (Array.isArray(field)) return flattenSearchFields(field);
    if (field === null || field === undefined) return [];
    return [String(field)];
  });
}

function getLevenshteinDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function matchesVagueTerm(term: string, words: string[], acronym: string) {
  if (acronym.includes(term)) return true;

  return words.some((word) => {
    if (word.includes(term)) return true;
    if (term.length < 3 || word.length < 3) return false;

    const maxDistance = Math.max(1, Math.floor(term.length * 0.25));
    if (Math.abs(word.length - term.length) > maxDistance) return false;

    return getLevenshteinDistance(word, term) <= maxDistance;
  });
}

function matchesSearch(fields: SearchField[], query: string) {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = normalizeText(flattenSearchFields(fields).join(" "));
  const words = haystack.split(/\s+/).filter(Boolean);
  const acronym = words.map((word) => word[0]).join("");

  return terms.every(
    (term) => haystack.includes(term) || matchesVagueTerm(term, words, acronym)
  );
}

function compareSortValues(
  first: SortValue,
  second: SortValue,
  direction: SortDirection
) {
  const order = direction === "asc" ? 1 : -1;

  if (first === second) return 0;
  if (first === null || first === undefined || first === "") return 1;
  if (second === null || second === undefined || second === "") return -1;

  if (typeof first === "number" && typeof second === "number") {
    return (first - second) * order;
  }

  return String(first).localeCompare(String(second), undefined, {
    numeric: true,
    sensitivity: "base",
  }) * order;
}

function buildSelectOptions(values: string[], allLabel: string) {
  const uniqueValues = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).sort((first, second) => first.localeCompare(second));

  return [
    { value: ALL_FILTER_VALUE, label: allLabel },
    ...uniqueValues.map((value) => ({ value, label: value })),
  ];
}

function matchesAttendanceStatus(row: AttendanceCounts, value: string) {
  switch (value) {
    case ALL_FILTER_VALUE:
      return true;
    case "has-attended":
      return row.attended > 0;
    case "has-absent":
      return row.absent > 0;
    case "has-unrecorded":
      return row.unrecorded > 0;
    case "perfect":
      return row.registered > 0 && row.attendanceRate === 100;
    case "below-half":
      return row.registered > 0 && row.attendanceRate < 50;
    case "none-attended":
      return row.attended === 0;
    default:
      return true;
  }
}

function personRole(person: AttendancePersonAnalytics) {
  return person.roleInAtCloud || person.systemAuthorizationLevel || "Unknown";
}

function dateSortValue(value?: string) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "green" | "red" | "amber";
  icon: typeof ClipboardDocumentCheckIcon;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className={`${tones[tone]} rounded-lg p-5 flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}

function countColumns<T extends AttendanceCounts>(): AttendanceTableColumn<T>[] {
  return [
    {
      key: "registered",
      label: "Registered",
      align: "right",
      render: (row) => row.registered,
    },
    {
      key: "attended",
      label: "Attended",
      align: "right",
      className: "text-green-700",
      render: (row) => row.attended,
    },
    {
      key: "absent",
      label: "Absent",
      align: "right",
      className: "text-red-700",
      render: (row) => row.absent,
    },
    {
      key: "unrecorded",
      label: "Unrecorded",
      align: "right",
      className: "text-amber-700",
      render: (row) => row.unrecorded,
    },
    {
      key: "attendanceRate",
      label: "Rate",
      align: "right",
      className: "font-medium text-gray-900",
      render: (row) => formatPercent(row.attendanceRate),
    },
  ];
}

function AttendanceDataTable<T>({
  title,
  rows,
  columns,
  getRowKey,
  searchPlaceholder,
  searchFields,
  sortOptions,
  defaultSort,
  filterConfigs,
  emptyMessage,
}: {
  title: string;
  rows: T[];
  columns: AttendanceTableColumn<T>[];
  getRowKey: (row: T) => string;
  searchPlaceholder: string;
  searchFields: (row: T) => SearchField[];
  sortOptions: SortOption<T>[];
  defaultSort: string;
  filterConfigs: FilterConfig<T>[];
  emptyMessage: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState(defaultSort);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        filterConfigs.map((filter) => [filter.id, ALL_FILTER_VALUE])
      )
  );

  useEffect(() => {
    setFilterValues((previous) => {
      let changed = false;
      const next: Record<string, string> = {};

      filterConfigs.forEach((filter) => {
        next[filter.id] = previous[filter.id] ?? ALL_FILTER_VALUE;
        changed ||= next[filter.id] !== previous[filter.id];
      });

      changed ||= Object.keys(previous).length !== filterConfigs.length;
      return changed ? next : previous;
    });
  }, [filterConfigs]);

  const filterSignature = JSON.stringify(filterValues);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortKey, sortDirection, pageSize, filterSignature]);

  const processedRows = useMemo(() => {
    const selectedSort =
      sortOptions.find((option) => option.value === sortKey) ?? sortOptions[0];

    return rows
      .filter((row) => matchesSearch(searchFields(row), searchQuery))
      .filter((row) =>
        filterConfigs.every((filter) =>
          filter.predicate(row, filterValues[filter.id] ?? ALL_FILTER_VALUE)
        )
      )
      .slice()
      .sort((first, second) =>
        compareSortValues(
          selectedSort?.getValue(first),
          selectedSort?.getValue(second),
          sortDirection
        )
      );
  }, [
    filterConfigs,
    filterValues,
    rows,
    searchFields,
    searchQuery,
    sortDirection,
    sortKey,
    sortOptions,
  ]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRows = processedRows.slice(startIndex, startIndex + pageSize);
  const visibleStart = processedRows.length === 0 ? 0 : startIndex + 1;
  const visibleEnd = Math.min(startIndex + pageSize, processedRows.length);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  return (
    <section>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">
            {processedRows.length === rows.length
              ? `${rows.length} records`
              : `${processedRows.length} of ${rows.length} records`}
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <label className="md:col-span-2 xl:col-span-2">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Search
          </span>
          <div className="relative">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </label>

        {filterConfigs.map((filter) => (
          <label key={filter.id}>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {filter.label}
            </span>
            <select
              value={filterValues[filter.id] ?? ALL_FILTER_VALUE}
              onChange={(event) =>
                setFilterValues((previous) => ({
                  ...previous,
                  [filter.id]: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        <label>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Sort
          </span>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Direction
          </span>
          <select
            value={sortDirection}
            onChange={(event) =>
              setSortDirection(event.target.value as SortDirection)
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Page Size
          </span>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-3 font-medium ${
                    column.align === "right" ? "text-right" : ""
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedRows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-3 ${
                      column.align === "right" ? "text-right" : ""
                    } ${column.className ?? ""}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {paginatedRows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            {emptyMessage}
          </div>
        )}
      </div>

      {processedRows.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            Showing {visibleStart}-{visibleEnd} of {processedRows.length}
            {processedRows.length !== rows.length
              ? ` filtered from ${rows.length}`
              : ""}{" "}
            records
          </p>
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            hasNext={safeCurrentPage < totalPages}
            hasPrev={safeCurrentPage > 1}
            onPageChange={setCurrentPage}
            showPageNumbers
            size="sm"
          />
        </div>
      )}
    </section>
  );
}

function PersonAttendanceTable({
  rows,
}: {
  rows: AttendancePersonAnalytics[];
}) {
  const programOptions = useMemo(
    () =>
      buildSelectOptions(
        rows.flatMap((person) => person.programs),
        "All programs"
      ),
    [rows]
  );
  const roleOptions = useMemo(
    () => buildSelectOptions(rows.map(personRole), "All roles"),
    [rows]
  );

  const columns: AttendanceTableColumn<AttendancePersonAnalytics>[] = [
    {
      key: "person",
      label: "Person",
      render: (person) => (
        <div>
          <div className="font-medium text-gray-900">{person.name}</div>
          <div className="text-xs text-gray-500">{personRole(person)}</div>
        </div>
      ),
    },
    {
      key: "programs",
      label: "Programs",
      render: (person) => (
        <span className="text-gray-600">
          {person.programs.slice(0, 2).join(", ")}
          {person.programs.length > 2 ? ` +${person.programs.length - 2}` : ""}
        </span>
      ),
    },
    ...countColumns<AttendancePersonAnalytics>(),
    {
      key: "lastAttended",
      label: "Last Attended",
      render: (person) => (
        <div className="text-gray-600">
          <div>{formatDate(person.lastAttendedAt) || "Never"}</div>
          <div className="max-w-44 truncate text-xs">
            {person.lastAttendedEvent}
          </div>
        </div>
      ),
    },
  ];

  const sortOptions: SortOption<AttendancePersonAnalytics>[] = [
    { value: "name", label: "Name", getValue: (person) => person.name },
    {
      value: "registered",
      label: "Registered",
      getValue: (person) => person.registered,
    },
    {
      value: "attended",
      label: "Attended",
      getValue: (person) => person.attended,
    },
    { value: "absent", label: "Absent", getValue: (person) => person.absent },
    {
      value: "unrecorded",
      label: "Unrecorded",
      getValue: (person) => person.unrecorded,
    },
    {
      value: "attendanceRate",
      label: "Attendance Rate",
      getValue: (person) => person.attendanceRate,
    },
    {
      value: "lastAttended",
      label: "Last Attended",
      getValue: (person) => dateSortValue(person.lastAttendedAt),
    },
  ];

  const filterConfigs: FilterConfig<AttendancePersonAnalytics>[] = [
    {
      id: "attendance",
      label: "Attendance",
      options: attendanceStatusOptions,
      predicate: matchesAttendanceStatus,
    },
    {
      id: "program",
      label: "Program",
      options: programOptions,
      predicate: (person, value) =>
        value === ALL_FILTER_VALUE || person.programs.includes(value),
    },
    {
      id: "role",
      label: "Role",
      options: roleOptions,
      predicate: (person, value) =>
        value === ALL_FILTER_VALUE || personRole(person) === value,
    },
  ];

  return (
    <AttendanceDataTable
      title="Attendance By Person"
      rows={rows}
      columns={columns}
      getRowKey={(person) => person.userId}
      searchPlaceholder="Search people, roles, programs, or last attended event"
      searchFields={(person) => [
        person.name,
        person.roleInAtCloud,
        person.systemAuthorizationLevel,
        person.programs,
        person.lastAttendedEvent,
      ]}
      sortOptions={sortOptions}
      defaultSort="name"
      filterConfigs={filterConfigs}
      emptyMessage="No people match the current attendance filters."
    />
  );
}

function ProgramAttendanceTable({
  rows,
}: {
  rows: AttendanceProgramAnalytics[];
}) {
  const typeOptions = useMemo(
    () => buildSelectOptions(rows.map((program) => program.programType), "All types"),
    [rows]
  );

  const columns: AttendanceTableColumn<AttendanceProgramAnalytics>[] = [
    {
      key: "program",
      label: "Program",
      render: (program) => (
        <div>
          <div className="font-medium text-gray-900">
            {program.programTitle}
          </div>
          <div className="text-xs text-gray-500">{program.programType}</div>
        </div>
      ),
    },
    {
      key: "events",
      label: "Events",
      align: "right",
      render: (program) => program.completedEvents,
    },
    ...countColumns<AttendanceProgramAnalytics>(),
  ];

  const sortOptions: SortOption<AttendanceProgramAnalytics>[] = [
    {
      value: "title",
      label: "Program",
      getValue: (program) => program.programTitle,
    },
    {
      value: "type",
      label: "Program Type",
      getValue: (program) => program.programType,
    },
    {
      value: "events",
      label: "Events",
      getValue: (program) => program.completedEvents,
    },
    {
      value: "registered",
      label: "Registered",
      getValue: (program) => program.registered,
    },
    {
      value: "attended",
      label: "Attended",
      getValue: (program) => program.attended,
    },
    {
      value: "absent",
      label: "Absent",
      getValue: (program) => program.absent,
    },
    {
      value: "attendanceRate",
      label: "Attendance Rate",
      getValue: (program) => program.attendanceRate,
    },
  ];

  const filterConfigs: FilterConfig<AttendanceProgramAnalytics>[] = [
    {
      id: "attendance",
      label: "Attendance",
      options: attendanceStatusOptions,
      predicate: matchesAttendanceStatus,
    },
    {
      id: "type",
      label: "Program Type",
      options: typeOptions,
      predicate: (program, value) =>
        value === ALL_FILTER_VALUE || program.programType === value,
    },
  ];

  return (
    <AttendanceDataTable
      title="Attendance By Program"
      rows={rows}
      columns={columns}
      getRowKey={(program) => program.programId}
      searchPlaceholder="Search programs or program types"
      searchFields={(program) => [
        program.programTitle,
        program.programType,
      ]}
      sortOptions={sortOptions}
      defaultSort="title"
      filterConfigs={filterConfigs}
      emptyMessage="No programs match the current attendance filters."
    />
  );
}

function EventAttendanceTable({ rows }: { rows: AttendanceEventAnalytics[] }) {
  const programOptions = useMemo(
    () =>
      buildSelectOptions(
        rows.flatMap((event) => event.programs.map((program) => program.title)),
        "All programs"
      ),
    [rows]
  );
  const eventTypeOptions = useMemo(
    () => buildSelectOptions(rows.map((event) => event.eventType), "All types"),
    [rows]
  );

  const columns: AttendanceTableColumn<AttendanceEventAnalytics>[] = [
    {
      key: "event",
      label: "Event",
      render: (event) => (
        <div>
          <div className="font-medium text-gray-900">{event.eventTitle}</div>
          <div className="text-xs text-gray-500">
            {formatDate(event.eventDate)}
          </div>
        </div>
      ),
    },
    {
      key: "programs",
      label: "Programs",
      render: (event) => (
        <span className="text-gray-600">
          {event.programs.map((program) => program.title).join(", ")}
        </span>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (event) => event.eventType,
    },
    ...countColumns<AttendanceEventAnalytics>(),
  ];

  const sortOptions: SortOption<AttendanceEventAnalytics>[] = [
    { value: "title", label: "Event", getValue: (event) => event.eventTitle },
    {
      value: "date",
      label: "Event Date",
      getValue: (event) => dateSortValue(event.eventDate),
    },
    { value: "type", label: "Type", getValue: (event) => event.eventType },
    {
      value: "registered",
      label: "Registered",
      getValue: (event) => event.registered,
    },
    {
      value: "attended",
      label: "Attended",
      getValue: (event) => event.attended,
    },
    { value: "absent", label: "Absent", getValue: (event) => event.absent },
    {
      value: "attendanceRate",
      label: "Attendance Rate",
      getValue: (event) => event.attendanceRate,
    },
  ];

  const filterConfigs: FilterConfig<AttendanceEventAnalytics>[] = [
    {
      id: "attendance",
      label: "Attendance",
      options: attendanceStatusOptions,
      predicate: matchesAttendanceStatus,
    },
    {
      id: "program",
      label: "Program",
      options: programOptions,
      predicate: (event, value) =>
        value === ALL_FILTER_VALUE ||
        event.programs.some((program) => program.title === value),
    },
    {
      id: "type",
      label: "Event Type",
      options: eventTypeOptions,
      predicate: (event, value) =>
        value === ALL_FILTER_VALUE || event.eventType === value,
    },
  ];

  return (
    <AttendanceDataTable
      title="Attendance By Event"
      rows={rows}
      columns={columns}
      getRowKey={(event) => event.eventId}
      searchPlaceholder="Search events, programs, dates, or event types"
      searchFields={(event) => [
        event.eventTitle,
        event.eventType,
        formatDate(event.eventDate),
        event.programs.map((program) => [
          program.title,
          program.programType,
        ]),
      ]}
      sortOptions={sortOptions}
      defaultSort="date"
      filterConfigs={filterConfigs}
      emptyMessage="No events match the current attendance filters."
    />
  );
}

export function AttendanceAnalyticsSection({
  analytics,
}: {
  analytics: AttendanceAnalytics;
}) {
  const [activeSubTab, setActiveSubTab] =
    useState<AttendanceSubTab>("person");
  const hasData = analytics.summary.registered > 0;

  if (!hasData) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Attendance Analytics
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          No completed-event attendance records are available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Registered"
          value={analytics.summary.registered}
          tone="blue"
          icon={ClipboardDocumentCheckIcon}
        />
        <SummaryCard
          label="Attended"
          value={analytics.summary.attended}
          tone="green"
          icon={CheckCircleIcon}
        />
        <SummaryCard
          label="Absent"
          value={analytics.summary.absent}
          tone="red"
          icon={XCircleIcon}
        />
        <SummaryCard
          label="Unrecorded"
          value={analytics.summary.unrecorded}
          tone="amber"
          icon={ClockIcon}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500">Recorded Attendance Rate</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatPercent(analytics.summary.attendanceRate)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500">Attendance Completion</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatPercent(analytics.summary.completionRate)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500">No-show Rate</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatPercent(analytics.summary.noShowRate)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <TabNav
          tabs={attendanceSubTabs}
          activeTab={activeSubTab}
          onTabChange={setActiveSubTab}
          ariaLabel="Attendance analysis sections"
        />

        <div className="p-6">
          {activeSubTab === "person" && (
            <PersonAttendanceTable rows={analytics.byPerson} />
          )}
          {activeSubTab === "program" && (
            <ProgramAttendanceTable rows={analytics.byProgram} />
          )}
          {activeSubTab === "event" && (
            <EventAttendanceTable rows={analytics.byEvent} />
          )}
        </div>
      </div>
    </div>
  );
}

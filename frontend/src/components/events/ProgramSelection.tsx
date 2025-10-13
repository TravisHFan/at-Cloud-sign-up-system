import { useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";

export interface Program {
  id: string;
  title: string;
  programType: string;
  period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  introduction?: string;
  flyerUrl?: string;
  isFree?: boolean;
}

interface ProgramSelectionProps {
  // All available programs
  programs: Program[];
  // Currently selected program IDs
  selectedProgramIds: string[];
  // Callback when selection changes
  onProgramsChange: (programIds: string[]) => void;
  // Optional: custom label
  programsLabel?: string;
  // Optional: custom button text
  buttonText?: string;
  // Loading state
  loading?: boolean;
}

export default function ProgramSelection({
  programs,
  selectedProgramIds,
  onProgramsChange,
  programsLabel = "Programs (Optional)",
  buttonText = "Select Programs",
  loading = false,
}: ProgramSelectionProps) {
  const [showProgramList, setShowProgramList] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Filter programs based on search query
  const filteredPrograms = useMemo(() => {
    if (!query.trim()) return programs;

    const searchLower = query.toLowerCase().trim();
    return programs.filter(
      (program) =>
        program.title.toLowerCase().includes(searchLower) ||
        program.programType.toLowerCase().includes(searchLower) ||
        (program.introduction &&
          program.introduction.toLowerCase().includes(searchLower))
    );
  }, [programs, query]);

  // Available programs (not yet selected)
  const availablePrograms = useMemo(() => {
    return filteredPrograms.filter(
      (program) => !selectedProgramIds.includes(program.id)
    );
  }, [filteredPrograms, selectedProgramIds]);

  // Selected programs (for display as chips)
  const selectedPrograms = useMemo(() => {
    return programs.filter((program) =>
      selectedProgramIds.includes(program.id)
    );
  }, [programs, selectedProgramIds]);

  // Focus the search input when opening
  useEffect(() => {
    if (showProgramList) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      // Reset search state when closing
      setQuery("");
    }
  }, [showProgramList]);

  const handleAddProgram = (programId: string) => {
    if (!selectedProgramIds.includes(programId)) {
      onProgramsChange([...selectedProgramIds, programId]);
    }
  };

  const handleRemoveProgram = (programId: string) => {
    onProgramsChange(selectedProgramIds.filter((id) => id !== programId));
  };

  // Format period for display
  const formatPeriod = (period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  }) => {
    if (!period) return "";

    const parts: string[] = [];
    if (period.startMonth && period.startYear) {
      parts.push(`${period.startMonth} ${period.startYear}`);
    } else if (period.startYear) {
      parts.push(period.startYear);
    }

    if (period.endMonth && period.endYear) {
      parts.push(`${period.endMonth} ${period.endYear}`);
    } else if (period.endYear) {
      parts.push(period.endYear);
    }

    return parts.length > 0 ? parts.join(" - ") : "";
  };

  // Program Chip Component
  const ProgramChip = ({ program }: { program: Program }) => (
    <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 text-sm truncate">
          {program.title}
        </div>
        <div className="text-xs text-gray-600">
          {program.programType}
          {formatPeriod(program.period) && (
            <span className="ml-2 text-gray-500">
              • {formatPeriod(program.period)}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => handleRemoveProgram(program.id)}
        className="p-1 text-blue-400 hover:text-red-500 transition-colors flex-shrink-0"
        title="Remove program"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700">
        {programsLabel}
      </label>

      {/* Selected Programs (Chips) */}
      {selectedPrograms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedPrograms.map((program) => (
            <ProgramChip key={program.id} program={program} />
          ))}
        </div>
      )}

      {/* Select Programs Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowProgramList(!showProgramList)}
          className="flex items-center space-x-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors w-full justify-center"
          disabled={loading}
        >
          <PlusIcon className="h-5 w-5" />
          <span>{loading ? "Loading programs..." : buttonText}</span>
        </button>

        {/* Program Selection Dropdown */}
        {showProgramList && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
            {/* Search input */}
            <div className="sticky top-0 bg-white p-3 border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search program title or type..."
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Search programs"
              />
            </div>

            {/* Results */}
            {loading ? (
              <div className="p-6 text-center text-gray-500">
                Loading programs...
              </div>
            ) : availablePrograms.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {query
                  ? "No programs match your search"
                  : selectedProgramIds.length === programs.length
                  ? "All programs have been selected"
                  : "No programs available"}
              </div>
            ) : (
              <div className="p-2">
                {availablePrograms.map((program) => (
                  <button
                    key={program.id}
                    type="button"
                    onClick={() => {
                      handleAddProgram(program.id);
                      setShowProgramList(false);
                    }}
                    className="w-full flex flex-col space-y-1 p-3 hover:bg-gray-50 rounded-md transition-colors text-left"
                  >
                    <div className="font-medium text-gray-900">
                      {program.title}
                    </div>
                    <div className="text-sm text-gray-600">
                      {program.programType}
                      {formatPeriod(program.period) && (
                        <span className="ml-2 text-gray-500">
                          • {formatPeriod(program.period)}
                        </span>
                      )}
                      {program.isFree !== undefined && (
                        <span className="ml-2 text-gray-500">
                          • {program.isFree ? "Free" : "Paid"}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close dropdown when clicking outside */}
      {showProgramList && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowProgramList(false)}
        />
      )}

      {/* Help text */}
      <p className="text-xs text-gray-500">
        Select programs to associate with this event. Programs help filter
        available event types.
      </p>
    </div>
  );
}

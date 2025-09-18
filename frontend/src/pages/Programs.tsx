import { PlusIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

interface Program {
  id: string;
  name: string;
  timeSpan: string;
  type: "EMBA Mentor Circles" | "Effective Communication Workshops";
}

const mockPrograms: Program[] = [
  {
    id: "1",
    name: "2025 EMBA Mentor Circles",
    timeSpan: "Jan 2025 - Dec 2025",
    type: "EMBA Mentor Circles",
  },
  {
    id: "2",
    name: "2025 Effective Communication Workshops",
    timeSpan: "Mar 2025 - Nov 2025",
    type: "Effective Communication Workshops",
  },
  {
    id: "3",
    name: "2026 EMBA Mentor Circles",
    timeSpan: "Jan 2026 - Dec 2026",
    type: "EMBA Mentor Circles",
  },
  {
    id: "4",
    name: "2026 Effective Communication Workshops",
    timeSpan: "Mar 2026 - Nov 2026",
    type: "Effective Communication Workshops",
  },
];

const getProgramTypeColors = (type: Program["type"]) => {
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

export default function Programs() {
  const navigate = useNavigate();

  const handleCreateProgram = () => {
    navigate("/dashboard/programs/new");
  };

  const handleProgramClick = (program: Program) => {
    // TODO: Navigate to program details page when implemented
    console.log("Program clicked:", program.name);
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

        {/* Programs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Program Cards */}
          {mockPrograms.map((program) => {
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

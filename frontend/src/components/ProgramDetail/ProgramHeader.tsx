import { useNavigate } from "react-router-dom";
import EditButton from "../common/EditButton";
import { Icon } from "../common";
import { PlusIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import type { ProgramType } from "../../constants/programTypes";

interface ProgramHeaderProps {
  programId: string;
  title: string;
  programType: ProgramType;
  period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  canEdit: boolean;
  canDelete: boolean;
  canCreateEvent: boolean;
  canEmail: boolean;
  onDelete: () => void;
  onEmailParticipants?: () => void;
}

/**
 * ProgramHeader Component
 *
 * Displays the program's header section including:
 * - Back navigation button
 * - Program title
 * - Action buttons (Edit, Delete, Create Event, Email Participants)
 * - Program details (type, period) with icons
 *
 * Extracted from ProgramDetail.tsx (Phase 6.5.1)
 */
export default function ProgramHeader({
  programId,
  title,
  programType,
  period,
  canEdit,
  canDelete,
  canCreateEvent,
  canEmail,
  onDelete,
  onEmailParticipants,
}: ProgramHeaderProps) {
  const navigate = useNavigate();

  const periodText = (p?: typeof period) => {
    if (!p) return "";
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
    const s = [normalize(p.startMonth), p.startYear].filter(Boolean).join(" ");
    const e = [normalize(p.endMonth), p.endYear].filter(Boolean).join(" ");
    return [s, e].filter(Boolean).join(" – ");
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Title Row */}
      <div className="flex items-center space-x-4 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-600 hover:text-gray-900"
        >
          <Icon name="arrow-left" className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center space-x-3 mb-4 flex-wrap gap-y-2">
        {canEdit && (
          <EditButton
            onClick={() => navigate(`/dashboard/programs/${programId}/edit`)}
          />
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Delete Program
          </button>
        )}
        {canCreateEvent && (
          <button
            onClick={() =>
              navigate(`/dashboard/event-config?programId=${programId}`)
            }
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Create New Event
          </button>
        )}
        {canEmail && onEmailParticipants && (
          <button
            onClick={onEmailParticipants}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <EnvelopeIcon className="h-4 w-4 mr-1.5" />
            Email Participants
          </button>
        )}
      </div>

      {/* Program Details with Icons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center text-gray-600">
          <Icon name="tag" className="w-5 h-5 mr-3" />
          <span>{programType}</span>
        </div>
        {period && (
          <div className="flex items-center text-gray-600">
            <Icon name="calendar" className="w-5 h-5 mr-3" />
            <span>{periodText(period)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

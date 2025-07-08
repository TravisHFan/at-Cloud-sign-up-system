import {
  ChevronDownIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import type { UserAction } from "../../types/management";

interface ActionDropdownProps {
  userId: number;
  actions: UserAction[];
  isOpen: boolean;
  onToggle: (userId: number) => void;
  showUpward?: boolean;
  isMobile?: boolean;
}

export default function ActionDropdown({
  userId,
  actions,
  isOpen,
  onToggle,
  showUpward = false,
  isMobile = false,
}: ActionDropdownProps) {
  return (
    <div className="relative dropdown-container">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(userId);
        }}
        className={`inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          isMobile ? "w-full justify-center" : ""
        }`}
      >
        <EllipsisVerticalIcon className="w-4 h-4 mr-1" />
        Actions
        <ChevronDownIcon className="w-4 h-4 ml-1" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 ${
            showUpward ? "bottom-full mb-2" : "top-full"
          } ${isMobile ? "left-0 right-0" : "right-0"}`}
        >
          <div className="py-1">
            {actions.length > 0 ? (
              actions.map((action, actionIndex) => (
                <button
                  key={actionIndex}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!action.disabled) {
                      action.onClick();
                    }
                  }}
                  disabled={action.disabled}
                  className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                    action.className
                  } ${
                    action.disabled ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  {action.label}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">
                No actions available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

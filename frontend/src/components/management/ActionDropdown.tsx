import {
  ChevronDownIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import type { UserAction } from "../../types/management";
import { useRef, useEffect, useState } from "react";

interface ActionDropdownProps {
  userId: string;
  actions: UserAction[];
  isOpen: boolean;
  onToggle: (userId: string) => void;
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: showUpward ? rect.top - 8 : rect.bottom + 8,
        left: isMobile ? rect.left : rect.right - 192, // 192px = w-48
      });
    }
  }, [isOpen, showUpward, isMobile]);

  return (
    <div className="relative dropdown-container">
      <button
        ref={buttonRef}
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
          className="fixed w-48 bg-white rounded-md shadow-lg border border-gray-200 z-[9999]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            transform: showUpward ? "translateY(-100%)" : "none",
          }}
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

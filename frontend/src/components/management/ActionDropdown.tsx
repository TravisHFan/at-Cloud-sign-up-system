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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Update dropdown position when it opens
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
    <div className="inline-block dropdown-container">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(userId);
        }}
        className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          isMobile ? "w-full justify-center" : ""
        } ${
          isOpen
            ? "text-blue-700 bg-blue-50 border border-blue-300"
            : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
        }`}
      >
        <EllipsisVerticalIcon className="w-4 h-4 mr-1" />
        Actions
        <ChevronDownIcon
          className={`w-4 h-4 ml-1 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed w-48 bg-white rounded-md shadow-lg border border-gray-200 z-[9999]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            transform: showUpward ? "translateY(-100%)" : "none",
            pointerEvents: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            {actions.length > 0 ? (
              actions.map((action) => (
                <button
                  key={`${userId}-${action.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!action.disabled) {
                      action.onClick();
                      // Close dropdown after action
                      onToggle(userId);
                    }
                  }}
                  disabled={action.disabled}
                  className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                    action.className
                  } ${
                    action.disabled
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-gray-100"
                  }`}
                  type="button"
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

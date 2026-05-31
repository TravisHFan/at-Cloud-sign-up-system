import type { ElementType, ReactNode } from "react";
import { cn } from "../../utils/uiUtils";

type TabIcon = ElementType<{ className?: string; "aria-hidden"?: boolean }>;

export type TabNavItem<T extends string> = {
  id: T;
  label: ReactNode;
  icon?: TabIcon;
};

type TabNavProps<T extends string> = {
  tabs: readonly TabNavItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  ariaLabel?: string;
  activeTextClassName?: string;
  fullWidth?: boolean;
  className?: string;
};

export default function TabNav<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = "Tabs",
  activeTextClassName = "text-blue-600",
  fullWidth = false,
  className,
}: TabNavProps<T>) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <nav
        className={cn(
          "flex w-full gap-0 border-b border-gray-200 px-4 pt-4",
          !fullWidth && "min-w-max"
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "inline-flex items-center justify-center gap-2 whitespace-nowrap px-6 py-3 text-base font-medium transition-all duration-200 focus:outline-none focus:ring-0 border-t border-x rounded-t-lg rounded-b-none",
                fullWidth && "flex-1",
                isActive
                  ? cn(
                      "bg-white border-gray-200 border-b-white -mb-px relative z-10",
                      activeTextClassName
                    )
                  : "bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200 border-gray-200"
              )}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden={true} />}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

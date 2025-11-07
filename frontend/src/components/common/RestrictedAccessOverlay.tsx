/**
 * RestrictedAccessOverlay Component
 *
 * A reusable overlay component that displays an access restriction message
 * when a user does not have sufficient permissions for a feature.
 *
 * Usage:
 * <RestrictedAccessOverlay
 *   show={!hasPermission}
 *   title="Feature requires elevated access"
 *   message="Contact your administrator for access."
 * />
 */

import React from "react";

interface RestrictedAccessOverlayProps {
  /**
   * Whether to show the overlay
   */
  show: boolean;

  /**
   * Title displayed in the overlay card
   * @default "Create Program access requires @Cloud Co‑worker authorization"
   */
  title?: string;

  /**
   * Message displayed in the overlay card
   * @default "To create new programs, you'll need elevated permissions. Please contact your @Cloud Leaders to request access."
   */
  message?: string;

  /**
   * Custom icon component. If not provided, uses default lock icon.
   */
  icon?: React.ReactNode;
}

/**
 * Default lock icon SVG
 */
const DefaultLockIcon: React.FC = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

/**
 * RestrictedAccessOverlay Component
 *
 * Renders a semi-transparent overlay with a centered message card
 * informing users they lack sufficient permissions.
 */
export const RestrictedAccessOverlay: React.FC<
  RestrictedAccessOverlayProps
> = ({
  show,
  title = "Create Program access requires @Cloud Co‑worker authorization",
  message = "To create new programs, you'll need elevated permissions. Please contact your @Cloud Leaders to request access.",
  icon,
}) => {
  if (!show) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center text-center p-6"
      role="alert"
      aria-live="polite"
    >
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-4 mx-auto">
          {icon || <DefaultLockIcon />}
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
};

export default RestrictedAccessOverlay;

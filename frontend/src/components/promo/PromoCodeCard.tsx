import { useState } from "react";
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import {
  formatMockExpiryText,
  getMockDaysUntilExpiry,
} from "../../mocks/promoCodes";

export interface PromoCodeCardProps {
  code: string;
  type: "bundle_discount" | "staff_access";
  discountAmount?: number; // For bundle: dollar amount (e.g., 50 for $50 off)
  discountPercent?: number; // For staff: 100 (100% off)
  expiresAt?: string; // ISO date string
  isUsed: boolean;
  usedForProgramTitle?: string;
  onCopy?: () => void;
  onUse?: () => void;
}

export default function PromoCodeCard({
  code,
  type,
  discountAmount,
  discountPercent,
  expiresAt,
  isUsed,
  usedForProgramTitle,
  onCopy,
  onUse,
}: PromoCodeCardProps) {
  const [copied, setCopied] = useState(false);

  // Determine if code is expired
  const daysUntilExpiry = getMockDaysUntilExpiry(expiresAt);
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0 && !isUsed;

  // Get status
  const getStatus = () => {
    if (isUsed) return "used";
    if (isExpired) return "expired";
    return "active";
  };

  const status = getStatus();

  // Get status badge
  const StatusBadge = () => {
    if (status === "active") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
          Active
        </span>
      );
    }
    if (status === "used") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
          Used
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
        Expired
      </span>
    );
  };

  // Get discount display
  const discountDisplay =
    type === "bundle_discount"
      ? `$${discountAmount} OFF`
      : `${discountPercent}% OFF`;

  // Get type display
  const typeDisplay =
    type === "bundle_discount" ? "Bundle Discount" : "Staff Access";

  // Get theme colors
  const getThemeColors = () => {
    if (type === "bundle_discount") {
      return {
        gradient: "from-blue-50 to-purple-50",
        border: status === "expired" ? "border-red-500" : "border-blue-500",
        text: "text-blue-700",
        icon: "🎁",
      };
    }
    return {
      gradient: "from-green-50 to-emerald-50",
      border: status === "expired" ? "border-red-500" : "border-green-500",
      text: "text-green-700",
      icon: "🎟️",
    };
  };

  const theme = getThemeColors();

  // Handle copy
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (onCopy) onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  return (
    <div
      className={`
        relative rounded-lg p-6 border-2 transition-all
        bg-gradient-to-br ${theme.gradient}
        ${theme.border}
        ${status === "used" ? "opacity-60" : ""}
        ${status === "expired" ? "opacity-75" : ""}
      `}
    >
      {/* Header: Code and Status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div
            className={`
              font-mono text-2xl font-bold tracking-wider uppercase
              ${
                status === "expired"
                  ? "line-through text-gray-500"
                  : "text-gray-900"
              }
            `}
          >
            {code}
          </div>
        </div>
        <StatusBadge />
      </div>

      {/* Discount Amount */}
      <div className="mb-2">
        <div className="text-3xl font-extrabold text-gray-900">
          {discountDisplay}
        </div>
      </div>

      {/* Type */}
      <div className={`text-sm font-medium mb-4 ${theme.text}`}>
        <span className="mr-1">{theme.icon}</span>
        {typeDisplay}
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4">
        {/* Expiry */}
        {expiresAt && (
          <div className="flex items-center text-sm text-gray-600">
            <ClockIcon className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{formatMockExpiryText(expiresAt)}</span>
          </div>
        )}

        {/* No expiry */}
        {!expiresAt && (
          <div className="flex items-center text-sm text-gray-600">
            <ClockIcon className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>No expiration</span>
          </div>
        )}

        {/* Valid for any program (bundle) or all programs (staff) */}
        {status === "active" && (
          <div className="flex items-start text-sm text-gray-600">
            <CheckCircleIcon className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
            <span>
              {type === "bundle_discount"
                ? "Valid for any program"
                : "Valid for all paid programs"}
            </span>
          </div>
        )}

        {/* Used on program */}
        {status === "used" && usedForProgramTitle && (
          <div className="flex items-start text-sm text-gray-600">
            <XCircleIcon className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
            <span>Used on: {usedForProgramTitle}</span>
          </div>
        )}

        {/* Expired message */}
        {status === "expired" && (
          <div className="flex items-start text-sm text-red-600">
            <XCircleIcon className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
            <span>This code has expired</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          disabled={status === "expired"}
          className={`
            flex-1 px-4 py-2 text-sm font-medium rounded-md
            transition-colors
            ${
              status === "expired"
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }
          `}
        >
          {copied ? (
            <span className="flex items-center justify-center">
              <CheckCircleIcon className="h-4 w-4 mr-1.5 text-green-600" />
              Copied!
            </span>
          ) : (
            "Copy Code"
          )}
        </button>

        {/* Use Now Button */}
        {status === "active" && onUse && (
          <button
            onClick={onUse}
            className={`
              flex-1 px-4 py-2 text-sm font-medium rounded-md
              transition-colors
              ${
                type === "bundle_discount"
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              }
            `}
          >
            Use Now →
          </button>
        )}
      </div>
    </div>
  );
}

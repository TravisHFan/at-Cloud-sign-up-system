import { Badge, LoadingSpinner, EmptyState } from "../../ui";
import {
  ClipboardDocumentIcon,
  XMarkIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";

// Type definition for PromoCodeResponse (should match AdminPromoCodes.tsx)
export interface PromoCodeResponse {
  _id: string;
  code: string;
  type: "bundle_discount" | "staff_access" | "reward";
  discountAmount?: number;
  discountPercent?: number;
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  description?: string;
  allowedProgramIds?: string[];
  isActive: boolean;
  isUsed: boolean;
  expiresAt?: string;
  usedAt?: string;
  usedForProgramId?: string;
  usedForProgramTitle?: string;
  createdAt: string;
  createdBy: string;
  isGeneral?: boolean;
  usageLimit?: number;
}

export interface PromoCodeListProps {
  codes: PromoCodeResponse[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onCopyCode: (code: string) => void;
  onDeactivate: (id: string, code: string) => void;
  onReactivate: (id: string, code: string) => void;
  onDelete: (id: string, code: string) => void;
  copiedCode: string | null;
  searchQuery?: string;
  typeFilter?: string;
  statusFilter?: string;
}

// Helper Functions

function getStatusBadge(promoCode: PromoCodeResponse) {
  const now = new Date();
  const isExpired = promoCode.expiresAt && new Date(promoCode.expiresAt) < now;

  if (promoCode.isUsed) {
    return <Badge variant="success">Used</Badge>;
  } else if (isExpired) {
    return <Badge variant="error">Expired</Badge>;
  } else if (promoCode.isActive) {
    return <Badge variant="info">Active</Badge>;
  } else {
    return <Badge variant="neutral">Inactive</Badge>;
  }
}

function getTypeBadge(promoCode: PromoCodeResponse) {
  if (promoCode.type === "bundle_discount") {
    return <Badge variant="purple">Bundle</Badge>;
  } else if (promoCode.type === "staff_access") {
    // Distinguish between general and personal staff codes
    if (promoCode.isGeneral) {
      return <Badge variant="success">General Staff</Badge>;
    } else {
      return <Badge variant="info">Personal Staff</Badge>;
    }
  } else if (promoCode.type === "reward") {
    return <Badge variant="warning">Reward</Badge>;
  }
  return <Badge variant="neutral">Unknown</Badge>;
}

function formatDiscount(promoCode: PromoCodeResponse) {
  if (promoCode.discountPercent) {
    return `${promoCode.discountPercent}% off`;
  } else if (promoCode.discountAmount) {
    return `$${(promoCode.discountAmount / 100).toFixed(0)} off`;
  }
  return "—";
}

function formatExpiry(expiresAt?: string) {
  if (!expiresAt) return "Never";
  const date = new Date(expiresAt);
  const now = new Date();

  if (date < now) {
    return (
      <span className="text-red-600">
        Expired {formatDistanceToNow(date)} ago
      </span>
    );
  }
  return <span className="text-gray-600">in {formatDistanceToNow(date)}</span>;
}

export default function PromoCodeList({
  codes,
  loading,
  error,
  currentPage,
  totalPages,
  onPageChange,
  onCopyCode,
  onDeactivate,
  onReactivate,
  onDelete,
  copiedCode,
  searchQuery,
  typeFilter,
  statusFilter,
}: PromoCodeListProps) {
  const navigate = useNavigate();
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // Loading State
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  // Empty State
  if (codes.length === 0) {
    const hasActiveFilters =
      searchQuery ||
      (typeFilter && typeFilter !== "all") ||
      (statusFilter && statusFilter !== "all");

    return (
      <EmptyState
        icon="🎫"
        title="No promo codes found"
        message={
          hasActiveFilters
            ? "Try adjusting your filters"
            : "No promo codes have been created yet"
        }
      />
    );
  }

  // Table with Data
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Discount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {codes.map((code) => (
              <tr
                key={code._id}
                onClick={
                  code.type === "staff_access" && code.isGeneral
                    ? () => navigate(`/dashboard/admin/promo-codes/${code._id}`)
                    : undefined
                }
                className={
                  code.type === "staff_access" && code.isGeneral
                    ? "hover:bg-gray-50 cursor-pointer transition-colors"
                    : ""
                }
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-mono text-sm font-medium text-gray-900">
                    {code.code}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getTypeBadge(code)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {code.ownerName || code.ownerEmail || code.ownerId}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {formatDiscount(code)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(code)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {formatExpiry(code.expiresAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end">
                    <button
                      ref={(el) => {
                        buttonRefs.current[code._id] = el;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openDropdownId === code._id) {
                          setOpenDropdownId(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDropdownPosition({
                            top: rect.bottom + window.scrollY + 4,
                            right:
                              window.innerWidth - rect.right + window.scrollX,
                          });
                          setOpenDropdownId(code._id);
                        }
                      }}
                      className="inline-flex items-center px-3 py-1 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      title="Actions"
                    >
                      <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>

                    {/* Dropdown Menu */}
                    {openDropdownId === code._id && (
                      <>
                        {/* Backdrop to close dropdown */}
                        <div
                          className="fixed inset-0 z-30"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(null);
                          }}
                        />

                        {/* Dropdown Content */}
                        <div
                          className="fixed w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-40"
                          style={{
                            top: `${dropdownPosition.top}px`,
                            right: `${dropdownPosition.right}px`,
                          }}
                        >
                          {/* Copy */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyCode(code.code);
                              setOpenDropdownId(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            {copiedCode === code.code ? (
                              <>
                                <CheckIconSolid className="w-4 h-4 text-green-600" />
                                <span className="text-green-600">Copied!</span>
                              </>
                            ) : (
                              <>
                                <ClipboardDocumentIcon className="w-4 h-4" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>

                          {/* Deactivate/Reactivate */}
                          {!code.isUsed && (
                            <>
                              {code.isActive ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeactivate(code._id, code.code);
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <XMarkIcon className="w-4 h-4" />
                                  <span>Deactivate</span>
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onReactivate(code._id, code.code);
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 transition-colors"
                                >
                                  <CheckIcon className="w-4 h-4" />
                                  <span>Reactivate</span>
                                </button>
                              )}
                            </>
                          )}

                          {/* Delete */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(code._id, code.code);
                              setOpenDropdownId(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
                          >
                            <TrashIcon className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() =>
                onPageChange(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

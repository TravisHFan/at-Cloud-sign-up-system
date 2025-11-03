import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  PlusIcon,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import { apiClient } from "../../../services/api";
import Button from "../../ui/Button";
import LoadingSpinner from "../../common/LoadingSpinner";
import UserSelectionModal from "../UserSelectionModal";

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SelectedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  roleInAtCloud?: string;
  avatar: string | null;
}

interface ProgramDTO {
  id: string;
  _id?: string;
  title: string;
}

interface PromoCodeResponse {
  _id: string;
  code: string;
  type: "staff_access" | "bundle_discount";
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  description?: string;
  discountPercent: number;
  allowedProgramIds?: string[];
  usedBy?: string[];
  expiresAt?: string;
  isGeneral?: boolean;
  isActive: boolean;
  createdAt: string;
}

interface StaffCodeCreatorProps {
  onSuccess?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export default function StaffCodeCreator({ onSuccess }: StaffCodeCreatorProps) {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdCode, setCreatedCode] = useState<PromoCodeResponse | null>(
    null
  );

  // Code type selection
  const [codeType, setCodeType] = useState<"personal" | "general" | null>(null);

  // Personal code states
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

  // General code states
  const [codeDescription, setCodeDescription] = useState("");

  // Shared states
  const [programMode, setProgramMode] = useState<"all" | "specific">("all");
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [programs, setPrograms] = useState<ProgramDTO[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  const [expirationMode, setExpirationMode] = useState<"never" | "custom">(
    "never"
  );
  const [expirationDate, setExpirationDate] = useState("");

  const [copiedCode, setCopiedCode] = useState(false);

  // Load programs on mount
  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      setLoadingPrograms(true);
      const response = await apiClient.listPrograms();
      setPrograms(response as ProgramDTO[]);
    } catch (err) {
      console.error("Failed to load programs:", err);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const handleUserSelect = (user: SelectedUser) => {
    setSelectedUser(user);
    setShowUserModal(false);
  };

  const clearUserSelection = () => {
    setSelectedUser(null);
  };

  const toggleProgram = (programId: string) => {
    setSelectedPrograms((prev) =>
      prev.includes(programId)
        ? prev.filter((id) => id !== programId)
        : [...prev, programId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for personal codes
    if (codeType === "personal") {
      if (!selectedUser) {
        setError("Please select a user");
        return;
      }

      if (programMode === "specific" && selectedPrograms.length === 0) {
        setError("Please select at least one program");
        return;
      }
    }

    // Validation for general codes
    if (codeType === "general") {
      if (!codeDescription.trim()) {
        setError("Please enter a code description");
        return;
      }
    }

    if (expirationMode === "custom" && !expirationDate) {
      setError("Please select an expiration date");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (codeType === "personal") {
        // Create personal staff code
        const payload: {
          userId: string;
          discountPercent: number;
          allowedProgramIds?: string[];
          expiresAt?: string;
        } = {
          userId: selectedUser!.id,
          discountPercent: 100, // Staff codes are always 100% discount
        };

        if (programMode === "specific") {
          payload.allowedProgramIds = selectedPrograms;
        }

        if (expirationMode === "custom") {
          payload.expiresAt = new Date(expirationDate).toISOString();
        }

        const response = await apiClient.createStaffPromoCode(payload);
        setCreatedCode(response.code);
        setSuccess(true);

        // Reset form
        clearUserSelection();
        setShowUserModal(false);
        setProgramMode("all");
        setSelectedPrograms([]);
        setExpirationMode("never");
        setExpirationDate("");
      } else if (codeType === "general") {
        // Create general staff code
        const payload: {
          description: string;
          discountPercent: number;
          expiresAt?: string;
          isGeneral: boolean;
        } = {
          description: codeDescription,
          discountPercent: 100,
          isGeneral: true,
        };

        if (expirationMode === "custom") {
          payload.expiresAt = new Date(expirationDate).toISOString();
        }

        const response = await apiClient.createGeneralStaffPromoCode(payload);
        setCreatedCode(response.code);
        setSuccess(true);

        // Reset form
        setCodeDescription("");
        setExpirationMode("never");
        setExpirationDate("");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to create staff promo code";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!createdCode) return;

    try {
      await navigator.clipboard.writeText(createdCode.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const closeSuccessModal = () => {
    setSuccess(false);
    setCreatedCode(null);
    setCopiedCode(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Create Staff Access Code
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Generate a 100% discount code for staff, volunteers, or special guests
        </p>
      </div>

      {/* Code Type Selection */}
      {!codeType ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-4">
              What kind of staff code do you want to create?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personal Staff Code Option */}
              <button
                type="button"
                onClick={() => setCodeType("personal")}
                className="group p-6 border-2 border-gray-300 hover:border-purple-500 rounded-lg bg-white hover:bg-purple-50 transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 group-hover:bg-purple-200 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Create Personal Staff Code
                    </h4>
                    <p className="text-sm text-gray-600">
                      Generate a code for a specific user with customizable
                      program access and expiration
                    </p>
                  </div>
                </div>
              </button>

              {/* General Staff Code Option */}
              <button
                type="button"
                onClick={() => setCodeType("general")}
                className="group p-6 border-2 border-gray-300 hover:border-blue-500 rounded-lg bg-white hover:bg-blue-50 transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Create General Staff Code
                    </h4>
                    <p className="text-sm text-gray-600">
                      Generate a reusable code for all programs, unlimited uses,
                      manual distribution
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : codeType === "personal" ? (
        /* Personal Staff Code Form */
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setCodeType(null)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to selection
          </button>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Selection */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                Select User <span className="text-red-500">*</span>
              </label>

              {!selectedUser ? (
                <button
                  type="button"
                  onClick={() => setShowUserModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 hover:bg-purple-100 border-2 border-dashed border-purple-300 hover:border-purple-400 rounded-lg transition-colors text-purple-700 font-medium"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Select User</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            selectedUser.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              selectedUser.firstName +
                                " " +
                                selectedUser.lastName
                            )}&background=9333ea&color=fff`
                          }
                          alt={`${selectedUser.firstName} ${selectedUser.lastName}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div>
                          <div className="font-medium text-gray-900">
                            {selectedUser.firstName} {selectedUser.lastName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {selectedUser.email}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {selectedUser.role}
                            {selectedUser.roleInAtCloud && (
                              <span> • {selectedUser.roleInAtCloud}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearUserSelection}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 border border-red-300 rounded-lg transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Selection Modal */}
            <UserSelectionModal
              isOpen={showUserModal}
              onClose={() => setShowUserModal(false)}
              onSelect={handleUserSelect}
              title="Select User for Staff Code"
              description="Choose a user who will receive the 100% discount staff access code"
            />

            {/* Program Selection */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                Program Access
              </label>
              <div className="space-y-3">
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={programMode === "all"}
                      onChange={() => setProgramMode("all")}
                      className="mr-2"
                    />
                    <span className="text-base text-gray-700">
                      All programs
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={programMode === "specific"}
                      onChange={() => setProgramMode("specific")}
                      className="mr-2"
                    />
                    <span className="text-base text-gray-700">
                      Specific programs
                    </span>
                  </label>
                </div>

                {programMode === "specific" && (
                  <div className="border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {loadingPrograms ? (
                      <div className="flex justify-center py-4">
                        <LoadingSpinner size="sm" />
                      </div>
                    ) : programs.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No programs available
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {programs.map((program) => (
                          <label
                            key={program._id || program.id}
                            className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPrograms.includes(
                                program._id || program.id
                              )}
                              onChange={() =>
                                toggleProgram(program._id || program.id)
                              }
                              className="mr-3"
                            />
                            <span className="text-sm text-gray-900">
                              {program.title}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Expiration Date */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                Expiration
              </label>
              <div className="space-y-3">
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={expirationMode === "never"}
                      onChange={() => setExpirationMode("never")}
                      className="mr-2"
                    />
                    <span className="text-base text-gray-700">
                      Never expires
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={expirationMode === "custom"}
                      onChange={() => setExpirationMode("custom")}
                      className="mr-2"
                    />
                    <span className="text-base text-gray-700">Custom date</span>
                  </label>
                </div>

                {expirationMode === "custom" && (
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Creating Code...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <PlusIcon className="w-5 h-5" />
                    Create Staff Code
                  </span>
                )}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        /* General Staff Code Form */
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setCodeType(null)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to selection
          </button>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Code Name/Description */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                Code Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={codeDescription}
                onChange={(e) => setCodeDescription(e.target.value)}
                placeholder="e.g., Staff Access 2025"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Internal description to help identify this code
              </p>
            </div>

            {/* Expiration Date */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                Expiration
              </label>
              <div className="space-y-3">
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={expirationMode === "never"}
                      onChange={() => setExpirationMode("never")}
                      className="mr-2"
                    />
                    <span className="text-base text-gray-700">
                      Never expires
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={expirationMode === "custom"}
                      onChange={() => setExpirationMode("custom")}
                      className="mr-2"
                    />
                    <span className="text-base text-gray-700">Custom date</span>
                  </label>
                </div>

                {expirationMode === "custom" && (
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">General Staff Code</p>
                  <ul className="space-y-1 text-blue-700">
                    <li>• 100% discount on all programs</li>
                    <li>• Can be used by any user</li>
                    <li>• Unlimited number of uses</li>
                    <li>• Must be manually shared with users</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Creating Code...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <PlusIcon className="w-5 h-5" />
                    Create General Staff Code
                  </span>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Success Modal */}
      {success &&
        createdCode &&
        createPortal(
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <CheckCircleIcon className="w-16 h-16 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Staff Code Created!
                </h3>
                <p className="text-gray-600 mb-6">
                  The promo code has been generated successfully.
                </p>

                {/* Code Display */}
                <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mb-6">
                  <div className="text-sm text-gray-500 mb-1">Promo Code</div>
                  <div className="font-mono text-3xl font-bold text-purple-600 mb-3">
                    {createdCode.code}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {copiedCode ? (
                      <>
                        <CheckIcon className="w-5 h-5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <ClipboardDocumentIcon className="w-5 h-5" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>

                {/* Code Details */}
                <div className="text-left bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="text-sm space-y-2">
                    {createdCode.isGeneral ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium text-gray-900">
                            General Staff Code
                          </span>
                        </div>
                        {createdCode.description && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Description:</span>
                            <span className="font-medium text-gray-900">
                              {createdCode.description}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Owner:</span>
                        <span className="font-medium text-gray-900">
                          {createdCode.ownerName ||
                            createdCode.ownerEmail ||
                            "N/A"}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Discount:</span>
                      <span className="font-medium text-gray-900">
                        100% off
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Programs:</span>
                      <span className="font-medium text-gray-900">
                        {createdCode.allowedProgramIds?.length
                          ? `${createdCode.allowedProgramIds.length} program(s)`
                          : "All programs"}
                      </span>
                    </div>
                    {createdCode.isGeneral && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Usage:</span>
                        <span className="font-medium text-gray-900">
                          Unlimited
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expires:</span>
                      <span className="font-medium text-gray-900">
                        {createdCode.expiresAt
                          ? new Date(createdCode.expiresAt).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notification Confirmation - Only for personal codes */}
                {!createdCode.isGeneral && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 text-lg">✓</span>
                      <div className="flex-1 text-sm text-green-800">
                        <p className="font-medium">
                          {createdCode.ownerName || createdCode.ownerEmail} has
                          been notified
                        </p>
                        <p className="mt-1 text-green-700">
                          An email and system notification with the promo code
                          has been sent.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual Distribution Warning - Only for general codes */}
                {createdCode.isGeneral && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                    <div className="flex items-start gap-2 text-left">
                      <svg
                        className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1 text-sm text-yellow-800 text-left">
                        <p className="font-medium text-left">
                          Manual Distribution Required
                        </p>
                        <p className="mt-1 text-yellow-700 text-left">
                          This general staff code must be manually shared with
                          users. Copy and send via your preferred communication
                          method.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      closeSuccessModal();
                      setCodeType(null); // Reset to selection screen
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Create Another
                  </button>
                  <button
                    onClick={closeSuccessModal}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

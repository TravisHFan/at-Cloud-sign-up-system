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

interface EventDTO {
  id: string;
  _id?: string;
  title: string;
  date: string;
  pricing?: {
    isFree: boolean;
    price?: number;
  };
}

interface PromoCodeResponse {
  _id: string;
  code: string;
  type: "reward";
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  discountPercent: number;
  allowedProgramIds?: string[];
  usedBy?: string[];
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

interface RewardCodeCreatorProps {
  onSuccess?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export default function RewardCodeCreator({
  onSuccess,
}: RewardCodeCreatorProps) {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdCode, setCreatedCode] = useState<PromoCodeResponse | null>(
    null
  );

  // User selection
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

  // Discount percentage (10-100%)
  const [discountPercent, setDiscountPercent] = useState(50);

  // Access selection
  const [accessMode, setAccessMode] = useState<
    "all" | "specificPrograms" | "specificEvents"
  >("all");
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [programs, setPrograms] = useState<ProgramDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Expiration
  const [expirationMode, setExpirationMode] = useState<"never" | "custom">(
    "never"
  );
  const [expirationDate, setExpirationDate] = useState("");

  const [copiedCode, setCopiedCode] = useState(false);

  // Load programs and events on mount
  useEffect(() => {
    loadPrograms();
    loadEvents();
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

  const loadEvents = async () => {
    try {
      setLoadingEvents(true);
      const { eventsService } = await import(
        "../../../services/api/events.api"
      );
      const response = await eventsService.getEvents({});

      // Filter out past events and free events
      const now = new Date();
      const filteredEvents = (response.events as EventDTO[]).filter((event) => {
        // Filter out past events
        const eventDate = new Date(event.date);
        if (eventDate < now) return false;

        // Filter out free events
        if (event.pricing?.isFree === true || !event.pricing?.price)
          return false;

        return true;
      });

      setEvents(filteredEvents);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoadingEvents(false);
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

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!selectedUser) {
      setError("Please select a user");
      return;
    }

    if (discountPercent < 10 || discountPercent > 100) {
      setError("Discount percentage must be between 10% and 100%");
      return;
    }

    if (accessMode === "specificPrograms" && selectedPrograms.length === 0) {
      setError("Please select at least one program");
      return;
    }

    if (accessMode === "specificEvents" && selectedEvents.length === 0) {
      setError("Please select at least one event");
      return;
    }

    if (expirationMode === "custom" && !expirationDate) {
      setError("Please select an expiration date");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: {
        userId: string;
        discountPercent: number;
        applicableToType?: "program" | "event";
        allowedProgramIds?: string[];
        allowedEventIds?: string[];
        expiresAt?: string;
      } = {
        userId: selectedUser.id,
        discountPercent,
      };

      if (accessMode === "specificPrograms") {
        payload.applicableToType = "program";
        payload.allowedProgramIds = selectedPrograms;
      } else if (accessMode === "specificEvents") {
        payload.applicableToType = "event";
        payload.allowedEventIds = selectedEvents;
      }
      // If accessMode === "all", don't set applicableToType (general code)

      if (expirationMode === "custom") {
        payload.expiresAt = new Date(expirationDate).toISOString();
      }

      const response = await apiClient.createRewardPromoCode(payload);
      setCreatedCode(response.promoCode);
      setSuccess(true);
    } catch (err: unknown) {
      console.error("Failed to create reward code:", err);
      const error = err as { response?: { data?: { error?: string } } };
      setError(
        error.response?.data?.error ||
          "Failed to create reward code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const closeSuccessModal = () => {
    setSuccess(false);
    setCreatedCode(null);
    setError(null);
    setCopiedCode(false);

    // Reset form
    clearUserSelection();
    setDiscountPercent(50);
    setAccessMode("all");
    setSelectedPrograms([]);
    setSelectedEvents([]);
    setExpirationMode("never");
    setExpirationDate("");

    if (onSuccess) {
      onSuccess();
    }
  };

  // Form view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Create Reward Code
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Generate a variable discount code (10-100%) for rewards, incentives,
          or special offers
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Selection */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            Select User <span className="text-red-500">*</span>
          </label>
          {selectedUser ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      selectedUser.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        selectedUser.firstName + " " + selectedUser.lastName
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
          ) : (
            <button
              type="button"
              onClick={() => setShowUserModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 hover:bg-purple-100 border-2 border-dashed border-purple-300 hover:border-purple-400 rounded-lg transition-colors text-purple-700 font-medium"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Select User</span>
            </button>
          )}
        </div>

        {/* Discount Percentage Slider */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            Discount Percentage <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-purple-600">
                {discountPercent}%
              </span>
              <span className="text-sm text-gray-500">
                User will pay {100 - discountPercent}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, rgb(147, 51, 234) 0%, rgb(147, 51, 234) ${
                  ((discountPercent - 10) / 90) * 100
                }%, rgb(229, 231, 235) ${
                  ((discountPercent - 10) / 90) * 100
                }%, rgb(229, 231, 235) 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>10% (Minimum)</span>
              <span>100% (Maximum)</span>
            </div>
          </div>
        </div>

        {/* Access Scope Selection */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            Access Scope
          </label>
          <div className="space-y-3">
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="accessMode"
                  checked={accessMode === "all"}
                  onChange={() => setAccessMode("all")}
                  className="mr-2"
                />
                <span className="text-base text-gray-700">
                  All Programs and Events
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="accessMode"
                  checked={accessMode === "specificPrograms"}
                  onChange={() => setAccessMode("specificPrograms")}
                  className="mr-2"
                />
                <span className="text-base text-gray-700">
                  Specific programs
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="accessMode"
                  checked={accessMode === "specificEvents"}
                  onChange={() => setAccessMode("specificEvents")}
                  className="mr-2"
                />
                <span className="text-base text-gray-700">Specific events</span>
              </label>
            </div>

            {accessMode === "specificPrograms" && (
              <div className="border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                {loadingPrograms ? (
                  <div className="flex justify-center py-4">
                    <LoadingSpinner size="sm" inline />
                  </div>
                ) : programs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No programs available
                  </p>
                ) : (
                  <div className="space-y-2">
                    {programs.map((program) => (
                      <label
                        key={program.id || program._id}
                        className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPrograms.includes(
                            program.id || program._id || ""
                          )}
                          onChange={() =>
                            toggleProgram(program.id || program._id || "")
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

            {accessMode === "specificEvents" && (
              <div className="border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                {loadingEvents ? (
                  <div className="flex justify-center py-4">
                    <LoadingSpinner size="sm" inline />
                  </div>
                ) : events.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No events available
                  </p>
                ) : (
                  <div className="space-y-2">
                    {events.map((event) => (
                      <label
                        key={event.id || event._id}
                        className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(
                            event.id || event._id || ""
                          )}
                          onChange={() =>
                            toggleEvent(event.id || event._id || "")
                          }
                          className="mr-3"
                        />
                        <span className="text-sm text-gray-900">
                          {event.title}
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
                  name="expirationMode"
                  checked={expirationMode === "never"}
                  onChange={() => setExpirationMode("never")}
                  className="mr-2"
                />
                <span className="text-base text-gray-700">Never expires</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="expirationMode"
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
                <LoadingSpinner size="sm" inline />
                Creating Code...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <PlusIcon className="w-5 h-5" />
                Create Reward Code
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* User Selection Modal */}
      <UserSelectionModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSelect={handleUserSelect}
        title="Select User for Reward Code"
        description="Choose a user who will receive the reward discount code"
      />

      {/* Success Modal */}
      {success && createdCode && (
        <>
          {createPortal(
            <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <CheckCircleIcon className="w-16 h-16 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Reward Code Created!
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
                      onClick={copyCodeToClipboard}
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
                      <div className="flex justify-between">
                        <span className="text-gray-600">Owner:</span>
                        <span className="font-medium text-gray-900">
                          {createdCode.ownerName ||
                            createdCode.ownerEmail ||
                            "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Discount:</span>
                        <span className="font-medium text-gray-900">
                          {createdCode.discountPercent}% off
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Access:</span>
                        <span className="font-medium text-gray-900">
                          {createdCode.allowedProgramIds?.length
                            ? `${createdCode.allowedProgramIds.length} program(s)`
                            : createdCode.allowedEventIds?.length
                            ? `${createdCode.allowedEventIds.length} event(s)`
                            : "All programs and events"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Expires:</span>
                        <span className="font-medium text-gray-900">
                          {createdCode.expiresAt
                            ? new Date(
                                createdCode.expiresAt
                              ).toLocaleDateString()
                            : "Never"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Notification Confirmation */}
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

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={closeSuccessModal}
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
        </>
      )}
    </div>
  );
}

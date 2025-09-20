import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function RecurringEventConfig() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const programIdFromUrl = searchParams.get("programId");
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState("");
  const [occurrenceCount, setOccurrenceCount] = useState("");

  const handleNext = () => {
    // Navigate to CreateEvent page with recurring configuration and optional programId
    const url = programIdFromUrl
      ? `/dashboard/new-event?programId=${programIdFromUrl}`
      : "/dashboard/new-event";

    navigate(url, {
      state: {
        isRecurring,
        frequency: isRecurring ? frequency : null,
        occurrenceCount: isRecurring ? parseInt(occurrenceCount) : null,
      },
    });
  };

  const isFormValid = !isRecurring || (frequency && occurrenceCount);

  const shouldShowRestrictedOverlay =
    currentUser?.role === "Participant" || currentUser?.role === "Guest Expert";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div
        className={`relative rounded-lg shadow-sm border p-6 ${
          shouldShowRestrictedOverlay ? "bg-gray-50" : "bg-white"
        }`}
      >
        {shouldShowRestrictedOverlay && (
          <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center text-center p-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-4 mx-auto">
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
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Create Event access requires @Cloud Co‑worker authorization
              </h2>
              <p className="text-sm text-gray-600">
                To create new events, you'll need elevated permissions. Please
                contact your @Cloud Leaders to request access.
              </p>
            </div>
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Event Configuration
        </h1>
        <p className="text-gray-600 mb-8">
          Let's start by configuring the basic event setup.
        </p>

        <div className="space-y-8">
          {/* Question 1: Is this a recurring event? */}
          <div>
            <label className="block text-lg font-medium text-gray-900 mb-4">
              Is this a recurring event?
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="isRecurring"
                  value="no"
                  checked={!isRecurring}
                  onChange={() => {
                    setIsRecurring(false);
                    setFrequency("");
                    setOccurrenceCount("");
                  }}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-3 text-gray-700">No</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="isRecurring"
                  value="yes"
                  checked={isRecurring}
                  onChange={() => setIsRecurring(true)}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-3 text-gray-700">Yes</span>
              </label>
            </div>
          </div>

          {/* Question 2: How often does it occur? */}
          <div>
            <label className="block text-lg font-medium text-gray-900 mb-4">
              How often does it occur?
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              disabled={!isRecurring || shouldShowRestrictedOverlay}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !isRecurring || shouldShowRestrictedOverlay
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "border-gray-300"
              }`}
            >
              <option value="" disabled className="text-gray-400">
                Select frequency
              </option>
              <option value="every-two-weeks" disabled={!isRecurring}>
                Every Two Weeks
              </option>
              <option value="monthly" disabled={!isRecurring}>
                Monthly
              </option>
              <option value="every-two-months" disabled={!isRecurring}>
                Every Two Months
              </option>
            </select>
          </div>

          {/* Question 3: How many times should this event recur? */}
          <div>
            <label className="block text-lg font-medium text-gray-900 mb-4">
              How many times should this event recur, including the first
              occurrence?
            </label>
            <select
              value={occurrenceCount}
              onChange={(e) => setOccurrenceCount(e.target.value)}
              disabled={!isRecurring || shouldShowRestrictedOverlay}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !isRecurring || shouldShowRestrictedOverlay
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "border-gray-300"
              }`}
            >
              <option value="" disabled className="text-gray-400">
                Select count
              </option>
              {Array.from({ length: 23 }, (_, i) => i + 2).map((num) => (
                <option key={num} value={num} disabled={!isRecurring}>
                  {num}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Next Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={shouldShowRestrictedOverlay ? undefined : handleNext}
            disabled={!isFormValid || shouldShowRestrictedOverlay}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              isFormValid && !shouldShowRestrictedOverlay
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { donationsService, donationHelpers } from "../../services/api";
import type { DonationFrequency } from "../../services/api/donations.api";
import LoadingSpinner from "../common/LoadingSpinner";
import { getTodayDateString } from "../../utils/eventStatsUtils";

interface GiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GiveModal({ isOpen, onClose }: GiveModalProps) {
  // Form state
  const [amount, setAmount] = useState("");
  const [donationType, setDonationType] = useState<"one-time" | "recurring">(
    "one-time"
  );
  const [startDate, setStartDate] = useState("");
  const [frequency, setFrequency] = useState<DonationFrequency>("monthly");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endType, setEndType] = useState<"date" | "occurrences">("date");
  const [endDate, setEndDate] = useState("");
  const [occurrences, setOccurrences] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default start date to today on mount
  useEffect(() => {
    if (isOpen) {
      const today = getTodayDateString();
      setStartDate(today);
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAmount("");
      setDonationType("one-time");
      setFrequency("monthly");
      setHasEndDate(false);
      setEndType("date");
      setEndDate("");
      setOccurrences("");
      setError(null);
    }
  }, [isOpen]);

  const validateAmount = (value: string): boolean => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 1 || num > 999999) {
      setError("Please enter an amount between $1 and $999,999");
      return false;
    }
    return true;
  };

  const validateEndDate = (value: string): boolean => {
    if (!hasEndDate) return true;
    if (endType === "date" && !value) {
      setError("Please select an end date");
      return false;
    }
    if (endType === "date") {
      const start = new Date(startDate);
      const end = new Date(value);
      if (end <= start) {
        setError("End date must be after start date");
        return false;
      }
    }
    return true;
  };

  const validateOccurrences = (value: string): boolean => {
    if (!hasEndDate) return true;
    if (endType === "occurrences" && !value) {
      setError("Please enter number of occurrences");
      return false;
    }
    if (endType === "occurrences") {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 2) {
        setError("Occurrences must be at least 2");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate amount
    if (!validateAmount(amount)) return;

    // Validate end conditions if recurring
    if (donationType === "recurring") {
      if (!validateEndDate(endDate)) return;
      if (!validateOccurrences(occurrences)) return;
    }

    try {
      setLoading(true);

      const payload: {
        amount: number;
        type: "one-time" | "recurring";
        giftDate?: string;
        startDate?: string;
        frequency?: DonationFrequency;
        endDate?: string;
        endAfterOccurrences?: number;
      } = {
        amount: donationHelpers.toCents(parseFloat(amount)),
        type: donationType,
      };

      // Add recurring fields if applicable
      if (donationType === "recurring") {
        payload.startDate = startDate;
        payload.frequency = frequency;

        if (hasEndDate) {
          if (endType === "date") {
            payload.endDate = endDate;
          } else {
            payload.endAfterOccurrences = parseInt(occurrences, 10);
          }
        }
      } else {
        // For one-time donations, use a fixed "gift date" instead of start date
        payload.giftDate = getTodayDateString();
      }

      const response = await donationsService.createDonation(payload);

      // Redirect to Stripe checkout
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err) {
      console.error("Error creating donation:", err);
      setError("Failed to create donation. Please try again.");
      setLoading(false);
    }
  };

  // Helper function to calculate number of payments between two dates
  const calculatePaymentsBetweenDates = (
    start: string,
    end: string,
    freq: DonationFrequency
  ): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (startDate >= endDate) return 0;

    let count = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      count++;

      // Advance by frequency
      switch (freq) {
        case "weekly":
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case "biweekly":
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case "monthly":
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case "quarterly":
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;
        case "annually":
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
      }
    }

    return count;
  };

  // Calculate summary for recurring donations
  const calculateSummary = () => {
    if (donationType !== "recurring" || !amount) return null;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) return null;

    let totalOccurrences: number | undefined;

    // Calculate occurrences based on end type
    if (hasEndDate) {
      if (endType === "occurrences" && occurrences) {
        totalOccurrences = parseInt(occurrences, 10);
      } else if (endType === "date" && endDate && startDate) {
        // Calculate number of payments between start and end date
        totalOccurrences = calculatePaymentsBetweenDates(
          startDate,
          endDate,
          frequency
        );
      }
    }

    const frequencyText = donationHelpers.formatFrequency(frequency);

    return (
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">Summary</h4>
        <p className="text-sm text-blue-800">
          ${amountNum.toFixed(2)} {frequencyText}
          {totalOccurrences && ` for ${totalOccurrences} payments`}
          {hasEndDate && endType === "date" && endDate && (
            <>, ending on {new Date(endDate).toLocaleDateString()}</>
          )}
        </p>
        {totalOccurrences && (
          <p className="text-sm text-blue-800 mt-1 font-medium">
            Total: ${(amountNum * totalOccurrences).toFixed(2)}
          </p>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Give a Gift</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max="999999"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter an amount between $1 and $999,999
              </p>
            </div>

            {/* Donation Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Donation Type <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="donationType"
                    value="one-time"
                    checked={donationType === "one-time"}
                    onChange={(e) =>
                      setDonationType(e.target.value as "one-time")
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Give once</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="donationType"
                    value="recurring"
                    checked={donationType === "recurring"}
                    onChange={(e) =>
                      setDonationType(e.target.value as "recurring")
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Give multiple times
                  </span>
                </label>
              </div>
            </div>

            {/* Recurring Options */}
            {donationType === "recurring" && (
              <div className="space-y-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={getTodayDateString()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Select when your recurring donations should begin. If you
                    choose today, the first payment will be processed
                    immediately after checkout.
                  </p>
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Frequency <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {(
                      [
                        "weekly",
                        "biweekly",
                        "monthly",
                        "quarterly",
                        "annually",
                      ] as const
                    ).map((freq) => (
                      <label key={freq} className="flex items-center">
                        <input
                          type="radio"
                          name="frequency"
                          value={freq}
                          checked={frequency === freq}
                          onChange={(e) =>
                            setFrequency(e.target.value as DonationFrequency)
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">
                          {donationHelpers.formatFrequency(freq)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* End Date Toggle */}
                <div className="pt-4 border-t border-gray-300">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasEndDate}
                      onChange={(e) => setHasEndDate(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      + END{" "}
                      <span className="text-xs text-gray-500">(optional)</span>
                    </span>
                  </label>
                </div>

                {/* End Date Options */}
                {hasEndDate && (
                  <div className="space-y-4 pl-6">
                    {/* End Type Selection */}
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="endType"
                          value="date"
                          checked={endType === "date"}
                          onChange={(e) => setEndType(e.target.value as "date")}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          End on a specific date
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="endType"
                          value="occurrences"
                          checked={endType === "occurrences"}
                          onChange={(e) =>
                            setEndType(e.target.value as "occurrences")
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          End after number of occurrences
                        </span>
                      </label>
                    </div>

                    {/* Date Picker */}
                    {endType === "date" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => {
                            setEndDate(e.target.value);
                            setError(null);
                          }}
                          min={
                            startDate || new Date().toISOString().split("T")[0]
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}

                    {/* Occurrences Input */}
                    {endType === "occurrences" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Number of Occurrences
                        </label>
                        <input
                          type="number"
                          min="2"
                          value={occurrences}
                          onChange={(e) => {
                            setOccurrences(e.target.value);
                            setError(null);
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., 12"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            {calculateSummary()}

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" inline />
                    Processing...
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { donationsService, donationHelpers } from "../../services/api";
import type {
  DonationFrequency,
  Donation,
} from "../../services/api/donations.api";
import LoadingSpinner from "../common/LoadingSpinner";
import { getTodayDateString } from "../../utils/eventStatsUtils";

interface EditDonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  donation: Donation | null;
  onSuccess: () => void;
}

export default function EditDonationModal({
  isOpen,
  onClose,
  donation,
  onSuccess,
}: EditDonationModalProps) {
  // Form state
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<DonationFrequency>("monthly");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endType, setEndType] = useState<"date" | "occurrences">("date");
  const [endDate, setEndDate] = useState("");
  const [occurrences, setOccurrences] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate form when donation changes
  useEffect(() => {
    if (isOpen && donation) {
      setAmount(donationHelpers.formatAmount(donation.amount));
      setFrequency(donation.frequency || "monthly");

      // Check if donation has end conditions
      if (donation.endDate) {
        setHasEndDate(true);
        setEndType("date");
        setEndDate(donation.endDate.split("T")[0]); // Convert ISO to YYYY-MM-DD
      } else if (donation.endAfterOccurrences) {
        setHasEndDate(true);
        setEndType("occurrences");
        setOccurrences(donation.endAfterOccurrences.toString());
      } else {
        setHasEndDate(false);
      }
    }
  }, [isOpen, donation]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAmount("");
      setFrequency("monthly");
      setHasEndDate(false);
      setEndType("date");
      setEndDate("");
      setOccurrences("");
      setError(null);
    }
  }, [isOpen]);

  // Validation functions
  const validateAmount = (value: string): boolean => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setError("Please enter a valid amount greater than $0");
      return false;
    }
    return true;
  };

  const validateEndDate = (value: string): boolean => {
    if (endType === "date" && hasEndDate && !value) {
      setError("Please select an end date");
      return false;
    }
    return true;
  };

  const validateOccurrences = (value: string): boolean => {
    if (endType === "occurrences" && hasEndDate) {
      const num = parseInt(value, 10);
      if (isNaN(num) || num <= 0) {
        setError("Please enter a valid number of occurrences");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!donation) return;

    // Validate amount
    if (!validateAmount(amount)) return;

    // Validate end conditions
    if (!validateEndDate(endDate)) return;
    if (!validateOccurrences(occurrences)) return;

    try {
      setLoading(true);

      const payload: {
        amount: number;
        frequency: DonationFrequency;
        endDate?: string | null;
        endAfterOccurrences?: number;
      } = {
        amount: parseFloat(amount), // API expects dollars, not cents
        frequency,
      };

      // Add end conditions if applicable
      if (hasEndDate) {
        if (endType === "date") {
          payload.endDate = endDate;
          payload.endAfterOccurrences = undefined; // Clear occurrences if using date
        } else {
          payload.endAfterOccurrences = parseInt(occurrences, 10);
          payload.endDate = null; // Clear end date if using occurrences
        }
      } else {
        // Remove both end conditions if checkbox is unchecked
        payload.endDate = null;
        payload.endAfterOccurrences = undefined;
      }

      await donationsService.updateDonation(donation._id, payload);

      // Success!
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error updating donation:", err);
      setError("Failed to update donation. Please try again.");
      setLoading(false);
    }
  };

  if (!isOpen || !donation) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Edit Recurring Donation
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                  $
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  required
                />
              </div>
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Frequency <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(
                  [
                    "weekly",
                    "biweekly",
                    "monthly",
                    "quarterly",
                    "annually",
                  ] as DonationFrequency[]
                ).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setFrequency(freq)}
                    className={`px-4 py-3 rounded-md border-2 transition-all ${
                      frequency === freq
                        ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    {donationHelpers.formatFrequency(freq)}
                  </button>
                ))}
              </div>
            </div>

            {/* End Date Toggle */}
            <div>
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
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={endType === "date"}
                      onChange={() => setEndType("date")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      End on a specific date
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={endType === "occurrences"}
                      onChange={() => setEndType("occurrences")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      After a certain number of gifts
                    </span>
                  </label>
                </div>

                {/* End Date Input */}
                {endType === "date" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={getTodayDateString()}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                )}

                {/* Occurrences Input */}
                {endType === "occurrences" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Gifts <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={occurrences}
                      onChange={(e) => setOccurrences(e.target.value)}
                      placeholder="e.g., 12"
                      min="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" inline />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
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

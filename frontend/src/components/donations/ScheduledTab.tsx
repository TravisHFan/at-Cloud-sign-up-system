import { useEffect, useState } from "react";
import { donationsService, donationHelpers } from "../../services/api";
import type { Donation } from "../../services/api/donations.api";
import { formatDateToAmerican } from "../../utils/eventStatsUtils";
import LoadingSpinner from "../common/LoadingSpinner";
import { ConfirmationModal } from "../common";
import EditDonationModal from "./EditDonationModal";

export default function ScheduledTab() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Confirmation modals
  const [holdConfirm, setHoldConfirm] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(
    null
  );

  useEffect(() => {
    loadDonations();
  }, []);

  const loadDonations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await donationsService.getMyScheduledDonations();
      setDonations(data);
    } catch (err) {
      console.error("Error loading scheduled donations:", err);
      setError("Failed to load scheduled donations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleHold = async (donationId: string) => {
    try {
      setActionLoading(donationId);
      await donationsService.holdDonation(donationId);
      await loadDonations(); // Refresh list
      setHoldConfirm(null);
    } catch (err) {
      console.error("Error holding donation:", err);
      alert("Failed to place donation on hold. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (donationId: string) => {
    try {
      setActionLoading(donationId);
      await donationsService.resumeDonation(donationId);
      await loadDonations(); // Refresh list
    } catch (err) {
      console.error("Error resuming donation:", err);
      alert("Failed to resume donation. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (donationId: string) => {
    try {
      setActionLoading(donationId);
      await donationsService.cancelDonation(donationId);
      await loadDonations(); // Refresh list
      setCancelConfirm(null);
    } catch (err) {
      console.error("Error cancelling donation:", err);
      alert("Failed to cancel donation. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = (donation: Donation) => {
    setSelectedDonation(donation);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    loadDonations(); // Refresh list after successful edit
  };

  if (loading) {
    return (
      <div className="py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadDonations}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (donations.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <svg
          className="w-16 h-16 text-gray-400 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-gray-600 font-medium">No scheduled donations</p>
        <p className="text-sm text-gray-500 mt-1">
          Set up recurring donations to support our ministry regularly
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {donations.map((donation) => {
        const isOnHold = donation.status === "on_hold";
        const isLoading = actionLoading === donation._id;

        return (
          <div
            key={donation._id}
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header: Amount and Next Payment Date */}
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                ${donationHelpers.formatAmount(donation.amount)} gift scheduled
                for{" "}
                {donation.nextPaymentDate
                  ? formatDateToAmerican(donation.nextPaymentDate)
                  : "upcoming"}
              </h3>
            </div>

            {/* Frequency */}
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <p>
                {donation.frequency &&
                  donationHelpers.formatFrequency(donation.frequency)}
              </p>

              {/* Last gift date */}
              {donation.lastGiftDate && (
                <p>
                  Last gift on {formatDateToAmerican(donation.lastGiftDate)}
                </p>
              )}

              {/* End conditions */}
              {donation.endDate ? (
                <p>
                  Ends on {formatDateToAmerican(donation.endDate)}
                  {donation.remainingOccurrences !== undefined &&
                    donation.remainingOccurrences > 0 &&
                    ` (${donation.remainingOccurrences} gift${
                      donation.remainingOccurrences !== 1 ? "s" : ""
                    } remaining)`}
                </p>
              ) : donation.endAfterOccurrences ? (
                <p>
                  {donation.remainingOccurrences !== undefined &&
                  donation.remainingOccurrences > 0
                    ? `${donation.remainingOccurrences} gift${
                        donation.remainingOccurrences !== 1 ? "s" : ""
                      } remaining (of ${donation.endAfterOccurrences})`
                    : `Ends after ${donation.endAfterOccurrences} gifts`}
                </p>
              ) : (
                <p>Continues indefinitely</p>
              )}

              {/* Current occurrence count */}
              {donation.currentOccurrence > 0 && (
                <p className="text-gray-500">
                  {donation.currentOccurrence} gift
                  {donation.currentOccurrence !== 1 ? "s" : ""} completed
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                {donationHelpers.formatPaymentMethod(donation.paymentMethod)}
              </p>
            </div>

            {/* Status Badge (if on hold) */}
            {isOnHold && (
              <div className="mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  On Hold
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {/* Edit Button */}
              <button
                onClick={() => handleEdit(donation)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Edit
              </button>

              {/* Hold/Resume Button */}
              {isOnHold ? (
                <button
                  onClick={() => handleResume(donation._id)}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded-md hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? "Resuming..." : "Resume"}
                </button>
              ) : (
                <button
                  onClick={() => setHoldConfirm(donation._id)}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-300 rounded-md hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Place On Hold
                </button>
              )}

              {/* Cancel Button */}
              <button
                onClick={() => setCancelConfirm(donation._id)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Cancelling..." : "Cancel"}
              </button>
            </div>
          </div>
        );
      })}

      {/* Hold Confirmation Modal */}
      {holdConfirm && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setHoldConfirm(null)}
          onConfirm={() => handleHold(holdConfirm)}
          title="Place Donation On Hold?"
          message="Are you sure you want to place this scheduled gift on hold? You can resume it anytime."
          confirmText="Confirm"
          cancelText="Cancel"
          type="warning"
        />
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirm && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setCancelConfirm(null)}
          onConfirm={() => handleCancel(cancelConfirm)}
          title="Cancel Scheduled Gift?"
          message="Are you sure you want to cancel this scheduled gift? This action cannot be undone."
          confirmText="Yes, Cancel Gift"
          cancelText="Keep Gift"
          type="danger"
        />
      )}

      {/* Edit Donation Modal */}
      <EditDonationModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        donation={selectedDonation}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}

import { formatCurrency } from "../../utils/currency";
import type { DonationAnalytics } from "../../services/api/analytics.api";

export interface DonationAnalyticsSectionProps {
  analytics: DonationAnalytics;
}

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

export function DonationAnalyticsSection({
  analytics,
}: DonationAnalyticsSectionProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
      data-testid="donation-analytics-section"
    >
      {/* Donation Type Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Donation Breakdown
        </h3>
        <div className="space-y-4">
          {/* One-Time Gifts */}
          <div className="p-4 bg-pink-50 rounded-lg border border-pink-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-pink-900">One-Time Gifts</h4>
              <span className="text-xs font-medium text-pink-600 px-2 py-1 bg-pink-100 rounded">
                {analytics.totalGifts > 0
                  ? (
                      (analytics.oneTime.gifts / analytics.totalGifts) *
                      100
                    ).toFixed(1)
                  : "0.0"}
                %
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-pink-700">Total Revenue</span>
                <span className="font-semibold text-pink-900">
                  {formatCurrency(analytics.oneTime.revenue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-pink-700">Number of Gifts</span>
                <span className="font-semibold text-pink-900">
                  {analytics.oneTime.gifts}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-pink-700">Average Gift Size</span>
                <span className="font-semibold text-pink-900">
                  {formatCurrency(analytics.oneTime.avgGiftSize)}
                </span>
              </div>
            </div>
          </div>

          {/* Recurring Gifts */}
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-purple-900">Recurring Gifts</h4>
              <span className="text-xs font-medium text-purple-600 px-2 py-1 bg-purple-100 rounded">
                {analytics.totalGifts > 0
                  ? (
                      (analytics.recurring.gifts / analytics.totalGifts) *
                      100
                    ).toFixed(1)
                  : "0.0"}
                %
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-700">Total Revenue</span>
                <span className="font-semibold text-purple-900">
                  {formatCurrency(analytics.recurring.revenue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-700">Number of Gifts</span>
                <span className="font-semibold text-purple-900">
                  {analytics.recurring.gifts}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-700">Average Gift Size</span>
                <span className="font-semibold text-purple-900">
                  {formatCurrency(analytics.recurring.avgGiftSize)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-700">Active Recurring</span>
                <span className="font-semibold text-purple-900">
                  {analytics.recurring.activeDonations}
                </span>
              </div>
              {analytics.recurring.onHoldDonations > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-700">On Hold</span>
                  <span className="font-semibold text-orange-600">
                    {analytics.recurring.onHoldDonations}
                  </span>
                </div>
              )}
            </div>

            {/* Frequency Breakdown */}
            {analytics.recurring.frequencyBreakdown.length > 0 && (
              <div className="mt-3 pt-3 border-t border-purple-200">
                <p className="text-xs font-medium text-purple-700 uppercase mb-2">
                  Frequency Distribution
                </p>
                <div className="space-y-1">
                  {analytics.recurring.frequencyBreakdown.map((freq, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-purple-700">
                        {frequencyLabels[freq.frequency] || freq.frequency}
                      </span>
                      <span className="font-medium text-purple-900">
                        {freq.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Donor Engagement */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Donor Engagement
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Total Unique Donors</span>
            <span className="font-semibold text-gray-900">
              {analytics.uniqueDonors}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Active Recurring Donors
            </span>
            <span className="font-semibold text-gray-900">
              {analytics.recurring.activeDonations}
            </span>
          </div>

          {analytics.recurring.onHoldDonations > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Donations on Hold</span>
              <span className="font-semibold text-orange-600">
                {analytics.recurring.onHoldDonations}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Average Gifts per Donor
            </span>
            <span className="font-semibold text-gray-900">
              {analytics.avgGiftsPerDonor.toFixed(1)}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Retention Rate</span>
            <span className="font-semibold text-gray-900">
              {analytics.retentionRate.toFixed(1)}%
              <span className="text-xs text-gray-500 ml-1">
                (repeat donors)
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Total Gift Count</span>
            <span className="font-semibold text-gray-900">
              {analytics.totalGifts}
            </span>
          </div>

          {/* Summary Stats */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 mb-1">Total Revenue</p>
                <p className="text-sm font-semibold text-blue-900">
                  {formatCurrency(analytics.totalRevenue)}
                </p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 mb-1">Avg Gift Size</p>
                <p className="text-sm font-semibold text-green-900">
                  {formatCurrency(
                    analytics.totalGifts > 0
                      ? analytics.totalRevenue / analytics.totalGifts
                      : 0
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

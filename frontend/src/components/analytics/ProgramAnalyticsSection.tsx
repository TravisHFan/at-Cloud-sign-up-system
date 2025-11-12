import { formatCurrency } from "../../utils/currency";
import type { ProgramAnalytics } from "../../services/api/analytics.api";

export interface ProgramAnalyticsSectionProps {
  analytics: ProgramAnalytics;
}

export function ProgramAnalyticsSection({
  analytics,
}: ProgramAnalyticsSectionProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
      data-testid="program-analytics-section"
    >
      {/* Program Type Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Program Type Distribution
        </h3>
        <div className="space-y-4">
          {analytics.programTypeBreakdown.length > 0 ? (
            analytics.programTypeBreakdown.map((program, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-base">
                      {program.programType}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {program.purchases} purchase
                      {program.purchases !== 1 ? "s" : ""} •{" "}
                      {program.uniqueBuyers} buyer
                      {program.uniqueBuyers !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {analytics.totalRevenue > 0
                        ? (
                            (program.revenue / analytics.totalRevenue) *
                            100
                          ).toFixed(1)
                        : "0.0"}
                      % of total
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Total Revenue:
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(program.revenue)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">
              No program data available
            </p>
          )}
        </div>
      </div>

      {/* Program Engagement Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Program Engagement
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Unique Buyers</span>
            <span className="font-semibold text-gray-900">
              {analytics.uniqueBuyers}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Class Rep Purchases</span>
            <span className="font-semibold text-gray-900">
              {analytics.classRepPurchases}
              <span className="text-xs text-gray-500 ml-1">
                ({analytics.classRepRate.toFixed(1)}%)
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Promo Code Usage</span>
            <span className="font-semibold text-gray-900">
              {analytics.promoCodePurchases}
              <span className="text-xs text-gray-500 ml-1">
                ({analytics.promoCodeUsageRate.toFixed(1)}%)
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Early Bird Adoption</span>
            <span className="font-semibold text-gray-900">
              {analytics.earlyBirdPurchases}
              <span className="text-xs text-gray-500 ml-1">
                ({analytics.earlyBirdRate.toFixed(1)}%)
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Average Program Price</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(analytics.avgProgramPrice)}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                Revenue from Class Reps
              </span>
              <span className="text-xs text-gray-500">
                Purchases with Class Rep discount
              </span>
            </div>
            <span className="font-semibold text-gray-900">
              {formatCurrency(analytics.classRepRevenue)}
            </span>
          </div>

          {/* Status Counts */}
          {(analytics.pendingPurchases > 0 ||
            analytics.failedPurchases > 0 ||
            analytics.refundedPurchases > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                Purchase Status
              </p>
              <div className="space-y-2">
                {analytics.pendingPurchases > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Pending</span>
                    <span className="text-sm font-medium text-yellow-600">
                      {analytics.pendingPurchases}
                    </span>
                  </div>
                )}
                {analytics.failedPurchases > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Failed</span>
                    <span className="text-sm font-medium text-red-600">
                      {analytics.failedPurchases}
                    </span>
                  </div>
                )}
                {analytics.refundedPurchases > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Refunded</span>
                    <span className="text-sm font-medium text-gray-600">
                      {analytics.refundedPurchases} (
                      {formatCurrency(analytics.refundedRevenue)})
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

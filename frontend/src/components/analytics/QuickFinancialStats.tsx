import {
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "../../utils/currency";

export interface QuickFinancialStatsProps {
  netRevenue: number; // in cents - completed revenue (programs + donations)
  pendingFailedAmount: number; // in cents - pending + failed purchases
  refundedAmount: number; // in cents - refunded purchases
  activeRecurringRevenue: number; // in cents - monthly value of active recurring donations
}

export function QuickFinancialStats({
  netRevenue,
  pendingFailedAmount,
  refundedAmount,
  activeRecurringRevenue,
}: QuickFinancialStatsProps) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      data-testid="quick-financial-stats"
    >
      {/* Net Revenue */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircleIcon className="w-5 h-5 text-green-600" />
          <span className="text-xs font-medium text-gray-500 uppercase">
            Net Revenue
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-900">
          {formatCurrency(netRevenue)}
        </p>
        <p className="text-xs text-green-600 mt-1">✅ Completed</p>
      </div>

      {/* Pending/Failed */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <ClockIcon className="w-5 h-5 text-yellow-600" />
          <span className="text-xs font-medium text-gray-500 uppercase">
            Pending/Failed
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-900">
          {formatCurrency(pendingFailedAmount)}
        </p>
        <p className="text-xs text-yellow-600 mt-1">⏳ Processing</p>
      </div>

      {/* Refunded */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <ArrowUturnLeftIcon className="w-5 h-5 text-red-600" />
          <span className="text-xs font-medium text-gray-500 uppercase">
            Refunded
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-900">
          {formatCurrency(refundedAmount)}
        </p>
        <p className="text-xs text-red-600 mt-1">↩️ Refunded</p>
      </div>

      {/* Active Recurring */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <ArrowPathIcon className="w-5 h-5 text-purple-600" />
          <span className="text-xs font-medium text-gray-500 uppercase">
            Active Recurring
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-900">
          {formatCurrency(activeRecurringRevenue)}
        </p>
        <p className="text-xs text-purple-600 mt-1">🔄 Monthly</p>
      </div>
    </div>
  );
}

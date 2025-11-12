import {
  CurrencyDollarIcon,
  AcademicCapIcon,
  HeartIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/solid";
import { formatCurrency } from "../../utils/currency";

export interface FinancialHealthCardsProps {
  totalRevenue: number; // in cents
  programRevenue: number; // in cents
  programPurchases: number;
  donationRevenue: number; // in cents
  donationGifts: number;
  last30DaysRevenue: number; // in cents
  last30DaysPercentage: number; // percentage
  growthRate: number; // percentage
}

export function FinancialHealthCards({
  totalRevenue,
  programRevenue,
  programPurchases,
  donationRevenue,
  donationGifts,
  last30DaysRevenue,
  last30DaysPercentage,
  growthRate,
}: FinancialHealthCardsProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      data-testid="financial-health-cards"
    >
      {/* Total Revenue Card */}
      <div
        className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 flex flex-col gap-2 border-2 border-green-200"
        data-testid="financial-card-total-revenue"
      >
        <div className="flex items-center gap-2">
          <CurrencyDollarIcon
            className="w-5 h-5 text-green-600"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-green-700">Total Revenue</p>
        </div>
        <p
          className="text-2xl font-semibold text-green-900"
          aria-label="total-revenue-value"
        >
          {formatCurrency(totalRevenue)}
        </p>
        <p className="text-xs text-green-600">Programs + Donations</p>
      </div>

      {/* Program Revenue Card */}
      <div
        className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 flex flex-col gap-2"
        data-testid="financial-card-program-revenue"
      >
        <div className="flex items-center gap-2">
          <AcademicCapIcon
            className="w-5 h-5 text-blue-600"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-blue-700">Program Revenue</p>
        </div>
        <p
          className="text-2xl font-semibold text-blue-900"
          aria-label="program-revenue-value"
        >
          {formatCurrency(programRevenue)}
        </p>
        <p className="text-xs text-blue-600">
          From {programPurchases} purchase{programPurchases !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Donation Revenue Card */}
      <div
        className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-6 flex flex-col gap-2"
        data-testid="financial-card-donation-revenue"
      >
        <div className="flex items-center gap-2">
          <HeartIcon className="w-5 h-5 text-pink-600" aria-hidden="true" />
          <p className="text-sm font-medium text-pink-700">Donation Revenue</p>
        </div>
        <p
          className="text-2xl font-semibold text-pink-900"
          aria-label="donation-revenue-value"
        >
          {formatCurrency(donationRevenue)}
        </p>
        <p className="text-xs text-pink-600">
          From {donationGifts} gift{donationGifts !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Last 30 Days Card */}
      <div
        className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 flex flex-col gap-2"
        data-testid="financial-card-last30days"
      >
        <div className="flex items-center gap-2">
          <ArrowTrendingUpIcon
            className="w-5 h-5 text-purple-600"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-purple-700">Last 30 Days</p>
        </div>
        <p
          className="text-2xl font-semibold text-purple-900"
          aria-label="last30days-revenue-value"
        >
          {formatCurrency(last30DaysRevenue)}
        </p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-purple-600">
            {last30DaysPercentage.toFixed(1)}% of all-time
          </span>
          {growthRate !== 0 && (
            <span
              className={`font-medium ${
                growthRate > 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {growthRate > 0 ? "+" : ""}
              {growthRate.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

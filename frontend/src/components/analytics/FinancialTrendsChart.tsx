import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../../utils/currency";
import {
  analyticsService,
  type TrendsData,
} from "../../services/api/analytics.api";

type Period = "6months" | "12months" | "all";

export function FinancialTrendsChart() {
  const [period, setPeriod] = useState<Period>("6months");
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await analyticsService.getTrends(period);
        setTrendsData(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load trends data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, [period]);

  // Transform data for Recharts
  const chartData =
    trendsData?.labels.map((label, index) => ({
      month: label,
      programs: trendsData.programRevenue[index] / 100, // Convert cents to dollars
      donations: trendsData.donationRevenue[index] / 100,
      combined: trendsData.combinedRevenue[index] / 100,
    })) || [];

  type TooltipPayloadEntry = {
    color: string;
    name: string;
    value: number;
  };

  interface CustomTooltipProps {
    active?: boolean;
    label?: string;
    payload?: TooltipPayloadEntry[];
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              <span className="font-medium">{entry.name}:</span>{" "}
              {formatCurrency(entry.value * 100)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Financial Trends
          </h3>
          <p className="text-sm text-gray-500">
            Revenue trends over time (programs + donations)
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={() => setPeriod("6months")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              period === "6months"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            6 Months
          </button>
          <button
            onClick={() => setPeriod("12months")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              period === "12months"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            12 Months
          </button>
          <button
            onClick={() => setPeriod("all")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              period === "all"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Chart Area */}
      {loading ? (
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-64 w-full bg-gray-200 rounded mb-2"></div>
            <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : error ? (
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-purple-600 hover:text-purple-700 underline"
            >
              Reload page
            </button>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={{ stroke: "#d1d5db" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={{ stroke: "#d1d5db" }}
              tickFormatter={(value: number) => `$${value.toLocaleString()}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "14px", paddingTop: "20px" }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="programs"
              name="Program Revenue"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="donations"
              name="Donation Revenue"
              stroke="#ec4899"
              strokeWidth={2}
              dot={{ fill: "#ec4899", r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="combined"
              name="Combined Revenue"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ fill: "#10b981", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Summary Stats */}
      {!loading && !error && trendsData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">
              Total Program Revenue
            </p>
            <p className="text-lg font-bold text-blue-600">
              {formatCurrency(
                trendsData.programRevenue.reduce((sum, val) => sum + val, 0)
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">
              Total Donation Revenue
            </p>
            <p className="text-lg font-bold text-pink-600">
              {formatCurrency(
                trendsData.donationRevenue.reduce((sum, val) => sum + val, 0)
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">
              Combined Total
            </p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(
                trendsData.combinedRevenue.reduce((sum, val) => sum + val, 0)
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Months</p>
            <p className="text-lg font-bold text-gray-900">
              {trendsData.labels.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

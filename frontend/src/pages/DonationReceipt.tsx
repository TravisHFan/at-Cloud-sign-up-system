import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ReceiptAPI } from "../services/api/donations.api";
import type { ReceiptData } from "../services/api/donations.api";
import { formatCurrency } from "../utils/currency";
import { formatDateToAmerican } from "../utils/eventStatsUtils";
import html2pdf from "html2pdf.js";

// Icons as inline SVG components
const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
    />
  </svg>
);

const PrinterIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"
    />
  </svg>
);

export default function DonationReceipt() {
  const navigate = useNavigate();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  // Fetch available years on mount
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const years = await ReceiptAPI.getAvailableYears();
        setAvailableYears(years);
        // Default to current year if available
        const currentYear = new Date().getFullYear();
        if (years.includes(currentYear)) {
          setSelectedYears([currentYear]);
        } else if (years.length > 0) {
          setSelectedYears([years[0]]);
        } else {
          // No years available - stop loading and show appropriate message
          setLoading(false);
          setError("No donation history available");
        }
      } catch (err) {
        console.error("Failed to fetch available years:", err);
        setError("Failed to load available years");
        setLoading(false);
      }
    };
    fetchYears();
  }, []);

  // Fetch receipt data when selected years change
  useEffect(() => {
    if (selectedYears.length === 0) {
      // Keep loading=true during initial mount while years are being fetched
      // Don't change loading state here
      return;
    }

    const fetchReceipt = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await ReceiptAPI.getReceipt(selectedYears);
        setReceiptData(data);
      } catch (err) {
        console.error("Failed to fetch receipt:", err);
        setError("Failed to load receipt data");
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [selectedYears]);

  const handleYearToggle = (year: number) => {
    setSelectedYears((prev) => {
      if (prev.includes(year)) {
        // Don't allow deselecting all years
        if (prev.length === 1) return prev;
        return prev.filter((y) => y !== year);
      } else {
        return [...prev, year].sort((a, b) => b - a);
      }
    });
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;

    const opt = {
      margin: 0.5,
      filename: `donation-receipt-${selectedYears.join("-")}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" as const },
    };

    try {
      await html2pdf().set(opt).from(receiptRef.current).save();
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const handleBack = () => {
    navigate("/dashboard/donate");
  };

  // Check loading state FIRST before checking error/data
  // This prevents showing "No receipt data available" flash during loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-800">{error || "No receipt data available"}</p>
          <button
            onClick={handleBack}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Donations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Action Bar - Hidden when printing */}
      <div className="print-hide bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Back to Donations</span>
          </button>

          <div className="flex items-center gap-4">
            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">
                Tax Year:
              </span>
              <div className="flex gap-2">
                {availableYears.map((year) => (
                  <button
                    key={year}
                    onClick={() => handleYearToggle(year)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      selectedYears.includes(year)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <PrinterIcon className="w-5 h-5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Content */}
      <div className="max-w-4xl mx-auto p-6 print-content">
        <div
          ref={receiptRef}
          className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200"
        >
          {/* Official Header with Logo */}
          <div className="border-b border-gray-200 p-8 text-center">
            <img
              src="/Cloud-removebg.png"
              alt="@Cloud System Logo"
              className="h-24 mx-auto mb-4"
            />
            <p className="text-sm text-gray-500 mb-6">
              @Cloud Marketplace Ministry ERP System
            </p>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Donation Receipt
            </h1>
            <p className="text-gray-600">
              Tax-Deductible Charitable Contribution Record
            </p>
          </div>

          {/* Receipt Body */}
          <div className="p-8">
            {/* Receipt Details Section */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-200">
              <div>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Receipt For
                </h2>
                <p className="text-lg font-semibold text-gray-900 mb-1">
                  {receiptData.user.name}
                </p>
                <p className="text-sm text-gray-600">
                  {receiptData.user.email}
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Receipt Generated
                </h2>
                <p className="text-sm text-gray-900">
                  {formatDateToAmerican(receiptData.generatedAt)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tax Year{selectedYears.length > 1 ? "s" : ""}:{" "}
                  {selectedYears.sort((a, b) => a - b).join(", ")}
                </p>
              </div>
            </div>

            {/* Summary Section */}
            <div className="mb-8 pb-6 border-b border-gray-200">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Donation Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">
                    Total Amount
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(receiptData.summary.grandTotal)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">
                    Transactions
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {receiptData.summary.totalTransactions}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                  <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">
                    Years Covered
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {receiptData.summary.yearsCount}
                  </p>
                </div>
              </div>
            </div>

            {/* Yearly Breakdown */}
            {receiptData.yearlyStats.map((yearData, index) => (
              <div
                key={yearData.year}
                className={
                  index < receiptData.yearlyStats.length - 1
                    ? "mb-8 pb-8 border-b border-gray-200"
                    : "mb-8"
                }
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">
                    Tax Year {yearData.year}
                  </h2>
                  <div className="text-right">
                    <p className="text-xs text-gray-600 uppercase tracking-wide">
                      Year Total
                    </p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(yearData.totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Transaction Table */}
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {yearData.transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDateToAmerican(transaction.date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                            {transaction.type.replace("-", " ")}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(transaction.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td
                          colSpan={2}
                          className="px-4 py-3 text-sm font-semibold text-gray-700"
                        >
                          {yearData.year} Subtotal ({yearData.transactionCount}{" "}
                          transaction
                          {yearData.transactionCount !== 1 ? "s" : ""})
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                          {formatCurrency(yearData.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}

            {/* Grand Total (if multiple years) */}
            {receiptData.yearlyStats.length > 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Grand Total
                    </h3>
                    <p className="text-sm text-gray-700">
                      All selected years (
                      {receiptData.summary.totalTransactions} total
                      transactions)
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(receiptData.summary.grandTotal)}
                  </p>
                </div>
              </div>
            )}

            {/* Footer Note */}
            <div className="pt-8 border-t border-gray-200 text-center space-y-3">
              <p className="text-sm text-gray-700">
                Thank you for your generous support to our ministry
              </p>
              <p className="text-xs text-gray-600">
                This receipt shows completed tax-deductible donations for the
                selected tax year(s).
              </p>
              <p className="text-xs text-gray-600">
                Please retain this receipt for your tax records.
              </p>
              <div className="pt-4 mt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  For questions about your donations, contact us at{" "}
                  <a
                    href="mailto:atcloudministry@gmail.com"
                    className="text-blue-600 hover:text-blue-700"
                  >
                    atcloudministry@gmail.com
                  </a>
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  © {new Date().getFullYear()} @Cloud System. All rights
                  reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

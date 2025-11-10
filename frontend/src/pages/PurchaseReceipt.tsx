import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { purchaseService } from "../services/api";
import { formatCurrency } from "../utils/currency";

interface PurchaseReceipt {
  id: string;
  orderNumber: string;
  programId: {
    _id: string;
    title: string;
    programType?: string;
  };
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  fullPrice: number;
  classRepDiscount: number;
  earlyBirdDiscount: number;
  finalPrice: number;
  isClassRep: boolean;
  isEarlyBird: boolean;
  promoCode?: string;
  promoDiscountAmount?: number;
  promoDiscountPercent?: number;
  purchaseDate: string;
  status: string;
  billingInfo?: {
    fullName?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  paymentMethod?: {
    type: string;
    cardBrand?: string;
    last4?: string;
  };
}

export default function PurchaseReceipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const printRef = useRef<HTMLDivElement>(null);
  const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine if we came from Income History based on the URL pattern
  const isFromIncomeHistory = location.pathname.includes("/purchases/");

  const backPath = isFromIncomeHistory
    ? "/dashboard/income-history"
    : "/dashboard/purchase-history";

  const backLabel = isFromIncomeHistory
    ? "Back to Income History"
    : "Back to Purchase History";

  useEffect(() => {
    const loadReceipt = async () => {
      if (!id) {
        setError("Invalid receipt ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await purchaseService.getPurchaseReceipt(id);
        setReceipt(data as PurchaseReceipt);
      } catch (err: any) {
        console.error("Error loading receipt:", err);
        // Extract the error message from the API response if available
        const errorMessage =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load receipt. Please try again.";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadReceipt();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">
              Error Loading Receipt
            </h2>
            <p className="text-red-700">{error || "Receipt not found"}</p>
            <button
              onClick={() => navigate(backPath)}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              {backLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print-only styles */}
      <style>{`
        @media print {
          body {
            background: white;
          }
          .print-hide {
            display: none !important;
          }
          .print-content {
            max-width: 100%;
            padding: 20px;
            box-shadow: none !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>

      {/* Action Bar - Hidden when printing */}
      <div className="print-hide bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(backPath)}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            {backLabel}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print Receipt
          </button>
        </div>
      </div>

      {/* Receipt Content */}
      <div className="py-8 px-6">
        <div
          ref={printRef}
          className="print-content max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-12"
        >
          {/* Official Header with Logo - Similar to government letter */}
          <div className="text-center mb-8 pb-8 border-b-2 border-gray-200">
            <div className="mb-4">
              <img
                src="/Cloud-removebg.png"
                alt="@Cloud Logo"
                className="h-24 mx-auto mb-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                @Cloud Marketplace Ministry ERP System
              </p>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mt-6">
              Payment Receipt
            </h2>
          </div>

          {/* Receipt Details */}
          <div className="flex items-start justify-between mb-8 pb-8 border-b border-gray-200">
            <div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Receipt Number
              </div>
              <div className="text-xl font-bold text-gray-900">
                {receipt.orderNumber}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Purchase Date
              </div>
              <div className="text-lg font-medium text-gray-900">
                {new Date(receipt.purchaseDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>

          {/* Billing Information */}
          <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-gray-200">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Billed To
              </h3>
              <div className="text-gray-900">
                <div className="font-medium">
                  {receipt.billingInfo?.fullName ||
                    `${receipt.userId.firstName} ${receipt.userId.lastName}`}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {receipt.billingInfo?.email || receipt.userId.email}
                </div>
                {receipt.billingInfo?.address && (
                  <div className="text-sm text-gray-600 mt-2">
                    <div>{receipt.billingInfo.address}</div>
                    {receipt.billingInfo.city && (
                      <div>
                        {receipt.billingInfo.city}
                        {receipt.billingInfo.state &&
                          `, ${receipt.billingInfo.state}`}
                        {receipt.billingInfo.zipCode &&
                          ` ${receipt.billingInfo.zipCode}`}
                      </div>
                    )}
                    {receipt.billingInfo.country && (
                      <div>{receipt.billingInfo.country}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Payment Method
              </h3>
              <div className="text-gray-900">
                {receipt.paymentMethod?.cardBrand &&
                receipt.paymentMethod?.last4 ? (
                  <>
                    <div className="font-medium capitalize">
                      {receipt.paymentMethod.cardBrand} ••••{" "}
                      {receipt.paymentMethod.last4}
                    </div>
                    {receipt.billingInfo?.fullName && (
                      <div className="text-sm text-gray-600 mt-1">
                        {receipt.billingInfo.fullName}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="font-medium">
                    {receipt.paymentMethod?.type || "Card Payment"}
                  </div>
                )}
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      receipt.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : receipt.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {receipt.status.charAt(0).toUpperCase() +
                      receipt.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Program Information */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Program Details
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-900">
                {receipt.programId.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                {receipt.programId.programType}
              </p>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Payment Summary
            </h3>
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-3 text-gray-900">Program Enrollment</td>
                  <td className="py-3 text-right text-gray-900 font-medium">
                    {formatCurrency(receipt.fullPrice || 0)}
                  </td>
                </tr>

                {receipt.isClassRep && receipt.classRepDiscount > 0 && (
                  <tr>
                    <td className="py-3 text-gray-900">
                      <div className="flex items-center">
                        Class Representative Discount
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Class Rep
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-green-600 font-medium">
                      -{formatCurrency(receipt.classRepDiscount)}
                    </td>
                  </tr>
                )}

                {receipt.isEarlyBird && receipt.earlyBirdDiscount > 0 && (
                  <tr>
                    <td className="py-3 text-gray-900">
                      <div className="flex items-center">
                        Early Bird Discount
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          Early Bird
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-green-600 font-medium">
                      -{formatCurrency(receipt.earlyBirdDiscount)}
                    </td>
                  </tr>
                )}

                {receipt.promoCode &&
                  (receipt.promoDiscountAmount ||
                    receipt.promoDiscountPercent) && (
                    <tr>
                      <td className="py-3 text-gray-900">
                        <div className="flex items-center">
                          {receipt.promoDiscountPercent === 100
                            ? "Staff Discount (100%)"
                            : "Promo Code Discount"}
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {receipt.promoCode}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-green-600 font-medium">
                        -
                        {formatCurrency(
                          receipt.promoDiscountAmount ||
                            (receipt.promoDiscountPercent
                              ? Math.round(
                                  ((receipt.fullPrice -
                                    (receipt.classRepDiscount || 0) -
                                    (receipt.earlyBirdDiscount || 0)) *
                                    receipt.promoDiscountPercent) /
                                    100
                                )
                              : 0)
                        )}
                      </td>
                    </tr>
                  )}

                <tr className="border-t-2 border-gray-300">
                  <td className="py-4 text-lg font-semibold text-gray-900">
                    Total Paid
                  </td>
                  <td className="py-4 text-right text-2xl font-bold text-gray-900">
                    {formatCurrency(receipt.finalPrice || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-8 mt-8">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Thank you for enrolling in our program!
              </p>
              <p className="text-xs text-gray-500">
                If you have any questions about this receipt, please contact us
                at{" "}
                <a
                  href="mailto:atcloudministry@gmail.com"
                  className="text-purple-600 hover:underline"
                >
                  atcloudministry@gmail.com
                </a>
              </p>
              <p className="text-xs text-gray-400 mt-4">
                © {new Date().getFullYear()} @Cloud. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

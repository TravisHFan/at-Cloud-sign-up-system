import { useState, useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { Icon } from "../common";
import { eventService } from "../../services/api";

interface EventPurchaser {
  id: string;
  userId: string;
  name: string;
  email: string;
  paymentDate: string;
  amountPaid: number;
  promoCode: string | null;
  orderNumber: string;
}

interface EventPurchasersSectionProps {
  eventId: string;
  isPaidEvent: boolean;
  canViewPurchases: boolean;
}

/**
 * EventPurchasersSection
 *
 * Displays a collapsible list of users who have paid for an event ticket.
 * Only visible to Super Admin, Administrator, event creator (Organizer),
 * and listed Co-organizers.
 *
 * Shows: Name, Email, Payment Date, Amount Paid, Promo Code (if used)
 */
export default function EventPurchasersSection({
  eventId,
  isPaidEvent,
  canViewPurchases,
}: EventPurchasersSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [purchasers, setPurchasers] = useState<EventPurchaser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    if (!isPaidEvent || !canViewPurchases) {
      setLoading(false);
      return;
    }

    const fetchPurchases = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await eventService.getEventPurchases(eventId);
        setPurchasers(result.purchases);
        setTotalRevenue(result.totalRevenue);
      } catch (err) {
        console.error("Failed to fetch event purchases:", err);
        setError("Failed to load purchase information");
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, [eventId, isPaidEvent, canViewPurchases]);

  // Don't render if not a paid event or user doesn't have permission
  if (!isPaidEvent || !canViewPurchases) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      {/* Header with toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <Icon name="ticket" className="w-6 h-6 text-green-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Ticket Purchases
            </h2>
            <p className="text-sm text-gray-500">
              {purchasers.length} paid{" "}
              {purchasers.length === 1 ? "attendee" : "attendees"}
              {totalRevenue > 0 && (
                <span className="ml-2 text-green-600 font-medium">
                  ({formatCurrency(totalRevenue)} total)
                </span>
              )}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading purchases...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-700">{error}</p>
            </div>
          ) : purchasers.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
              <Icon
                name="ticket"
                className="w-12 h-12 text-gray-400 mx-auto mb-3"
              />
              <p className="text-gray-600">No ticket purchases yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Users who purchase tickets will appear here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Promo Code
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {purchasers.map((purchaser) => (
                    <tr key={purchaser.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {purchaser.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <a
                          href={`mailto:${purchaser.email}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {purchaser.email}
                        </a>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(purchaser.paymentDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-green-700">
                          {formatCurrency(purchaser.amountPaid)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {purchaser.promoCode ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {purchaser.promoCode}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

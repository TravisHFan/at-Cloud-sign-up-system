import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { eventsService } from "../services/api/events.api";
import { Icon } from "../components/common";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import type { EventData } from "../types/event";
import PromoCodeInput, {
  type PromoCode,
} from "../components/promo/PromoCodeInput";
import { promoCodeService } from "../services/promoCodeService";

export default function EventPurchase() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notification = useToastReplacement();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [availablePromoCodes, setAvailablePromoCodes] = useState<PromoCode[]>(
    []
  );

  const [purchaseInfo, setPurchaseInfo] = useState<{
    eventId: string;
    eventTitle: string;
    originalPrice: number;
    discount: number;
    finalPrice: number;
    promoCodeValid: boolean;
    promoCodeMessage: string;
  } | null>(null);

  // Load event data
  useEffect(() => {
    async function loadEvent() {
      if (!id) {
        navigate("/dashboard");
        return;
      }

      try {
        const eventData = await eventsService.getEvent(id);
        setEvent(eventData);

        // Load initial purchase info without promo code
        const info = await eventsService.getEventPurchaseInfo(id);
        setPurchaseInfo(info);

        // Fetch available promo codes for this event
        try {
          const codes = await promoCodeService.getUserAvailableCodesForEvent(
            id
          );
          setAvailablePromoCodes(codes);
        } catch (error) {
          console.error("Error fetching promo codes:", error);
          // Non-critical error, continue without promo codes
        }
      } catch (err) {
        console.error("Error loading event:", err);
        notification.error("Failed to load event details");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [id, navigate, notification]);

  // Apply promo code (handler for PromoCodeInput)
  const handlePromoApply = async (code: string, _validatedCode: PromoCode) => {
    if (!id) return;

    setCheckingPromo(true);

    try {
      const info = await eventsService.getEventPurchaseInfo(id, code);
      setPurchaseInfo(info);
      setPromoCode(code);
      setPromoApplied(true);

      if (info.promoCodeValid) {
        notification.success(
          info.promoCodeMessage || "Promo code applied successfully!"
        );
      } else {
        notification.error(info.promoCodeMessage || "Invalid promo code");
        // Reset if validation failed
        setPromoCode("");
        setPromoApplied(false);
      }
    } catch (err) {
      console.error("Error applying promo code:", err);
      notification.error("Failed to apply promo code");
      setPromoCode("");
      setPromoApplied(false);
    } finally {
      setCheckingPromo(false);
    }
  };

  // Remove promo code (handler for PromoCodeInput)
  const handlePromoRemove = async () => {
    if (!id) return;

    setCheckingPromo(true);
    setPromoCode("");
    setPromoApplied(false);

    try {
      const info = await eventsService.getEventPurchaseInfo(id);
      setPurchaseInfo(info);
    } catch (err) {
      console.error("Error removing promo code:", err);
    } finally {
      setCheckingPromo(false);
    }
  };

  // Calculate promo discount amount for display
  const calculatePromoDiscountAmount = () => {
    if (!purchaseInfo) return 0;
    return purchaseInfo.discount;
  };

  // Proceed to Stripe checkout
  const handlePurchase = async () => {
    if (!id) return;

    setProcessing(true);

    try {
      const result = await eventsService.createEventPurchase(
        id,
        promoApplied ? promoCode.trim() : undefined
      );

      // Redirect to Stripe checkout
      window.location.href = result.sessionUrl;
    } catch (err) {
      console.error("Error creating purchase:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create purchase";
      notification.error(errorMessage);
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  if (!event || !purchaseInfo) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Event Not Found
        </h2>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-white rounded-lg shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <button
            onClick={() => navigate(`/dashboard/event/${id}`)}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
          >
            <Icon name="arrow-left" className="w-4 h-4" />
            <span>Back to Event</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Purchase Ticket
          </h1>
          <p className="text-gray-600">{event.title}</p>
        </div>

        {/* Event Details */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Event Details
          </h2>
          <div className="space-y-2 text-sm">
            {event.date && (
              <div className="flex items-start gap-2">
                <Icon
                  name="calendar"
                  className="w-4 h-4 text-gray-400 mt-0.5"
                />
                <span className="text-gray-700">
                  {new Date(event.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
            {event.time && (
              <div className="flex items-start gap-2">
                <Icon name="clock" className="w-4 h-4 text-gray-400 mt-0.5" />
                <span className="text-gray-700">{event.time}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-start gap-2">
                <Icon name="map-pin" className="w-4 h-4 text-gray-400 mt-0.5" />
                <span className="text-gray-700">{event.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Promo Code Section */}
        <div className="p-6 border-b border-gray-200">
          <PromoCodeInput
            programId={id || ""}
            availableCodes={availablePromoCodes}
            onApply={handlePromoApply}
            onRemove={handlePromoRemove}
            appliedCode={promoCode}
            appliedDiscount={calculatePromoDiscountAmount()}
            isLoading={checkingPromo || processing}
          />
        </div>

        {/* Price Breakdown */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Price Summary
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Ticket Price</span>
              <span>${(purchaseInfo.originalPrice / 100).toFixed(2)}</span>
            </div>
            {purchaseInfo.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-${(purchaseInfo.discount / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>${(purchaseInfo.finalPrice / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Purchase Button */}
        <div className="p-6">
          <button
            onClick={handlePurchase}
            disabled={processing}
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <LoadingSpinner inline size="sm" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Icon name="tag" className="w-5 h-5" />
                <span>Continue to Payment</span>
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 text-center mt-3">
            You will be redirected to our secure payment processor (Stripe)
          </p>
        </div>
      </div>
    </div>
  );
}

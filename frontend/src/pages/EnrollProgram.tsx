import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { programService, purchaseService } from "../services/api";
import { formatCurrency } from "../utils/currency";
import PromoCodeInput, {
  type PromoCode,
} from "../components/promo/PromoCodeInput";
import { promoCodeService } from "../services/promoCodeService";
import AlertModal from "../components/common/AlertModal";
import LoadingSpinner from "../components/common/LoadingSpinner";

interface Program {
  id: string;
  title: string;
  programType: string;
  introduction?: string;
  flyerUrl?: string;
  isFree: boolean;
  fullPriceTicket: number;
  classRepDiscount?: number;
  earlyBirdDiscount?: number;
  classRepLimit?: number;
  earlyBirdDeadline?: string;
}

export default function EnrollProgram() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClassRep, setIsClassRep] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [classRepSlotsAvailable, setClassRepSlotsAvailable] = useState(true);
  const [classRepCountInfo, setClassRepCountInfo] = useState<string>("");

  // Promo code state
  const [availablePromoCodes, setAvailablePromoCodes] = useState<PromoCode[]>(
    []
  );
  const [appliedPromoCode, setAppliedPromoCode] = useState<string>("");
  const [validatedPromoCode, setValidatedPromoCode] =
    useState<PromoCode | null>(null);

  // Alert modal state
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
    onClose?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  // Calculate if early bird discount applies
  const isEarlyBird = program?.earlyBirdDeadline
    ? new Date() <= new Date(program.earlyBirdDeadline)
    : false;

  // Calculate final price
  const calculatePrice = () => {
    if (!program) return 0;

    // Work in cents throughout - formatCurrency expects cents
    let priceInCents = program.fullPriceTicket;

    // Step 1: Apply fixed discounts (Class Rep and Early Bird are mutually exclusive)
    if (isClassRep && program.classRepDiscount) {
      priceInCents -= program.classRepDiscount;
    } else if (isEarlyBird && program.earlyBirdDiscount) {
      // Only apply Early Bird if NOT enrolling as Class Rep
      priceInCents -= program.earlyBirdDiscount;
    }

    // Step 2: Apply bundle discount (fixed amount) if promo code is bundle type
    if (
      validatedPromoCode &&
      validatedPromoCode.type === "bundle_discount" &&
      validatedPromoCode.discountAmount
    ) {
      priceInCents -= validatedPromoCode.discountAmount;
    }

    // Step 3: Apply percentage discount (staff_access or reward) AFTER fixed discounts
    // This matches backend logic: percentage applies to price after Class Rep/Early Bird
    if (
      validatedPromoCode &&
      (validatedPromoCode.type === "staff_access" ||
        validatedPromoCode.type === "reward") &&
      validatedPromoCode.discountPercent !== undefined
    ) {
      priceInCents = Math.round(
        priceInCents * (1 - validatedPromoCode.discountPercent / 100)
      );
    }

    // Return in cents (formatCurrency will handle conversion to dollars)
    return Math.max(0, priceInCents);
  };

  // Calculate promo discount amount for display (shows the actual discount applied)
  const calculatePromoDiscountAmount = () => {
    if (!program || !validatedPromoCode) return 0;

    // Calculate base price after Class Rep/Early Bird (same as Step 1 in calculatePrice)
    let basePriceInCents = program.fullPriceTicket;
    if (isClassRep && program.classRepDiscount) {
      basePriceInCents -= program.classRepDiscount;
    } else if (isEarlyBird && program.earlyBirdDiscount) {
      basePriceInCents -= program.earlyBirdDiscount;
    }

    // Bundle discount: fixed amount
    if (
      validatedPromoCode.type === "bundle_discount" &&
      validatedPromoCode.discountAmount
    ) {
      return validatedPromoCode.discountAmount;
    }

    // Percentage discount: calculate on base price
    if (
      (validatedPromoCode.type === "staff_access" ||
        validatedPromoCode.type === "reward") &&
      validatedPromoCode.discountPercent !== undefined
    ) {
      return Math.round(
        (basePriceInCents * validatedPromoCode.discountPercent) / 100
      );
    }

    return 0;
  };

  useEffect(() => {
    if (!id) return;

    const loadProgram = async () => {
      try {
        setLoading(true);
        const data = (await programService.getById(id)) as Program;
        setProgram(data);

        // Check if program is free
        if (data.isFree) {
          setAlertModal({
            isOpen: true,
            title: "Free Program",
            message: "This program is free and does not require enrollment.",
            type: "info",
            onClose: () => {
              setAlertModal((prev) => ({ ...prev, isOpen: false }));
              navigate(`/dashboard/programs/${id}`);
            },
          });
          return;
        }

        // Check Class Rep slots
        if (data.classRepLimit && data.classRepLimit > 0) {
          // In a real implementation, we'd call an API to get the current count
          // For now, we'll assume it's available
          setClassRepSlotsAvailable(true);
          setClassRepCountInfo(`${data.classRepLimit} slots available`);
        }

        // Fetch available promo codes for this program
        try {
          const codes = await promoCodeService.getUserAvailableCodesForProgram(
            id
          );
          setAvailablePromoCodes(codes);
        } catch (error) {
          console.error("Error fetching promo codes:", error);
          // Non-critical error, continue without promo codes
        }
      } catch (error) {
        console.error("Error loading program:", error);
        setAlertModal({
          isOpen: true,
          title: "Error Loading Program",
          message: "Failed to load program details.",
          type: "error",
          onClose: () => {
            setAlertModal((prev) => ({ ...prev, isOpen: false }));
            navigate("/dashboard/programs");
          },
        });
      } finally {
        setLoading(false);
      }
    };

    loadProgram();
  }, [id, navigate]);

  const handlePromoApply = (code: string, validatedCode: PromoCode) => {
    setAppliedPromoCode(code);
    setValidatedPromoCode(validatedCode);
  };

  const handlePromoRemove = () => {
    setAppliedPromoCode("");
    setValidatedPromoCode(null);
  };

  const handleEnroll = async () => {
    if (!program || !id) return;

    try {
      setIsProcessing(true);

      // Create checkout session with promo code if applied
      const response = await purchaseService.createCheckoutSession({
        programId: id,
        isClassRep,
        promoCode: appliedPromoCode || undefined,
      });

      const { sessionUrl, isFree, orderId } = response;

      // Handle free purchase (100% discount)
      if (isFree && orderId) {
        setAlertModal({
          isOpen: true,
          title: "Enrollment Complete! 🎉",
          message: `You've successfully enrolled in ${program.title} with 100% discount! Your order number is ${orderId}.`,
          type: "success",
          onClose: () => {
            setAlertModal((prev) => ({ ...prev, isOpen: false }));
            navigate("/dashboard/purchase-history");
          },
        });
        setIsProcessing(false);
        return;
      }

      // Redirect to Stripe Checkout for paid purchases
      if (sessionUrl) {
        window.location.href = sessionUrl;
      } else {
        throw new Error("Failed to get checkout URL");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to start checkout process. Please try again.";

      // Check for Early Bird expiration error
      const isEarlyBirdExpired = message.includes(
        "Early Bird discount period has expired"
      );

      // Determine modal type based on error message
      const isClassRepFull = message.includes("Class Rep slots are full");

      setAlertModal({
        isOpen: true,
        title: isEarlyBirdExpired
          ? "Early Bird Period Expired"
          : isClassRepFull
          ? "Class Rep Slots Full"
          : "Checkout Error",
        message: message,
        type: isEarlyBirdExpired || isClassRepFull ? "warning" : "error",
        onClose: () => {
          setAlertModal((prev) => ({ ...prev, isOpen: false }));
          // If Early Bird expired, reload the page to refresh pricing
          if (isEarlyBirdExpired) {
            window.location.reload();
          }
        },
      });
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  if (!program) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-gray-600">Program not found.</p>
      </div>
    );
  }

  const finalPrice = calculatePrice();

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="enrollment-page">
      {/* Program Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Enroll in {program.title}
            </h1>
            <p className="text-sm text-gray-500">{program.programType}</p>
          </div>
          <button
            onClick={() => navigate(`/dashboard/programs/${id}`)}
            className="text-gray-600 hover:text-gray-800"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {program.flyerUrl && (
          <img
            src={program.flyerUrl}
            alt={program.title}
            className="w-full max-h-64 object-contain rounded-lg mb-4"
          />
        )}
      </div>

      {/* Early Bird Notice */}
      {isEarlyBird &&
        program.earlyBirdDiscount &&
        program.earlyBirdDiscount > 0 &&
        !isClassRep && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-800 font-medium">
                🎉 Early Bird Discount Available! Save{" "}
                {formatCurrency(program.earlyBirdDiscount)}
              </span>
            </div>
            <p className="text-sm text-green-700 mt-1 ml-7">
              Deadline:{" "}
              {new Date(program.earlyBirdDeadline!).toLocaleDateString()}
            </p>
          </div>
        )}

      {/* Class Rep Mutually Exclusive Notice */}
      {isClassRep &&
        isEarlyBird &&
        program.earlyBirdDiscount &&
        program.earlyBirdDiscount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-amber-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-amber-800 font-medium">
                Early Bird discount not applicable when enrolling as Class
                Representative
              </span>
            </div>
            <p className="text-sm text-amber-700 mt-1 ml-7">
              You'll receive the Class Rep discount of{" "}
              {formatCurrency(program.classRepDiscount || 0)} instead.
            </p>
          </div>
        )}

      {/* Enrollment Options */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Enrollment Options
        </h2>

        {/* Class Rep Option */}
        {program.classRepDiscount &&
          program.classRepDiscount > 0 &&
          classRepSlotsAvailable && (
            <div className="mb-6">
              <label className="flex items-start cursor-pointer group">
                <div className="flex items-center h-6">
                  <input
                    type="checkbox"
                    checked={isClassRep}
                    onChange={(e) => setIsClassRep(e.target.checked)}
                    className="h-5 w-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="ml-3">
                  <span className="text-lg font-medium text-gray-900 group-hover:text-purple-600">
                    Enroll as Class Representative
                  </span>
                  <p className="text-sm text-gray-600 mt-1">
                    Save {formatCurrency(program.classRepDiscount)} as a Class
                    Rep.
                    {classRepCountInfo && (
                      <span className="ml-2 text-purple-600 font-medium">
                        ({classRepCountInfo})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Class Reps help coordinate and support their cohort
                    throughout the program.
                  </p>
                </div>
              </label>
            </div>
          )}

        {/* Promo Code Section */}
        <div className="mb-6">
          <PromoCodeInput
            programId={id || ""}
            availableCodes={availablePromoCodes}
            onApply={handlePromoApply}
            onRemove={handlePromoRemove}
            appliedCode={appliedPromoCode}
            appliedDiscount={calculatePromoDiscountAmount()}
            isLoading={isProcessing}
          />
        </div>

        {/* Pricing Breakdown */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Pricing Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Full Price</span>
              <span>{formatCurrency(program.fullPriceTicket)}</span>
            </div>
            {isClassRep &&
              program.classRepDiscount &&
              program.classRepDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Class Rep Discount</span>
                  <span>- {formatCurrency(program.classRepDiscount)}</span>
                </div>
              )}
            {!isClassRep &&
              isEarlyBird &&
              program.earlyBirdDiscount &&
              program.earlyBirdDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Early Bird Discount</span>
                  <span>- {formatCurrency(program.earlyBirdDiscount)}</span>
                </div>
              )}
            {validatedPromoCode && calculatePromoDiscountAmount() > 0 && (
              <div className="flex justify-between text-blue-600 font-medium">
                <span>
                  Promo Code Discount
                  {appliedPromoCode && (
                    <span className="text-sm ml-2">({appliedPromoCode})</span>
                  )}
                </span>
                <span>- {formatCurrency(calculatePromoDiscountAmount())}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex justify-between text-xl font-bold text-gray-900">
                <span>Total</span>
                <span className="text-purple-600">
                  {formatCurrency(finalPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
        <button
          onClick={() => navigate(`/dashboard/programs/${id}`)}
          className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          onClick={handleEnroll}
          disabled={isProcessing}
          className="px-6 py-3 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </span>
          ) : (
            `Proceed to Payment - ${formatCurrency(finalPrice)}`
          )}
        </button>
      </div>

      {/* Payment Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-600 text-center">
          🔒 Secure payment powered by Stripe. Your payment information is
          encrypted and secure.
        </p>
      </div>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => {
          if (alertModal.onClose) {
            alertModal.onClose();
          } else {
            setAlertModal((prev) => ({ ...prev, isOpen: false }));
          }
        }}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}

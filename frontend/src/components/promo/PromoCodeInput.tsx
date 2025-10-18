import { useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { promoCodeService } from "../../services/promoCodeService";

export interface PromoCode {
  code: string;
  type: "bundle_discount" | "staff_access";
  discountAmount?: number;
  discountPercent?: number;
  expiresAt?: string;
  isUsed: boolean;
}

export interface PromoCodeInputProps {
  programId?: string; // Optional, for backend validation
  availableCodes: PromoCode[];
  onApply: (code: string, discount: number) => void;
  onRemove: () => void;
  appliedCode?: string;
  appliedDiscount?: number;
  isLoading?: boolean;
}

export default function PromoCodeInput({
  programId,
  availableCodes,
  onApply,
  onRemove,
  appliedCode,
  appliedDiscount,
  isLoading = false,
}: PromoCodeInputProps) {
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [manualCode, setManualCode] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);

  // Filter out used codes
  const validCodes = availableCodes.filter((code) => !code.isUsed);

  const handleRadioSelect = (code: string) => {
    setSelectedCode(code);
    setManualCode(""); // Clear manual input
    setError("");
  };

  const handleManualChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setManualCode(upperValue);
    setSelectedCode(""); // Clear radio selection
    setError("");
  };

  const handleApply = async () => {
    const codeToApply = selectedCode || manualCode.trim();

    if (!codeToApply) {
      setError("Please select or enter a promo code");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      // Check if code is in available codes (quick client-side check)
      const foundCode = validCodes.find((c) => c.code === codeToApply);

      if (foundCode) {
        // Code is in user's available codes - apply directly
        const discount =
          foundCode.discountAmount || foundCode.discountPercent || 0;
        onApply(codeToApply, discount);
      } else if (programId) {
        // Code not in available codes - validate with service (for staff codes, etc.)
        const result = await promoCodeService.validatePromoCode(
          codeToApply,
          programId
        );

        if (result.valid && result.discount) {
          const discount = result.discount.value;
          onApply(codeToApply, discount);
        } else {
          setError(result.message || "Invalid promo code");
        }
      } else {
        // No programId provided for validation
        setError("Invalid promo code or code has already been used");
      }
    } catch {
      setError("Failed to validate promo code. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = () => {
    setSelectedCode("");
    setManualCode("");
    setError("");
    onRemove();
  };

  const formatExpiryText = (expiresAt?: string) => {
    if (!expiresAt) return "No expiration";

    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Expired";
    if (diffDays === 0) return "Expires today";
    if (diffDays === 1) return "Expires tomorrow";
    return `Expires in ${diffDays} days`;
  };

  // If code is already applied, show success state
  if (appliedCode && appliedDiscount !== undefined) {
    return (
      <div className="bg-green-50 border-2 border-green-400 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-green-900">
                  Promo code applied!
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="font-mono font-bold text-lg text-green-800 tracking-wider">
                  {appliedCode}
                </code>
                <span className="text-green-700">
                  {appliedDiscount >= 100
                    ? "100% OFF"
                    : `$${appliedDiscount} OFF`}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleRemove}
            disabled={isLoading}
            className="text-sm text-green-700 hover:text-green-900 font-medium underline disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Remove Code
          </button>
        </div>
      </div>
    );
  }

  // Show input interface
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <TagIcon className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Have a promo code?
        </h3>
      </div>

      {/* Available Codes */}
      {validCodes.length > 0 && (
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Your Available Codes ({validCodes.length} available)
          </label>
          <div className="space-y-2">
            {validCodes.map((code) => (
              <label
                key={code.code}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedCode === code.code
                    ? "border-blue-500 bg-white shadow-md"
                    : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                }`}
              >
                <input
                  type="radio"
                  name="promoCode"
                  value={code.code}
                  checked={selectedCode === code.code}
                  onChange={() => handleRadioSelect(code.code)}
                  disabled={isLoading || isValidating}
                  className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono font-bold text-gray-900 text-base tracking-wider">
                      {code.code}
                    </span>
                    <span className="text-blue-700 font-semibold">
                      (
                      {code.discountAmount
                        ? `$${code.discountAmount} OFF`
                        : `${code.discountPercent}% OFF`}
                      )
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                    <span>
                      {code.type === "bundle_discount"
                        ? "🎁 Bundle Discount"
                        : "🎟️ Staff Access"}
                    </span>
                    <span>•</span>
                    <span>{formatExpiryText(code.expiresAt)}</span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {validCodes.length > 0 && (
        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gradient-to-br from-blue-50 to-indigo-50 px-3 text-sm text-gray-500 font-medium">
              OR
            </span>
          </div>
        </div>
      )}

      {/* Manual Input */}
      <div className="mb-4">
        <label
          htmlFor="manualPromoCode"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Enter code manually
        </label>
        <div className="flex gap-2">
          <input
            id="manualPromoCode"
            type="text"
            value={manualCode}
            onChange={(e) => handleManualChange(e.target.value)}
            disabled={isLoading || isValidating}
            placeholder="e.g., X8K9P2L4"
            maxLength={20}
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase placeholder:normal-case disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleApply}
            disabled={
              isLoading || isValidating || (!selectedCode && !manualCode.trim())
            }
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500 whitespace-nowrap"
          >
            {isValidating ? "Validating..." : "Apply"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Help Text */}
      {!error && validCodes.length === 0 && (
        <div className="text-sm text-gray-600">
          <p>
            💡 Don't have a promo code? You'll receive one after your first
            purchase!
          </p>
        </div>
      )}
    </div>
  );
}

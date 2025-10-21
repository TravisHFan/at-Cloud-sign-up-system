import { useState } from "react";
import {
  GiftIcon,
  ClipboardDocumentIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import { formatMockExpiryText } from "../../mocks/promoCodes";

export interface BundlePromoCodeCardProps {
  code: string;
  discountAmount: number; // Dollar amount (e.g., 50 for $50 off)
  expiresAt: string; // ISO date string
  onCopy?: () => void;
  onBrowsePrograms?: () => void;
}

export default function BundlePromoCodeCard({
  code,
  discountAmount,
  expiresAt,
  onCopy,
  onBrowsePrograms,
}: BundlePromoCodeCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopy?.();

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  const handleBrowsePrograms = () => {
    onBrowsePrograms?.();
  };

  const expiryText = formatMockExpiryText(expiresAt);

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Celebration Card with Purple Gradient */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 border-2 border-purple-400 shadow-lg">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200 rounded-full opacity-20 -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-200 rounded-full opacity-20 -ml-12 -mb-12"></div>

        <div className="relative p-6 sm:p-8">
          {/* Header with Icon */}
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-lg">
              <GiftIcon className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
              🎉 Congratulations!
            </h3>
            <p className="text-xs sm:text-sm text-gray-700">
              You've earned a bundle discount promo code!
            </p>
          </div>

          {/* Discount Amount - Large Display */}
          <div className="text-center mb-4">
            <div className="inline-block bg-white/80 backdrop-blur-sm rounded-xl px-5 py-2.5 shadow-md border border-purple-200">
              <div className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                ${discountAmount.toFixed(2)}
              </div>
              <div className="text-[10px] sm:text-xs font-semibold text-gray-600 mt-0.5 uppercase tracking-wide">
                OFF YOUR NEXT PURCHASE
              </div>
            </div>
          </div>

          {/* Promo Code Display */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 text-center">
              Your Promo Code
            </label>
            <div className="flex items-stretch justify-center gap-2">
              <div className="flex-1 max-w-xs">
                <div className="bg-white rounded-lg px-3 py-2.5 border-2 border-purple-300 shadow-inner h-full">
                  <div
                    className="font-mono text-lg sm:text-xl font-bold text-center text-gray-900 tracking-[0.15em] select-all"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    {code}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center justify-center px-4 py-2.5 rounded-lg transition-all duration-200 flex-shrink-0 ${
                  copied
                    ? "bg-green-500 text-white shadow-lg scale-110"
                    : "bg-purple-500 hover:bg-purple-600 text-white shadow-md hover:shadow-lg hover:scale-105"
                }`}
                title={copied ? "Copied!" : "Copy code"}
              >
                {copied ? (
                  <CheckIcon className="w-6 h-6" />
                ) : (
                  <ClipboardDocumentIcon className="w-6 h-6" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-center text-xs font-medium text-green-600 mt-1.5">
                ✓ Code copied to clipboard!
              </p>
            )}
          </div>

          {/* Expiry Information */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <ClockIcon className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">
                {expiryText}
              </span>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 mb-4 border border-purple-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
              <span className="text-base">📌</span>
              How to Use Your Code
            </h4>
            <ul className="space-y-1.5 text-xs text-gray-700">
              <li className="flex items-start gap-1.5">
                <span className="text-purple-500 font-bold mt-0.5">1.</span>
                <span>
                  Browse available programs and find one you'd like to enroll in
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-purple-500 font-bold mt-0.5">2.</span>
                <span>
                  Enter this promo code at checkout to apply your discount
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-purple-500 font-bold mt-0.5">3.</span>
                <span>
                  This code is valid for any program and can be used once
                </span>
              </li>
            </ul>
          </div>

          {/* Action Button */}
          <div className="text-center">
            <button
              onClick={handleBrowsePrograms}
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <GiftIcon className="w-4 h-4 mr-1.5" />
              Browse Programs & Use Code
            </button>
          </div>

          {/* Footer Note */}
          <div className="text-center mt-4">
            <p className="text-[10px] text-gray-500">
              You can also find this code anytime in your{" "}
              <a
                href="/dashboard/promo-codes"
                className="text-purple-600 hover:text-purple-700 font-medium underline"
              >
                My Promo Codes
              </a>{" "}
              page.
            </p>
          </div>
        </div>
      </div>

      {/* Additional Information Card */}
      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <div className="flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full">
              <span className="text-white text-[10px] font-bold">i</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-blue-900 mb-0.5">
              💡 Why did I receive this code?
            </p>
            <p className="text-xs text-blue-800">
              As a thank you for your purchase, we've given you this bundle
              discount code to save on your next program enrollment. Share the
              value of our programs with others, and enjoy the savings yourself!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

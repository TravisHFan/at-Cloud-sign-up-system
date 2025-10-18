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
    <div className="w-full max-w-2xl mx-auto">
      {/* Celebration Card with Purple Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 border-2 border-purple-400 shadow-xl">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-200 rounded-full opacity-20 -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-200 rounded-full opacity-20 -ml-16 -mb-16"></div>

        <div className="relative p-8 sm:p-10">
          {/* Header with Icon */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-lg">
              <GiftIcon className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              🎉 Congratulations!
            </h3>
            <p className="text-base sm:text-lg text-gray-700">
              You've earned a bundle discount promo code!
            </p>
          </div>

          {/* Discount Amount - Large Display */}
          <div className="text-center mb-6">
            <div className="inline-block bg-white/80 backdrop-blur-sm rounded-2xl px-8 py-4 shadow-md border border-purple-200">
              <div className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                ${discountAmount}
              </div>
              <div className="text-sm sm:text-base font-semibold text-gray-600 mt-1 uppercase tracking-wide">
                OFF YOUR NEXT PURCHASE
              </div>
            </div>
          </div>

          {/* Promo Code Display */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">
              Your Promo Code
            </label>
            <div className="flex items-center justify-center gap-3">
              <div className="flex-1 max-w-md">
                <div className="bg-white rounded-xl px-6 py-4 border-2 border-purple-300 shadow-inner">
                  <div
                    className="font-mono text-2xl sm:text-3xl font-bold text-center text-gray-900 tracking-[0.15em] select-all"
                    style={{ fontFamily: '"Courier New", monospace' }}
                  >
                    {code}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${
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
              <p className="text-center text-sm font-medium text-green-600 mt-2">
                ✓ Code copied to clipboard!
              </p>
            )}
          </div>

          {/* Expiry Information */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <ClockIcon className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                {expiryText}
              </span>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 mb-6 border border-purple-200">
            <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-xl">📌</span>
              How to Use Your Code
            </h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-purple-500 font-bold mt-0.5">1.</span>
                <span>
                  Browse available programs and find one you'd like to enroll in
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 font-bold mt-0.5">2.</span>
                <span>
                  Enter this promo code at checkout to apply your discount
                </span>
              </li>
              <li className="flex items-start gap-2">
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
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <GiftIcon className="w-5 h-5 mr-2" />
              Browse Programs & Use Code
            </button>
          </div>

          {/* Footer Note */}
          <div className="text-center mt-6">
            <p className="text-xs text-gray-500">
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
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
              <span className="text-white text-xs font-bold">i</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 mb-1">
              💡 Why did I receive this code?
            </p>
            <p className="text-sm text-blue-800">
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

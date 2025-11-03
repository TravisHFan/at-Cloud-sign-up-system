import { useState, useEffect } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  LightBulbIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { apiClient } from "../../../services/api";
import Button from "../../ui/Button";
import LoadingSpinner from "../../common/LoadingSpinner";

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface BundleDiscountConfig {
  enabled: boolean;
  discountAmount: number;
  expiryDays: number;
}

interface BundleConfigManagerProps {
  onConfigChange?: (config: BundleDiscountConfig) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export default function BundleConfigManager({
  onConfigChange,
}: BundleConfigManagerProps) {
  // State
  const [config, setConfig] = useState<BundleDiscountConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form state (local edits before save)
  const [formEnabled, setFormEnabled] = useState(false);
  const [formAmount, setFormAmount] = useState(5000); // $50 in cents
  const [formExpiry, setFormExpiry] = useState(30);

  // Load current config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiClient.getBundleDiscountConfig();
      setConfig(data.config);
      setFormEnabled(data.config.enabled);
      setFormAmount(data.config.discountAmount);
      setFormExpiry(data.config.expiryDays);
    } catch (err) {
      console.error("Failed to load bundle config:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load configuration"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const newConfig = {
        enabled: formEnabled,
        discountAmount: formAmount,
        expiryDays: formExpiry,
      };

      await apiClient.updateBundleDiscountConfig(newConfig);

      setSuccessMessage("Bundle discount configuration saved successfully!");
      // Reload to get fresh data
      await loadConfig();

      // Notify parent if callback provided
      if (onConfigChange) {
        onConfigChange(newConfig);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Failed to save bundle config:", err);
      setError(
        err instanceof Error ? err.message : "Failed to save configuration"
      );
    } finally {
      setSaving(false);
    }
  };

  // Format amount for display
  const formatAmount = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Bundle Discount Settings
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure automatic promo codes generated after purchases
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Success Display */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-base font-medium text-gray-900">
              Enable Bundle Codes
            </label>
            <p className="text-base text-gray-600 mt-1">
              Automatically generate promo codes after each purchase
            </p>
          </div>
          <button
            onClick={() => setFormEnabled(!formEnabled)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors border border-gray-600 focus:outline-none p-0.5 ${
              formEnabled ? "bg-green-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                formEnabled ? "translate-x-[22px]" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Discount Amount Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-base font-medium text-gray-900">
              Discount Amount
            </label>
            <span className="text-lg font-semibold text-purple-600">
              {formatAmount(formAmount)}
            </span>
          </div>
          <input
            type="range"
            min="1000"
            max="20000"
            step="500"
            value={formAmount}
            onChange={(e) => setFormAmount(Number(e.target.value))}
            disabled={!formEnabled}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
              formEnabled
                ? "bg-purple-200 accent-purple-600"
                : "bg-gray-200 cursor-not-allowed"
            }`}
          />
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>$10</span>
            <span>$200</span>
          </div>
          <p className="text-base text-gray-600 mt-2">
            Each bundle code will offer {formatAmount(formAmount)} off
          </p>
        </div>

        {/* Expiry Days Dropdown */}
        <div>
          <label className="text-base font-medium text-gray-900 block mb-2">
            Code Expiration
          </label>
          <select
            value={formExpiry}
            onChange={(e) => setFormExpiry(Number(e.target.value))}
            disabled={!formEnabled}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-base ${
              formEnabled
                ? "bg-white text-gray-900"
                : "bg-gray-100 text-gray-500 cursor-not-allowed"
            }`}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <p className="text-base text-gray-600 mt-2">
            Bundle codes will expire {formExpiry} days after purchase
          </p>
        </div>

        {/* Preview Section */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
            <ClipboardDocumentListIcon className="w-4 h-4 mr-2" />
            Current Configuration Preview
          </h3>
          <div className="space-y-2 text-base">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span
                className={`font-medium flex items-center ${
                  formEnabled ? "text-green-600" : "text-gray-500"
                }`}
              >
                {formEnabled ? (
                  <>
                    <CheckCircleIcon className="w-4 h-4 mr-1" />
                    Enabled
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-4 h-4 mr-1" />
                    Disabled
                  </>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Discount Amount:</span>
              <span className="font-medium text-gray-900">
                {formatAmount(formAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Valid For:</span>
              <span className="font-medium text-gray-900">
                {formExpiry} days
              </span>
            </div>
            {formEnabled && (
              <div className="mt-3 pt-3 border-t border-purple-300">
                <p className="text-sm text-gray-700 italic flex items-start">
                  <LightBulbIcon className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0 text-purple-600" />
                  <span>
                    When a user completes a purchase, they will automatically
                    receive a{" "}
                    <strong className="text-purple-700">
                      {formatAmount(formAmount)} promo code
                    </strong>{" "}
                    that expires in <strong>{formExpiry} days</strong>.
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !config}
            className="px-6"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
              <span className="text-white text-xs font-bold">i</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              How Bundle Codes Work
            </h3>
            <ul className="text-base text-gray-700 space-y-1">
              <li>
                • Bundle codes are automatically generated when users complete a
                purchase
              </li>
              <li>
                • Each code provides a fixed discount amount (set above) off
                their next purchase
              </li>
              <li>
                • Codes can be used on any program and are single-use only
              </li>
              <li>• Users can view their codes on the "My Promo Codes" page</li>
              <li>
                • Codes expire after the configured number of days (set above)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

import type {
  UseFormRegister,
  UseFormWatch,
  UseFormSetValue,
  FieldErrors,
} from "react-hook-form";
import { useEffect, useState } from "react";
import type { EventFormData } from "../../schemas/eventSchema";

interface PricingSectionProps {
  register: UseFormRegister<EventFormData>;
  errors: FieldErrors<EventFormData>;
  watch: UseFormWatch<EventFormData>;
  setValue: UseFormSetValue<EventFormData>;
  isEditMode?: boolean; // True for EditEvent, false for CreateEvent
}

/**
 * PricingSection Component
 *
 * Handles event pricing configuration for paid events feature.
 * - Radio buttons: Free (default) vs Paid event
 * - Price input field (visible when Paid selected)
 * - Validation: $1 minimum, $10,000 maximum
 * - Displays price in dollars, stores in cents
 *
 * Phase 5 - Paid Events Feature
 */
export default function PricingSection({
  errors,
  watch,
  setValue,
  isEditMode = false,
}: PricingSectionProps) {
  // Watch pricing fields - use type assertion to access nested fields
  const pricing = watch("pricing") as
    | { isFree?: boolean; price?: number }
    | undefined;
  const pricingIsFree = pricing?.isFree;
  const pricingPrice = pricing?.price;

  // Local state for dollar display
  const [priceInDollars, setPriceInDollars] = useState<string>("");

  // Initialize pricing values on mount (defaults to free)
  useEffect(() => {
    if (pricingIsFree === undefined) {
      setValue("pricing", { isFree: true }, { shouldDirty: false });
    }
    // If editing and there's a price, convert cents to dollars for display
    if (isEditMode && pricingPrice && pricingPrice > 0) {
      setPriceInDollars((pricingPrice / 100).toFixed(2));
    }
  }, [isEditMode, pricingIsFree, pricingPrice, setValue]);

  // Handle free/paid radio selection
  const handlePricingTypeChange = (isFree: boolean) => {
    setValue(
      "pricing",
      { isFree, price: isFree ? undefined : pricingPrice },
      {
        shouldDirty: true,
        shouldValidate: true,
      }
    );

    if (isFree) {
      // Clear price when switching to free
      setPriceInDollars("");
    }
  };

  // Handle price input change (converts dollars to cents)
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPriceInDollars(value);

    // Convert dollars to cents for storage
    const dollars = parseFloat(value);
    if (!isNaN(dollars) && dollars > 0) {
      const cents = Math.round(dollars * 100);
      setValue(
        "pricing",
        { isFree: false, price: cents },
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      );
    } else {
      setValue(
        "pricing",
        { isFree: false, price: undefined },
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">Event Pricing</h3>

      {/* Free vs Paid Radio Buttons */}
      <div className="mb-4">
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-2">
            Is this a paid event?
          </legend>

          <div className="space-y-3">
            {/* Free Option */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                checked={pricingIsFree === true}
                onChange={() => handlePricingTypeChange(true)}
                className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                  Free Event
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  No ticket purchase required. All users can register directly.
                </p>
              </div>
            </label>

            {/* Paid Option */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                checked={pricingIsFree === false}
                onChange={() => handlePricingTypeChange(false)}
                className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                  Paid Event
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Requires ticket purchase. Users must buy tickets before
                  accessing event details.
                </p>
              </div>
            </label>
          </div>
        </fieldset>
      </div>

      {/* Price Input (visible when Paid selected) */}
      {pricingIsFree === false && (
        <div className="mt-4 pl-7">
          <label
            htmlFor="pricing.price"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Ticket Price <span className="text-red-500">*</span>
          </label>

          <div className="relative max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 text-sm">$</span>
            </div>
            <input
              id="pricing.price"
              type="number"
              min="1"
              max="10000"
              step="0.01"
              value={priceInDollars}
              onChange={handlePriceChange}
              placeholder="25.00"
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <p className="mt-1 text-xs text-gray-500">
            Minimum $1.00, maximum $10,000.00. Enter amount in dollars (e.g.,
            25.00).
          </p>

          {/* Price validation error */}
          {errors.pricing?.price && (
            <p className="mt-1 text-sm text-red-600">
              {errors.pricing.price.message}
            </p>
          )}

          {/* Additional info for paid events */}
          <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Organizers, co-organizers, and users
              enrolled in the event's associated programs will have free access.
              All other users must purchase a ticket.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

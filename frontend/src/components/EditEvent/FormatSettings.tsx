import React from "react";
import type {
  UseFormRegister,
  FieldErrors,
  UseFormWatch,
} from "react-hook-form";
import ValidationIndicator from "../events/ValidationIndicator";
import type { EventValidationState } from "../../utils/eventValidationUtils";
import { PUBLISH_FIELD_LABELS } from "../../types/event";

interface FormatSettingsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: UseFormWatch<any>;
  validations: EventValidationState;
  eventData: {
    publish?: boolean;
    format?: string;
  } | null;
  formatWarningMissing: string[];
}

/**
 * FormatSettings Component
 *
 * Handles format selection with conditional fields based on the selected format:
 * - Format dropdown (Hybrid/In-person/Online) with predictive warning banner
 * - Location field (required for Hybrid/In-person)
 * - Zoom Information section (for Online/Hybrid): zoomLink, meetingId, passcode
 * - Disclaimer textarea
 *
 * @component
 */
const FormatSettings: React.FC<FormatSettingsProps> = ({
  register,
  errors,
  watch,
  validations,
  eventData,
  formatWarningMissing,
}) => {
  const selectedFormat = watch("format");

  return (
    <>
      {/* Format Dropdown */}
      <div>
        <label
          htmlFor="format"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Format <span className="text-red-500">*</span>
        </label>
        <select
          id="format"
          {...register("format")}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select format</option>
          <option value="Hybrid Participation">Hybrid Participation</option>
          <option value="In-person">In-person</option>
          <option value="Online">Online</option>
        </select>
        <ValidationIndicator validation={validations.format} />
        {errors.format && (
          <p className="mt-1 text-sm text-red-600">
            {String(errors.format.message)}
          </p>
        )}

        {/* Predictive format switch unpublish warning */}
        {eventData?.publish &&
          eventData.format &&
          selectedFormat &&
          selectedFormat !== eventData.format &&
          formatWarningMissing.length > 0 && (
            <div
              className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex flex-col gap-1"
              data-testid="format-switch-warning"
            >
              <div className="font-medium flex items-center gap-2">
                <span className="inline-block bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded text-xs uppercase tracking-wide">
                  Warning
                </span>
                48-Hour Grace Period Starts
              </div>
              <div>
                The selected format <strong>{selectedFormat}</strong> requires
                the following missing field(s):{" "}
                {formatWarningMissing
                  .map((f) => PUBLISH_FIELD_LABELS[f] || f)
                  .join(", ")}
                . The event will be{" "}
                <strong>automatically unpublished after 48 hours</strong> if
                these fields are not added.
              </div>
            </div>
          )}
      </div>

      {/* Conditional Location Field */}
      {(selectedFormat === "Hybrid Participation" ||
        selectedFormat === "In-person") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location <span className="text-red-500">*</span>
          </label>
          <input
            {...register("location")}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter event location"
          />
          <ValidationIndicator validation={validations.location} />
          {errors.location && (
            <p className="mt-1 text-sm text-red-600">
              {String(errors.location.message)}
            </p>
          )}
        </div>
      )}

      {/* Conditional Zoom Information Fields */}
      {(selectedFormat === "Hybrid Participation" ||
        selectedFormat === "Online") && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Zoom Information
          </h3>

          {/* Zoom Link (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zoom Link
            </label>
            <input
              {...register("zoomLink")}
              type="url"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter Zoom meeting link (optional - can be added later)"
            />
            <ValidationIndicator validation={validations.zoomLink} />
            {errors.zoomLink && (
              <p className="mt-1 text-sm text-red-600">
                {String(errors.zoomLink.message)}
              </p>
            )}
          </div>

          {/* Meeting ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting ID
            </label>
            <input
              {...register("meetingId")}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter Meeting ID (optional)"
            />
          </div>

          {/* Passcode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Passcode
            </label>
            <input
              {...register("passcode")}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter passcode (optional)"
            />
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Disclaimer Terms
        </label>
        <textarea
          {...register("disclaimer")}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter disclaimer terms and conditions (optional)"
        />
        {errors.disclaimer && (
          <p className="mt-1 text-sm text-red-600">
            {String(errors.disclaimer.message)}
          </p>
        )}
      </div>
    </>
  );
};

export default FormatSettings;

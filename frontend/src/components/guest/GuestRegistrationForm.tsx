import React, { useEffect, useState } from "react";
import { formatPhoneInput, normalizePhoneForSubmit } from "../../utils/phone";
import GuestApi, { type GuestSignupPayload } from "../../services/guestApi";
import { friendlyGuestError } from "../../utils/errorMessages";

interface Props {
  eventId: string;
  roleId: string;
  onSuccess?: (data: any) => void;
}

export const GuestRegistrationForm: React.FC<Props> = ({
  eventId,
  roleId,
  onSuccess,
}) => {
  const [form, setForm] = useState<GuestSignupPayload>({
    roleId,
    fullName: "",
    email: "",
    gender: undefined as any, // start empty; UI requires user to choose before submit
    phone: "",
    notes: "",
  });

  // Keep internal roleId synchronized with prop updates (e.g., when user changes dropdown)
  useEffect(() => {
    setForm((prev) => (prev.roleId === roleId ? prev : { ...prev, roleId }));
  }, [roleId]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update =
    (key: keyof GuestSignupPayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const raw = e.target.value;
      // Soft-sanitize phone input only
      const value = key === "phone" ? formatPhoneInput(raw) : raw;
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Validate before toggling submitting state so early returns don't leave it stuck
    // Enforce required gender selection in UI
    if (form.gender !== "male" && form.gender !== "female") {
      setError("Please select your gender.");
      return;
    }
    // Enforce phone required in UI to match backend validator
    if (!form.phone || String(form.phone).trim().length === 0) {
      setError("Please provide your phone number.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: GuestSignupPayload = {
        // Always submit the latest selected roleId from props to avoid stale state
        ...(form as GuestSignupPayload),
        roleId,
        phone: normalizePhoneForSubmit(form.phone),
      };
      const data = await GuestApi.signup(eventId, payload);
      onSuccess?.(data);
    } catch (err: any) {
      setError(friendlyGuestError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-6">
      {error && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Personal Information Section */}
      <div className="space-y-4">
        <div className="pb-2 border-b border-gray-200">
          <h4 className="text-lg font-medium text-gray-900 flex items-center">
            <svg
              className="w-5 h-5 text-gray-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Personal Information
          </h4>
        </div>

        {/* Full Name */}
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-2"
            htmlFor="guest-fullname"
          >
            Full Name *
          </label>
          <div className="relative">
            <input
              id="guest-fullname"
              type="text"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors pl-12"
              value={form.fullName}
              onChange={update("fullName")}
              placeholder="Enter your full name"
              required
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Gender */}
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-2"
            htmlFor="guest-gender"
          >
            Gender *
          </label>
          <div className="relative">
            <select
              id="guest-gender"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none cursor-pointer pl-12"
              value={form.gender || ""}
              onChange={update("gender")}
              required
            >
              <option value="" disabled>
                Select your gender
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information Section */}
      <div className="space-y-4">
        <div className="pb-2 border-b border-gray-200">
          <h4 className="text-lg font-medium text-gray-900 flex items-center">
            <svg
              className="w-5 h-5 text-gray-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Contact Information
          </h4>
        </div>

        {/* Email */}
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-2"
            htmlFor="guest-email"
          >
            Email Address *
          </label>
          <div className="relative">
            <input
              id="guest-email"
              type="email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors pl-12"
              value={form.email}
              onChange={update("email")}
              placeholder="Enter your email address"
              required
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            We'll send confirmation and event updates to this email
          </p>
        </div>

        {/* Phone */}
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-2"
            htmlFor="guest-phone"
          >
            Phone Number *
          </label>
          <div className="relative">
            <input
              id="guest-phone"
              type="tel"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors pl-12"
              value={form.phone || ""}
              onChange={update("phone")}
              placeholder="Enter your phone number"
              required
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            For event coordinators to contact you if needed
          </p>
        </div>
      </div>

      {/* Additional Information Section */}
      <div className="space-y-4">
        <div className="pb-2 border-b border-gray-200">
          <h4 className="text-lg font-medium text-gray-900 flex items-center">
            <svg
              className="w-5 h-5 text-gray-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z"
              />
            </svg>
            Additional Information
          </h4>
        </div>

        {/* Notes */}
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-2"
            htmlFor="guest-notes"
          >
            Additional Notes <span className="text-gray-400">(Optional)</span>
          </label>
          <div className="relative">
            <textarea
              id="guest-notes"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors pl-12 resize-none"
              value={form.notes || ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Any special requirements, dietary restrictions, or additional information..."
            />
            <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {submitting ? (
            <div className="flex items-center justify-center">
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
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Submitting Registration...
            </div>
          ) : (
            <div className="flex items-center justify-center">
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
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              Join as Guest
            </div>
          )}
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-gray-400 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-xs text-gray-600">
              <strong>Privacy Notice:</strong> Your information will only be
              used for this event and related communications. We won't share
              your details with third parties or add you to marketing lists
              without your consent.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
};

export default GuestRegistrationForm;

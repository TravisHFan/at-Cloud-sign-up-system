import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GuestApi from "../services/guestApi";
import { getCardClass } from "../utils/uiUtils";

export default function GuestManage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState<any | null>(null);
  const [form, setForm] = useState<{
    fullName?: string;
    phone?: string;
    notes?: string;
  }>({});
  const [originalForm, setOriginalForm] = useState<{
    fullName?: string;
    phone?: string;
    notes?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      setError(null);
      setLoading(true);
      try {
        const data = await GuestApi.getByToken(token);
        setGuest(data?.guest || null);
        const formData = {
          fullName: data?.guest?.fullName || "",
          phone: data?.guest?.phone || "",
          notes: data?.guest?.notes || "",
        };
        setForm(formData);
        setOriginalForm(formData);
      } catch (e: any) {
        setError(e?.message || "Invalid or expired link");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  // Check if form has changed from original values
  const hasFormChanged = () => {
    return (
      form.fullName !== originalForm.fullName ||
      form.phone !== originalForm.phone ||
      form.notes !== originalForm.notes
    );
  };

  const update = (k: keyof typeof form) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: any) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const data = await GuestApi.updateByToken(token, form);
      setGuest(data);
      // Update original form data after successful save
      setOriginalForm({ ...form });
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!token) return;
    if (!confirm("Are you sure you want to cancel your registration?")) return;
    setCancelling(true);
    setError(null);
    try {
      await GuestApi.cancelByToken(token);
      navigate("/guest/confirmation", { replace: true });
    } catch (e: any) {
      setError(e?.message || "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className={getCardClass()}>
            <div className="flex items-center justify-center space-x-2">
              <svg
                className="animate-spin h-5 w-5 text-blue-500"
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
              <span className="text-gray-600">
                Loading your registration...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className={getCardClass()}>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <svg
                  className="w-12 h-12 text-red-400"
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Unable to Load Registration
              </h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className={getCardClass()}>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Registration Not Found
              </h3>
              <p className="text-gray-600">
                This registration link may have expired or is invalid.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Manage Your Registration
          </h1>
          <p className="text-gray-600">
            Update your information or cancel your registration
          </p>
        </div>

        {/* Event Information Card */}
        <div className={getCardClass()}>
          <div className="border-b border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Event Details
            </h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-start">
              <span className="text-sm font-medium text-gray-700 w-20 flex-shrink-0">
                Event:
              </span>
              <span className="text-sm text-gray-900 font-medium">
                {guest?.eventSnapshot?.title || "N/A"}
              </span>
            </div>
            <div className="flex items-start">
              <span className="text-sm font-medium text-gray-700 w-20 flex-shrink-0">
                Role:
              </span>
              <span className="text-sm text-gray-900">
                {guest?.eventSnapshot?.roleName || "N/A"}
              </span>
            </div>
            <div className="flex items-start">
              <span className="text-sm font-medium text-gray-700 w-20 flex-shrink-0">
                Status:
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  guest?.status === "confirmed"
                    ? "bg-green-100 text-green-800"
                    : guest?.status === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {guest?.status || "Unknown"}
              </span>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <div className={getCardClass()}>
          <div className="border-b border-gray-200 pb-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Update Your Information
            </h2>
          </div>

          <form onSubmit={save} className="space-y-6">
            {/* Personal Information Section */}
            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-2"
                  htmlFor="manage-fullname"
                >
                  Full Name *
                </label>
                <div className="relative">
                  <input
                    id="manage-fullname"
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors pl-12"
                    value={form.fullName || ""}
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

              {/* Phone */}
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-2"
                  htmlFor="manage-phone"
                >
                  Phone Number *
                </label>
                <div className="relative">
                  <input
                    id="manage-phone"
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
              </div>

              {/* Notes */}
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-2"
                  htmlFor="manage-notes"
                >
                  Additional Notes{" "}
                  <span className="text-gray-400">(Optional)</span>
                </label>
                <div className="relative">
                  <textarea
                    id="manage-notes"
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

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="submit"
                disabled={saving || !hasFormChanged()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {saving ? (
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
                    Saving Changes...
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Save Changes
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={cancel}
                disabled={cancelling}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {cancelling ? (
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
                    Cancelling Registration...
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Cancel Registration
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help Information */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-400 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-xs text-blue-800">
                <strong>Need Help?</strong> If you have questions about your
                registration or need to make changes not available here, please
                contact the event organizer directly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

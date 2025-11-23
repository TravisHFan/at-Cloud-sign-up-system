import React from "react";

interface NotificationPreferenceProps {
  sendNotificationsPref: boolean | null;
  setSendNotificationsPref: (value: boolean) => void;
  setNotificationPrefTouched: (value: boolean) => void;
}

/**
 * NotificationPreference Component
 *
 * Handles notification preference selection for event updates:
 * - Radio button group for send now / send later
 * - Required field validation with error message
 * - Tracks user interaction for validation
 *
 * @component
 */
const NotificationPreference: React.FC<NotificationPreferenceProps> = ({
  sendNotificationsPref,
  setSendNotificationsPref,
  setNotificationPrefTouched,
}) => {
  return (
    <div className="pt-6 border-t border-gray-200">
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-1">
          Send notifications about this update?{" "}
          <span className="text-red-500">*</span>
        </legend>
        <p className="text-xs text-gray-500 mb-2">
          Choose whether to notify the registered users and guests now via email
          and a system message.
        </p>
        <div className="space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="notifyUpdatePref"
              value="send"
              checked={sendNotificationsPref === true}
              onChange={() => {
                setSendNotificationsPref(true);
                setNotificationPrefTouched(true);
              }}
              className="mt-1"
            />
            <span className="text-sm text-gray-700">
              <span className="font-medium">Send notifications now</span> (email
              + system message to all users).
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="notifyUpdatePref"
              value="later"
              checked={sendNotificationsPref === false}
              onChange={() => {
                setSendNotificationsPref(false);
                setNotificationPrefTouched(true);
              }}
              className="mt-1"
            />
            <span className="text-sm text-gray-700">
              <span className="font-medium">Don't send notifications now</span>{" "}
              — I'll notify users later (co-organizers will still be notified).
            </span>
          </label>
        </div>
        {sendNotificationsPref === null && (
          <p className="mt-2 text-sm text-red-600">
            Select a notification option is required.
          </p>
        )}
      </fieldset>
    </div>
  );
};

export default NotificationPreference;

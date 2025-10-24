import React from "react";
import Icon from "./Icon";

interface NotificationPromptModalProps {
  isOpen: boolean;
  onConfirm: (sendNotifications: boolean) => void;
  onCancel: () => void;
  userName: string;
  roleName: string;
}

export default function NotificationPromptModal({
  isOpen,
  onConfirm,
  onCancel,
  userName,
  roleName,
}: NotificationPromptModalProps) {
  const [sendNotifications, setSendNotifications] = React.useState(true); // Default to Yes

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Notification Settings
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icon name="x-mark" className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="mb-6 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            You're about to assign{" "}
            <span className="font-medium text-gray-900">{userName}</span> to the
            role <span className="font-medium text-gray-900">{roleName}</span>.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Do you want to notify the invited user by email and system message?
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          <label className="flex items-start space-x-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="notifications"
              value="yes"
              checked={sendNotifications}
              onChange={() => setSendNotifications(true)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">
                Yes — notify the user and let them decide whether to attend.
              </div>
              <div className="text-xs text-gray-500 mt-1">
                The user will receive an email and system message about the role
                assignment.
              </div>
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                <strong>Highly recommended.</strong> Even if you're inviting the
                person to take on multiple roles in the same event, please send
                a separate notification each time, so they aren't forced to
                decline only part of the invitation, which could lead to
                miscommunication and scheduling errors.
              </div>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="notifications"
              value="no"
              checked={!sendNotifications}
              onChange={() => setSendNotifications(false)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">
                No — assign the role without sending notifications.
              </div>
              <div className="text-xs text-gray-500 mt-1">
                The assignment will be applied silently without any
                notifications.
              </div>
              <div className="mt-2 p-2 bg-red-50 border border-red-300 rounded text-xs text-red-800">
                <strong>Not recommended,</strong> unless you've already
                communicated with the other party and confirmed they can attend.
              </div>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(sendNotifications)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

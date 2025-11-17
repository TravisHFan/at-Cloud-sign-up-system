import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../common";
import {
  UserGroupIcon,
  UserIcon,
  KeyIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
  gender?: "male" | "female";
  role?: string;
  roleInAtCloud?: string;
}

export interface MessageFormData {
  title: string;
  content: string;
  type: "announcement" | "maintenance" | "update" | "warning";
  priority: "high" | "medium" | "low";
  includeCreator: boolean;
}

interface CreateMessageModalProps {
  isOpen: boolean;
  currentUser: User | null;
  onClose: () => void;
  onSendMessage: (
    formData: MessageFormData,
    targetRoles?: string[]
  ) => Promise<void>;
  onNameCardClick: (userId: string) => void;
}

// Form validation constants
const TITLE_MIN = 5;
const TITLE_MAX = 200;
const CONTENT_MIN = 5;
const CONTENT_MAX = 3500;

/**
 * Modal component for creating and sending system messages.
 * Features:
 * - Title and content inputs with character count validation
 * - Include creator checkbox to show/hide "Message from" information
 * - Type selector (announcement, maintenance, update, warning)
 * - Priority selector (low, medium, high)
 * - Recipient dropdown with 5 options:
 *   * Send to All
 *   * Send to Admins (Super Admin + Administrator)
 *   * Send to @Cloud co-workers (Super Admin + Administrator + Leader)
 *   * Send to Guest Experts
 *   * Send to Participants
 */
export default function CreateMessageModal({
  isOpen,
  currentUser,
  onClose,
  onSendMessage,
  onNameCardClick,
}: CreateMessageModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "announcement" as
      | "announcement"
      | "maintenance"
      | "update"
      | "warning",
    priority: "medium" as "high" | "medium" | "low",
    includeCreator: true,
  });

  const [sendDropdownOpen, setSendDropdownOpen] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendToAll = async () => {
    await onSendMessage(formData, undefined);
    handleClose();
  };

  const handleSendToRoles = async (targetRoles: string[]) => {
    await onSendMessage(formData, targetRoles);
    handleClose();
  };

  const handleClearForm = () => {
    setFormData({
      title: "",
      content: "",
      type: "announcement",
      priority: "medium",
      includeCreator: true,
    });
  };

  const handleClose = () => {
    setFormData({
      title: "",
      content: "",
      type: "announcement",
      priority: "medium",
      includeCreator: true,
    });
    setSendDropdownOpen(false);
    onClose();
  };

  const isFormValid =
    formData.title.trim() &&
    formData.content.trim() &&
    formData.title.trim().length >= TITLE_MIN &&
    formData.title.length <= TITLE_MAX &&
    formData.content.trim().length >= CONTENT_MIN &&
    formData.content.length <= CONTENT_MAX;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Create New System Message
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <Icon name="x-mark" className="w-6 h-6" />
            </button>
          </div>

          <form className="space-y-4">
            {/* Title Input */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter message title..."
                required
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className={`$${""}`}></span>
                <span
                  className={`text-gray-500 ${
                    formData.title.length > TITLE_MAX ? "text-red-600" : ""
                  }`}
                >
                  {formData.title.length}/{TITLE_MAX}
                </span>
              </div>
              {formData.title.trim().length > 0 &&
                formData.title.trim().length < TITLE_MIN && (
                  <p className="mt-1 text-xs text-red-600">
                    Title must be at least {TITLE_MIN} characters.
                  </p>
                )}
              {formData.title.length > TITLE_MAX && (
                <p className="mt-1 text-xs text-red-600">
                  Title must be at most {TITLE_MAX} characters.
                </p>
              )}
            </div>

            {/* Include Creator Checkbox */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeCreator"
                name="includeCreator"
                checked={formData.includeCreator}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    includeCreator: e.target.checked,
                  }))
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor="includeCreator"
                className="text-sm font-medium text-gray-700"
              >
                Include "Message from" information
              </label>
            </div>

            {/* Message From - Creator Info */}
            {formData.includeCreator && currentUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message from
                </label>
                <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                  <div
                    className="flex items-center space-x-3 cursor-pointer hover:bg-gray-100 -mx-1 px-1 py-1 rounded-md transition-colors"
                    onClick={() => {
                      if (currentUser) {
                        onNameCardClick(currentUser.id);
                      }
                    }}
                    title={`View your profile`}
                  >
                    <img
                      className="w-10 h-10 rounded-full object-cover"
                      src={
                        currentUser.avatar ||
                        (currentUser.gender === "female"
                          ? "/default-avatar-female.jpg"
                          : "/default-avatar-male.jpg")
                      }
                      alt={`${currentUser.firstName} ${currentUser.lastName}`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                        {currentUser.firstName} {currentUser.lastName}
                      </p>
                      {/* Show both role (authLevel) and roleInAtCloud when available */}
                      {(currentUser.role || currentUser.roleInAtCloud) && (
                        <p className="text-xs text-gray-500">
                          {[currentUser.role, currentUser.roleInAtCloud]
                            .filter(Boolean) // Remove null/undefined values
                            .filter(
                              (value, index, array) =>
                                array.indexOf(value) === index
                            ) // Remove duplicates
                            .join(" • ")}{" "}
                          {/* Use bullet separator */}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Help text for when creator is not included */}
            {!formData.includeCreator && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <Icon name="lightning" className="w-4 h-4 inline mr-1" />
                  This message will appear as a system-generated announcement
                  without creator information.
                </p>
              </div>
            )}

            {/* Content Textarea */}
            <div>
              <label
                htmlFor="content"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Content
              </label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter message content..."
                required
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className={`$${""}`}></span>
                <span
                  className={`text-gray-500 ${
                    formData.content.length > CONTENT_MAX ? "text-red-600" : ""
                  }`}
                >
                  {formData.content.length}/{CONTENT_MAX}
                </span>
              </div>
              {formData.content.trim().length > 0 &&
                formData.content.trim().length < CONTENT_MIN && (
                  <p className="mt-1 text-xs text-red-600">
                    Content must be at least {CONTENT_MIN} characters.
                  </p>
                )}
              {formData.content.length > CONTENT_MAX && (
                <p className="mt-1 text-xs text-red-600">
                  Content must be at most {CONTENT_MAX} characters.
                </p>
              )}
            </div>

            {/* Type and Priority Selectors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Type
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="announcement">Announcement</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="update">Update</option>
                  <option value="warning">Warning</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="priority"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearForm}
                className="px-4 py-2 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
              >
                Clear Form
              </button>

              {/* Send Dropdown Button */}
              <div className="relative z-30">
                <button
                  type="button"
                  onClick={() => setSendDropdownOpen(!sendDropdownOpen)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isFormValid}
                >
                  <span>Send</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={sendDropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {sendDropdownOpen && (
                  <>
                    {/* Backdrop to close dropdown when clicking outside */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setSendDropdownOpen(false)}
                    />

                    <div className="absolute right-0 bottom-full mb-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 max-h-[400px] overflow-y-auto">
                      {/* Send to All */}
                      <button
                        type="button"
                        onClick={handleSendToAll}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                        disabled={!isFormValid}
                      >
                        <UserGroupIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            Send to All
                          </div>
                          <div className="text-xs text-gray-500">
                            All users in the system
                          </div>
                        </div>
                      </button>

                      {/* Send to Admins */}
                      <button
                        type="button"
                        onClick={() =>
                          handleSendToRoles(["Super Admin", "Administrator"])
                        }
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                        disabled={!isFormValid}
                      >
                        <KeyIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            Send to Admins
                          </div>
                          <div className="text-xs text-gray-500">
                            Super Admin + Administrator
                          </div>
                        </div>
                      </button>

                      {/* Send to @Cloud co-workers */}
                      <button
                        type="button"
                        onClick={() =>
                          handleSendToRoles([
                            "Super Admin",
                            "Administrator",
                            "Leader",
                          ])
                        }
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                        disabled={!isFormValid}
                      >
                        <svg
                          className="w-5 h-5 text-gray-600 flex-shrink-0"
                          viewBox="0 0 512 512"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="currentColor"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <g>
                            <circle cx="268.243" cy="295.934" r="10" />
                            <circle cx="69.673" cy="144.068" r="10.02" />
                            <circle cx="140.615" cy="73.624" r="10.02" />
                            <path d="m163.434 350.156h38.501c5.534 0 10.02-4.486 10.02-10.02s-4.486-10.02-10.02-10.02h-38.501c-5.534 0-10.02 4.486-10.02 10.02s4.486 10.02 10.02 10.02z" />
                            <path d="m248.992 350.156h38.502c5.533 0 10.02-4.486 10.02-10.02s-4.486-10.02-10.02-10.02h-38.502c-5.534 0-10.02 4.486-10.02 10.02s4.486 10.02 10.02 10.02z" />
                            <path d="m334.551 350.156h38.501c5.533 0 10.02-4.486 10.02-10.02s-4.486-10.02-10.02-10.02h-38.501c-5.533 0-10.02 4.486-10.02 10.02s4.487 10.02 10.02 10.02z" />
                            <path d="m211.955 382.915c0-5.533-4.486-10.02-10.02-10.02h-38.501c-5.534 0-10.02 4.486-10.02 10.02 0 5.533 4.486 10.02 10.02 10.02h38.501c5.534-.001 10.02-4.487 10.02-10.02z" />
                            <path d="m287.494 458.454h-38.502c-5.534 0-10.02 4.486-10.02 10.02s4.486 10.02 10.02 10.02h38.502c5.533 0 10.02-4.486 10.02-10.02s-4.487-10.02-10.02-10.02z" />
                            <path d="m254.912 425.695c0-5.533-4.486-10.02-10.02-10.02h-38.501c-5.534 0-10.02 4.486-10.02 10.02 0 5.533 4.486 10.02 10.02 10.02h38.501c5.535-.001 10.02-4.487 10.02-10.02z" />
                            <path d="m281.573 425.695c0 5.533 4.486 10.02 10.02 10.02h38.502c5.533 0 10.02-4.486 10.02-10.02 0-5.533-4.486-10.02-10.02-10.02h-38.502c-5.533 0-10.02 4.486-10.02 10.02z" />
                            <path d="m248.992 392.934h38.502c5.533 0 10.02-4.486 10.02-10.02 0-5.533-4.486-10.02-10.02-10.02h-38.502c-5.534 0-10.02 4.486-10.02 10.02.001 5.534 4.486 10.02 10.02 10.02z" />
                            <path d="m334.551 392.934h38.501c5.533 0 10.02-4.486 10.02-10.02 0-5.533-4.486-10.02-10.02-10.02h-38.501c-5.533 0-10.02 4.486-10.02 10.02s4.487 10.02 10.02 10.02z" />
                            <path d="m503.756 125.154c-3.258-22.31-15.008-42.02-33.081-55.495-17.292-12.901-38.605-18.656-59.989-16.199-4.426.498-8.764 1.333-12.999 2.497-15.995-16.688-34.523-29.991-55.175-39.571-23.442-10.873-48.429-16.386-74.269-16.386-39.361 0-76.621 12.74-108.156 36.893-20.737-8.619-39.598-12.556-52.369-14.797-5.916-1.031-11.922.614-16.48 4.516-4.544 3.892-7.086 9.553-6.974 15.521.413 23.196 3.51 44.985 9.213 65.046-30.882-6.633-57.717-4.654-67.584-3.924-5.982.439-11.399 3.498-14.862 8.391-3.46 4.888-4.543 11.008-2.971 16.784 8.241 30.331 20.585 56.932 36.688 79.061.026.036.054.072.08.108.02.027.04.055.061.082 10.383 14.241 22.46 26.808 35.978 37.472-4.488 1.515-8.606 4.047-12.064 7.495-5.9 5.899-9.149 13.74-9.149 22.079 0 15.074 10.736 27.687 24.962 30.596v44.322c-.001 89.522 72.832 162.355 162.355 162.355h42.544c89.524 0 162.357-72.833 162.357-162.356v-44.318c5.95-1.207 11.419-4.127 15.812-8.519 5.899-5.898 9.149-13.74 9.149-22.08 0-16.683-13.161-30.352-29.648-31.176l40.727-55.792c13.448-18.061 19.075-40.288 15.844-62.605zm-123.17-38.582 13.797 26.264c2.566 4.877.626 11.102-4.254 13.654-4.886 2.555-11.089.633-13.652-4.25l-10.472-19.936c0-.001 10.084-12.219 14.581-15.732zm-3.803-23.127c-8.997 5.576-16.8 12.711-23.188 21.275l-71.305 97.447c-3.281-15.33-7.985-29.81-14.076-43.243-1.301-2.955-22.655-49.994-76.1-85.151-3.703-2.435-7.549-4.754-11.504-6.96 26.142-17.56 56.139-26.775 87.631-26.775 40.615.001 78.636 15.316 108.542 43.407zm-50.214 96.141 15.194 28.913c2.57 4.885.623 11.094-4.254 13.655-4.928 2.591-11.055.685-13.652-4.25l-10.689-20.348zm-85.711 70.49c-.057-.136-.116-.271-.179-.404-8.11-19.533-18.391-37.18-30.561-52.456-1.619-2.077-24.164-30.35-66.458-51.897 8.085-3.752 15.677-8.63 22.599-14.564 10.694-9.167 19.211-20.425 25.076-33.032 41.373 31.102 58.374 68.899 58.546 69.292.02.045.04.09.06.135 7.849 17.298 13.175 36.608 15.858 57.428l-22.767 30.941c-.71-1.838-1.433-3.657-2.174-5.443zm-83.369-172.484c5.877 2.648 11.548 5.593 16.949 8.781-4.664 11.196-11.9 21.178-21.222 29.169-10.639 9.121-23.266 15.096-36.864 17.533-7.538-21.354-11.594-45.31-12.092-71.24 12.85 2.254 32.348 6.34 53.229 15.757zm-56.148 72.23c.02.049.041.098.062.148-1.793 11.952-6.358 23.357-13.414 33.352-8.081 11.447-18.857 20.332-31.44 26.024-12.534-18.86-22.336-41.067-29.185-66.108 17.929-1.324 44.793-2.015 73.977 6.584zm-32.549 75.869c14.127-7.17 26.271-17.641 35.568-30.813 8.123-11.507 13.624-24.508 16.223-38.168 47.733 20.005 73.478 52.501 73.738 52.835.029.038.059.076.09.113 11.1 13.924 20.494 30.1 27.92 48.08.002.005.004.01.007.015.023.056.048.11.073.165.034.078.067.156.102.233.724 1.755 1.428 3.547 2.122 5.357h-110.407c-4.741-2.695-9.383-5.623-13.82-8.757-11.668-8.226-22.26-17.973-31.616-29.06zm388.001 69.035c0 6.094-5.094 11.189-11.188 11.189h-129.422c-5.533 0-10.02 4.486-10.02 10.02s4.486 10.02 10.02 10.02h115.65v43.69c0 78.474-63.843 142.317-142.318 142.317h-42.544c-78.474 0-142.317-63.843-142.317-142.317v-43.69h115.649c5.534 0 10.02-4.486 10.02-10.02s-4.486-10.02-10.02-10.02h-129.422c-5.571 0-10.438-4.296-11.105-9.832-.792-6.572 4.476-12.534 11.105-12.534h354.725c6.169 0 11.187 5.014 11.187 11.177zm15.023-98.906c-.021.027-.04.055-.061.081l-49.353 67.609h-160.37l36.844-50.07 7.243 13.789c5.394 10.254 15.895 16.121 26.744 16.121 16.484 0 30.162-13.825 30.116-30.27-.014-4.834-1.229-9.63-3.478-13.907l-20.884-39.74 14.153-19.234 5.965 11.356c3.744 7.133 10.043 12.379 17.738 14.772 9.4 2.923 19.791 1.003 27.551-5.045 6.829-5.322 11.066-13.546 11.53-22.185.289-5.393-.92-10.808-3.433-15.585l-14.001-26.652c4.759-1.732 9.71-2.913 14.829-3.489 16.317-1.871 32.561 2.514 45.747 12.35 13.787 10.28 22.748 25.312 25.231 42.317 2.464 17.03-1.836 34-12.111 47.782z" />
                            <path d="m143.724 200.837c3.239 2.24 12.607 9.412 17.002 15.613 3.418 4.82 10.483 5.605 14.883 1.649 3.731-3.355 4.364-9.149 1.465-13.238-7.194-10.148-20.462-19.475-21.951-20.505-4.551-3.148-10.792-2.01-13.94 2.541-3.148 4.55-2.011 10.792 2.541 13.94z" />
                          </g>
                        </svg>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            Send to @Cloud co-workers
                          </div>
                          <div className="text-xs text-gray-500">
                            Super Admin + Administrator + Leader
                          </div>
                        </div>
                      </button>

                      {/* Send to Guest Experts */}
                      <button
                        type="button"
                        onClick={() => handleSendToRoles(["Guest Expert"])}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                        disabled={!isFormValid}
                      >
                        <AcademicCapIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            Send to Guest Experts
                          </div>
                          <div className="text-xs text-gray-500">
                            Guest Expert role only
                          </div>
                        </div>
                      </button>

                      {/* Send to Participants */}
                      <button
                        type="button"
                        onClick={() => handleSendToRoles(["Participant"])}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                        disabled={!isFormValid}
                      >
                        <UserIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            Send to Participants
                          </div>
                          <div className="text-xs text-gray-500">
                            Participant role only
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

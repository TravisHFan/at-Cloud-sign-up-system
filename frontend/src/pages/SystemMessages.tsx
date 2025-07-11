import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext";
import { useAuth } from "../hooks/useAuth";
import { Icon } from "../components/common";
import { getAvatarUrl } from "../utils/avatarUtils";

export default function SystemMessages() {
  const {
    systemMessages,
    markSystemMessageAsRead,
    addSystemMessage,
    deleteSystemMessage,
  } = useNotifications();
  const { hasRole, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Filter system messages - auth level changes only for current user, others for all
  const filteredSystemMessages = systemMessages.filter((message) => {
    if (message.type === "auth_level_change") {
      // Only show auth level change messages targeted to current user
      return message.targetUserId === currentUser?.id;
    }
    // Show all other system messages to everyone
    return true;
  });

  // Handle URL hash navigation to scroll to specific message
  useEffect(() => {
    if (location.hash) {
      const messageId = location.hash.substring(1); // Remove the # symbol
      const messageElement = document.getElementById(messageId);
      if (messageElement) {
        // Scroll to the message
        messageElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Mark the message as read if it's not already
        const message = filteredSystemMessages.find((m) => m.id === messageId);
        if (message && !message.isRead) {
          markSystemMessageAsRead(messageId);
        }

        // Add a brief highlight effect
        messageElement.classList.add(
          "ring-2",
          "ring-blue-500",
          "ring-opacity-75"
        );
        setTimeout(() => {
          messageElement.classList.remove(
            "ring-2",
            "ring-blue-500",
            "ring-opacity-75"
          );
        }, 2000);
      }
    }
  }, [location.hash, filteredSystemMessages, markSystemMessageAsRead]);

  // Get the correct profile link (matching EventDetail and Management page logic)
  const getProfileLink = (userId: string) => {
    const currentUserId =
      currentUser?.id || "550e8400-e29b-41d4-a716-446655440000";
    return userId === currentUserId
      ? "/dashboard/profile" // Own profile page (editable)
      : `/dashboard/profile/${userId}`; // View-only profile page
  };
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "announcement" as
      | "announcement"
      | "maintenance"
      | "update"
      | "warning",
    priority: "medium" as "high" | "medium" | "low",
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendToAll = () => {
    // Validate required fields
    if (!formData.title.trim() || !formData.content.trim()) {
      alert("Please fill in both title and content fields.");
      return;
    }

    // Create the system message with creator information
    addSystemMessage({
      title: formData.title,
      content: formData.content,
      type: formData.type,
      priority: formData.priority,
      isRead: false,
      creator: currentUser
        ? {
            id: currentUser.id,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            username: currentUser.username,
            avatar: currentUser.avatar || undefined,
            gender: currentUser.gender as "male" | "female",
            roleInAtCloud: currentUser.roleInAtCloud,
          }
        : undefined,
    });

    // Clear form and close modal
    setFormData({
      title: "",
      content: "",
      type: "announcement",
      priority: "medium",
    });
    setShowCreateForm(false);

    // Show success message
    alert("System message sent to all users successfully!");
  };

  const handleClearForm = () => {
    setFormData({
      title: "",
      content: "",
      type: "announcement",
      priority: "medium",
    });
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setFormData({
      title: "",
      content: "",
      type: "announcement",
      priority: "medium",
    });
  };

  const handleMessageClick = (messageId: string) => {
    markSystemMessageAsRead(messageId);
  };

  const handleDeleteMessage = (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation(); // Prevent triggering the message click
    if (confirm("Are you sure you want to delete this system message?")) {
      deleteSystemMessage(messageId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "announcement":
        return <Icon name="lightning" className="w-5 h-5" />; // Electric shock/bolt for announcements
      case "maintenance":
        return <Icon name="shield-check" className="w-5 h-5" />; // Shield for system maintenance/protection
      case "update":
        return <Icon name="check-circle" className="w-5 h-5" />; // Check circle for successful updates
      case "warning":
        return <Icon name="x-circle" className="w-5 h-5" />; // X circle for warnings/alerts
      case "auth_level_change":
        return <Icon name="user" className="w-5 h-5" />; // User icon for auth level changes
      default:
        return <Icon name="mail" className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "announcement":
        return "text-blue-600"; // Blue for announcements (lightning)
      case "maintenance":
        return "text-emerald-600"; // Emerald green for maintenance (shield)
      case "update":
        return "text-green-600"; // Green for updates (check)
      case "warning":
        return "text-red-600"; // Red for warnings (x-circle)
      case "auth_level_change":
        return "text-green-600"; // Green for auth level changes (user)
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg
              className="w-8 h-8 text-blue-600"
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                System Messages
              </h1>
              <p className="text-gray-600">
                Important announcements and system updates
              </p>
            </div>
          </div>

          {/* Create Button - Available to all users except Participants */}
          {!hasRole("Participant") && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Icon name="plus" className="w-5 h-5" />
              <span>Create New System Message</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {systemMessages.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {systemMessages.filter((m) => !m.isRead).length} unread messages
            </span>
            <span>{systemMessages.length} total messages</span>
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="space-y-4">
        {filteredSystemMessages.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Icon
              name="mail"
              className="w-12 h-12 mx-auto mb-4 text-gray-300"
            />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No system messages
            </h3>
            <p className="text-gray-500">
              You're all caught up! Check back later for system updates.
            </p>
          </div>
        ) : (
          filteredSystemMessages.map((message) => (
            <div
              key={message.id}
              id={message.id}
              onClick={() => handleMessageClick(message.id)}
              className={`bg-white rounded-lg shadow-sm border cursor-pointer transition-all duration-200 hover:shadow-md ${
                !message.isRead
                  ? "border-blue-200 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`${getTypeColor(message.type)}`}>
                      {getTypeIcon(message.type)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {message.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formatDate(message.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Priority Badge */}
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-md border ${getPriorityColor(
                        message.priority
                      )}`}
                    >
                      {message.priority.toUpperCase()}
                    </span>
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteMessage(e, message.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Delete message"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                    {/* Unread Indicator */}
                    {!message.isRead && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>

                {/* Creator Information */}
                {message.creator && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div
                      className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-2 rounded-md transition-colors"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering the message click
                        if (message.creator) {
                          navigate(getProfileLink(message.creator.id));
                        }
                      }}
                      title={`View ${message.creator.firstName} ${message.creator.lastName}'s profile`}
                    >
                      <img
                        className="w-8 h-8 rounded-full"
                        src={getAvatarUrl(
                          message.creator.avatar || null,
                          message.creator.gender
                        )}
                        alt={`${message.creator.firstName} ${message.creator.lastName}`}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                          {message.creator.firstName} {message.creator.lastName}
                        </p>
                        {message.creator.roleInAtCloud && (
                          <p className="text-xs text-gray-500">
                            {message.creator.roleInAtCloud}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Type Badge */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="inline-flex items-center space-x-1 text-xs text-gray-500">
                    <span>Type:</span>
                    <span className="font-medium capitalize">
                      {message.type.replace("_", " ")}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create System Message Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Create New System Message
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Icon name="x-mark" className="w-6 h-6" />
                </button>
              </div>

              <form className="space-y-4">
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
                </div>

                {/* Message From - Creator Info */}
                {currentUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message from
                    </label>
                    <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                      <div
                        className="flex items-center space-x-3 cursor-pointer hover:bg-gray-100 -mx-1 px-1 py-1 rounded-md transition-colors"
                        onClick={() => {
                          if (currentUser) {
                            navigate(getProfileLink(currentUser.id));
                          }
                        }}
                        title={`View your profile`}
                      >
                        <img
                          className="w-10 h-10 rounded-full"
                          src={getAvatarUrl(
                            currentUser.avatar || null,
                            currentUser.gender as "male" | "female"
                          )}
                          alt={`${currentUser.firstName} ${currentUser.lastName}`}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                            {currentUser.firstName} {currentUser.lastName}
                          </p>
                          {currentUser.roleInAtCloud && (
                            <p className="text-xs text-gray-500">
                              {currentUser.roleInAtCloud}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
                </div>

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

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
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
                  <button
                    type="button"
                    onClick={handleSendToAll}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    disabled={
                      !formData.title.trim() || !formData.content.trim()
                    }
                  >
                    Send to All
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

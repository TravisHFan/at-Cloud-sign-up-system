import { useState } from "react";
import { useNotifications } from "../contexts/NotificationContext";
import { useAuth } from "../hooks/useAuth";
import { Icon } from "../components/common";

export default function SystemMessages() {
  const {
    systemMessages,
    markSystemMessageAsRead,
    addSystemMessage,
    deleteSystemMessage,
  } = useNotifications();
  const { hasRole } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
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

    // Create the system message
    addSystemMessage({
      title: formData.title,
      content: formData.content,
      type: formData.type,
      priority: formData.priority,
      isRead: false,
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
        return <Icon name="lightning" className="w-5 h-5" />;
      case "maintenance":
        return <Icon name="clock" className="w-5 h-5" />;
      case "update":
        return <Icon name="check-circle" className="w-5 h-5" />;
      case "warning":
        return <Icon name="x-circle" className="w-5 h-5" />;
      default:
        return <Icon name="mail" className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "announcement":
        return "text-blue-600";
      case "maintenance":
        return "text-orange-600";
      case "update":
        return "text-green-600";
      case "warning":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Icon name="mail" className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                System Messages
              </h1>
              <p className="text-gray-600">
                Important announcements and system updates
              </p>
            </div>
          </div>

          {/* Super Admin Create Button */}
          {hasRole("Super Admin") && (
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
        {systemMessages.length === 0 ? (
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
          systemMessages.map((message) => (
            <div
              key={message.id}
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

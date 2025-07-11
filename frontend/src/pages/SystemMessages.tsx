import { useNotifications } from "../contexts/NotificationContext";
import { Icon } from "../components/common";

export default function SystemMessages() {
  const { systemMessages, markSystemMessageAsRead } = useNotifications();

  const handleMessageClick = (messageId: string) => {
    markSystemMessageAsRead(messageId);
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
        <div className="flex items-center space-x-3">
          <Icon name="mail" className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Messages</h1>
            <p className="text-gray-600">
              Important announcements and system updates
            </p>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        {systemMessages.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Icon name="mail" className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
    </div>
  );
}

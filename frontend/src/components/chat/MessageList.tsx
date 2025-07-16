import { useRef } from "react";
import { Icon } from "../common";
import { getAvatarUrl } from "../../utils/avatarUtils";

interface MessageListProps {
  groupedMessages: Record<string, any[]>;
  selectedConversation: any;
  currentUser: any;
  isSelfChat: boolean;
  showScrollButton: boolean;
  onDeleteMessage: (messageId: string) => void;
  onScroll: () => void;
  onScrollToBottom: () => void;
}

export default function MessageList({
  groupedMessages,
  selectedConversation,
  currentUser,
  isSelfChat,
  showScrollButton,
  onDeleteMessage,
  onScroll,
  onScrollToBottom,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div
      ref={messagesContainerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto p-1 space-y-1 bg-gray-50 min-h-0 relative"
    >
      {Object.keys(groupedMessages).length === 0 ? (
        <div className="text-center py-2">
          <Icon name="mail" className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">
            No messages yet
          </h3>
          <p className="text-xs text-gray-500">
            {isSelfChat
              ? "This is a conversation with yourself."
              : "Start the conversation by sending a message below."}
          </p>
        </div>
      ) : (
        Object.entries(groupedMessages).map(
          ([date, messages]: [string, any]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="text-center my-2">
                <span className="bg-white text-gray-500 text-xs px-2 py-0.5 rounded-full shadow-sm">
                  {formatDate(date)}
                </span>
              </div>

              {/* Messages for this date */}
              {messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.fromUserId === "current_user"
                      ? "justify-end"
                      : "justify-start"
                  } mb-2`}
                >
                  {/* Other user's avatar (left side) */}
                  {msg.fromUserId !== "current_user" && (
                    <img
                      className="w-8 h-8 rounded-full mr-4 mt-1"
                      src={getAvatarUrl(
                        selectedConversation.user.avatar || null,
                        selectedConversation.user.gender
                      )}
                      alt={`${selectedConversation.user.firstName} ${selectedConversation.user.lastName}`}
                    />
                  )}

                  <div className="relative group">
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-1.5 rounded-lg relative ${
                        msg.fromUserId === "current_user"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-900 shadow-sm"
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.fromUserId === "current_user"
                            ? "text-blue-100"
                            : "text-gray-500"
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => onDeleteMessage(msg.id)}
                      className={`absolute -top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full ${
                        msg.fromUserId === "current_user"
                          ? "-left-10"
                          : "-right-10"
                      }`}
                      title="Delete message from your view"
                    >
                      <Icon name="trash" className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Current user's avatar (right side) */}
                  {msg.fromUserId === "current_user" && (
                    <img
                      className="w-8 h-8 rounded-full ml-4 mt-1"
                      src={getAvatarUrl(
                        currentUser?.avatar || null,
                        currentUser?.gender || "male"
                      )}
                      alt="You"
                    />
                  )}
                </div>
              ))}
            </div>
          )
        )
      )}
      <div ref={messagesEndRef} />

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={onScrollToBottom}
          className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-all duration-200 z-10"
          title="Scroll to bottom"
        >
          <Icon name="arrow-left" className="w-4 h-4 transform rotate-90" />
        </button>
      )}
    </div>
  );
}

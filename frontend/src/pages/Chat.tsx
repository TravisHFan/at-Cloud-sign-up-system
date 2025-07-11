import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext";
import { Icon } from "../components/common";
import { getAvatarUrl } from "../utils/avatarUtils";

export default function Chat() {
  const { userId } = useParams<{ userId: string }>();
  const { chatConversations, markChatAsRead, sendMessage } = useNotifications();
  const [message, setMessage] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find the conversation or create a new one
  useEffect(() => {
    if (userId) {
      const conversation = chatConversations.find(
        (conv) => conv.userId === userId
      );
      if (conversation) {
        setSelectedConversation(conversation);
        markChatAsRead(userId);
      } else {
        // Create a mock conversation for demo purposes
        setSelectedConversation({
          userId,
          user: {
            id: userId,
            firstName: "Unknown",
            lastName: "User",
            username: `user_${userId}`,
            avatar: undefined,
            gender: "male" as const,
          },
          messages: [],
          unreadCount: 0,
        });
      }
    } else {
      setSelectedConversation(null);
    }
  }, [userId, chatConversations, markChatAsRead]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedConversation?.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && userId) {
      sendMessage(userId, message.trim());
      setMessage("");
    }
  };

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

  // Group messages by date
  const groupedMessages =
    selectedConversation?.messages.reduce((groups: any, msg: any) => {
      const date = new Date(msg.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
      return groups;
    }, {}) || {};

  if (!userId) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <Icon name="mail" className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
              <p className="text-gray-600">Chat with other members</p>
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Conversations
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {chatConversations.length === 0 ? (
              <div className="p-8 text-center">
                <Icon
                  name="mail"
                  className="w-12 h-12 mx-auto mb-4 text-gray-300"
                />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No conversations yet
                </h3>
                <p className="text-gray-500">
                  Start a conversation by messaging other members.
                </p>
              </div>
            ) : (
              chatConversations.map((conversation) => (
                <div
                  key={conversation.userId}
                  onClick={() =>
                    (window.location.href = `/dashboard/chat/${conversation.userId}`)
                  }
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <img
                        className="w-10 h-10 rounded-full"
                        src={getAvatarUrl(
                          conversation.user.avatar || null,
                          conversation.user.gender
                        )}
                        alt={`${conversation.user.firstName} ${conversation.user.lastName}`}
                      />
                      {conversation.unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                          {conversation.unreadCount > 9
                            ? "9+"
                            : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {conversation.user.firstName}{" "}
                        {conversation.user.lastName}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {conversation.lastMessage?.message || "No messages"}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {conversation.lastMessage &&
                        formatTime(conversation.lastMessage.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <Icon name="arrow-left" className="w-5 h-5" />
          </button>
          {selectedConversation && (
            <>
              <img
                className="w-10 h-10 rounded-full"
                src={getAvatarUrl(
                  selectedConversation.user.avatar || null,
                  selectedConversation.user.gender
                )}
                alt={`${selectedConversation.user.firstName} ${selectedConversation.user.lastName}`}
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {selectedConversation.user.firstName}{" "}
                  {selectedConversation.user.lastName}
                </h1>
                <p className="text-sm text-gray-600">
                  @{selectedConversation.user.username}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="bg-white rounded-lg shadow-sm flex flex-col h-96">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.keys(groupedMessages).length === 0 ? (
            <div className="text-center py-8">
              <Icon
                name="mail"
                className="w-12 h-12 mx-auto mb-4 text-gray-300"
              />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No messages yet
              </h3>
              <p className="text-gray-500">
                Start the conversation by sending a message below.
              </p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(
              ([date, messages]: [string, any]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="text-center my-4">
                    <span className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
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
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          msg.fromUserId === "current_user"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-900"
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
                    </div>
                  ))}
                </div>
              )
            )
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex space-x-4">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!message.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

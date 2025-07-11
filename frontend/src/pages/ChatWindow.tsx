import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext";
import { Icon } from "../components/common";
import { getAvatarUrl } from "../utils/avatarUtils";
import { useAuth } from "../hooks/useAuth";

export default function ChatWindow() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    chatConversations,
    markChatAsRead,
    sendMessage,
    deleteConversation,
    deleteMessage,
  } = useNotifications();
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
    }
  }, [userId, chatConversations, markChatAsRead]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedConversation?.messages]);

  // Handle deleting a conversation
  const handleDeleteConversation = (userId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this conversation? This action cannot be undone."
      )
    ) {
      deleteConversation(userId);
      navigate("/dashboard/chat");
    }
  };

  // Handle deleting a specific message
  const handleDeleteMessage = (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessage(userId!, messageId);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && userId) {
      // Check if user is trying to send message to themselves
      if (currentUser && userId === currentUser.id) {
        alert("You cannot send messages to yourself!");
        return;
      }
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

  // Check if user is trying to chat with themselves
  const isSelfChat = !!(currentUser && userId === currentUser.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate("/dashboard/chat")}
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
                  {isSelfChat && " (You)"}
                </h1>
                <p className="text-sm text-gray-600">
                  @{selectedConversation.user.username}
                </p>
              </div>
            </>
          )}

          {/* Delete conversation button */}
          {selectedConversation && !isSelfChat && (
            <button
              onClick={() =>
                handleDeleteConversation(selectedConversation.userId)
              }
              className="ml-auto p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
              title="Delete conversation"
            >
              <Icon name="trash" className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Self-chat warning */}
      {isSelfChat && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Icon name="x-circle" className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              You cannot send messages to yourself. This is just for
              demonstration purposes.
            </p>
          </div>
        </div>
      )}

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
                {isSelfChat
                  ? "You cannot send messages to yourself."
                  : "Start the conversation by sending a message below."}
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
                      } mb-4`}
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
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative ${
                            msg.fromUserId === "current_user"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          {/* Chat bubble tail */}
                          <div
                            className={`absolute top-3 w-0 h-0 ${
                              msg.fromUserId === "current_user"
                                ? "right-[-12px] border-l-[12px] border-l-blue-600 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent"
                                : "left-[-12px] border-r-[12px] border-r-gray-100 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent"
                            }`}
                          ></div>

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

                        {/* Delete button - show for all messages (user can delete from their own view) */}
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className={`absolute -top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full ${
                            msg.fromUserId === "current_user"
                              ? "-left-10" // Left side for current user's messages (right-aligned bubbles)
                              : "-right-10" // Right side for other user's messages (left-aligned bubbles)
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
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex space-x-4">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                isSelfChat
                  ? "You cannot send messages to yourself"
                  : "Type your message..."
              }
              disabled={isSelfChat}
              className={`flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isSelfChat ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
            />
            <button
              type="submit"
              disabled={!message.trim() || isSelfChat}
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

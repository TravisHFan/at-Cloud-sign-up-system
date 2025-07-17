import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Icon } from "../components/common";
import { useHybridChat } from "../hooks/useHybridChat";
import { getAvatarUrl } from "../utils/avatarUtils";
import { formatDistanceToNow } from "date-fns";

export default function HybridChatPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const {
    conversations,
    currentMessages,
    activeConversationId,
    isLoading,
    error,
    typingUsers,
    sendMessage,
    selectConversation,
    searchMessages,
    pinConversation,
    muteConversation,
    startTyping,
    stopTyping,
    getConversation,
    totalUnreadCount,
  } = useHybridChat(partnerId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  // Handle message input
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversationId) return;

    try {
      await sendMessage(newMessage);
      setNewMessage("");
      stopTyping();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const results = await searchMessages(
        searchQuery,
        activeConversationId || undefined
      );
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const formatTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const activeConversation = activeConversationId
    ? getConversation(activeConversationId)
    : null;

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Icon
            name="x-circle"
            className="w-16 h-16 text-red-500 mx-auto mb-4"
          />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar - Conversations List */}
      <div className="w-1/3 border-r border-gray-200 bg-gray-50">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
            {totalUnreadCount > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Icon
              name="plus"
              className="absolute left-3 top-3 w-4 h-4 text-gray-400"
            />
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="absolute right-3 top-2 p-1 text-gray-400 hover:text-gray-600"
            >
              <Icon name="tag" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversations */}
        <div className="overflow-y-auto">
          {isLoading && conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Icon
                name="chat-bubble"
                className="w-8 h-8 mx-auto mb-2 text-gray-300"
              />
              <p>Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Icon
                name="chat-bubble"
                className="w-8 h-8 mx-auto mb-2 text-gray-300"
              />
              <p>No conversations yet</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.partnerId}
                onClick={() => selectConversation(conversation.partnerId)}
                className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-100 transition-colors ${
                  activeConversationId === conversation.partnerId
                    ? "bg-blue-50 border-l-4 border-l-blue-500"
                    : ""
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    <img
                      className="w-12 h-12 rounded-full"
                      src={getAvatarUrl(
                        conversation.partnerAvatar || null,
                        (conversation.partnerGender as "male" | "female") ||
                          "male"
                      )}
                      alt={conversation.partnerName}
                    />
                    {conversation.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {conversation.unreadCount > 9
                          ? "9+"
                          : conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {conversation.partnerName}
                      </p>
                      <div className="flex items-center space-x-1">
                        {conversation.isPinned && (
                          <Icon
                            name="tag"
                            className="w-3 h-3 text-yellow-500"
                          />
                        )}
                        {conversation.isMuted && (
                          <Icon
                            name="x-mark"
                            className="w-3 h-3 text-gray-400"
                          />
                        )}
                        <p className="text-xs text-gray-500">
                          {formatTime(conversation.lastMessageTime)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {conversation.lastMessageFromMe && "You: "}
                      {conversation.lastMessageContent || "No messages yet"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversationId && activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    className="w-10 h-10 rounded-full"
                    src={getAvatarUrl(
                      activeConversation.partnerAvatar || null,
                      (activeConversation.partnerGender as "male" | "female") ||
                        "male"
                    )}
                    alt={activeConversation.partnerName}
                  />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {activeConversation.partnerName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      @{activeConversation.partnerUsername}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() =>
                      pinConversation(
                        activeConversationId,
                        !activeConversation.isPinned
                      )
                    }
                    className={`p-2 rounded-lg transition-colors ${
                      activeConversation.isPinned
                        ? "bg-yellow-100 text-yellow-600"
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    }`}
                    title={
                      activeConversation.isPinned
                        ? "Unpin conversation"
                        : "Pin conversation"
                    }
                  >
                    <Icon name="tag" className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      muteConversation(
                        activeConversationId,
                        !activeConversation.isMuted
                      )
                    }
                    className={`p-2 rounded-lg transition-colors ${
                      activeConversation.isMuted
                        ? "bg-gray-100 text-gray-600"
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    }`}
                    title={
                      activeConversation.isMuted
                        ? "Unmute conversation"
                        : "Mute conversation"
                    }
                  >
                    <Icon
                      name={
                        activeConversation.isMuted ? "x-mark" : "check-circle"
                      }
                      className="w-5 h-5"
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentMessages.map((message) => (
                <div
                  key={message.messageId}
                  className={`flex ${
                    message.isFromMe ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex max-w-xs lg:max-w-md ${
                      message.isFromMe ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {!message.isFromMe && (
                      <img
                        className="w-8 h-8 rounded-full"
                        src={getAvatarUrl(
                          message.senderAvatar || null,
                          (activeConversation.partnerGender as
                            | "male"
                            | "female") || "male"
                        )}
                        alt={message.senderName}
                      />
                    )}
                    <div
                      className={`mx-2 ${
                        message.isFromMe ? "text-right" : "text-left"
                      }`}
                    >
                      <div
                        className={`px-4 py-2 rounded-lg ${
                          message.isFromMe
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-900"
                        } ${message.isDeleted ? "italic opacity-60" : ""}`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex justify-start">
                  <div className="flex items-center space-x-2 text-gray-500 text-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                    <span>{typingUsers.join(", ")} typing...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <form
                onSubmit={handleSendMessage}
                className="flex items-center space-x-3"
              >
                <div className="flex-1">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    placeholder="Type a message..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Icon name="plus" className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* No conversation selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <Icon
                name="chat-bubble"
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
              />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Welcome to Hybrid Chat
              </h3>
              <p className="text-gray-500 mb-4">
                Select a conversation to start messaging
              </p>
              <button
                onClick={() => navigate("/dashboard/users")}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Browse Users
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Results Modal */}
      {showSearch && searchResults.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Search Results</h3>
              <button
                onClick={() => setShowSearch(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icon name="x-mark" className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-3">
              {searchResults.map((result) => (
                <div
                  key={result.messageId}
                  className="p-3 border border-gray-200 rounded-lg"
                >
                  <p className="text-sm">{result.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTime(result.timestamp)} • {result.senderName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

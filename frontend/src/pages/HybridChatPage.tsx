import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Icon } from "../components/common";
import { useHybridChat } from "../hooks/useHybridChat";
import { useNotifications } from "../contexts/NotificationContext";
import { getAvatarUrl } from "../utils/avatarUtils";
import { useAuth } from "../hooks/useAuth";

export default function HybridChatPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Get users from notification context (since that's where user data is loaded)
  const { getAllUsers } = useNotifications();

  const {
    conversations,
    currentMessages,
    activeConversationId,
    isLoading,
    error,
    typingUsers,
    sendMessage,
    selectConversation,
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
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

  // Filter users based on search term
  const allUsers = getAllUsers();
  const filteredUsers = allUsers.filter((user) => {
    // Exclude current user to prevent self-chat
    if (currentUser && user.id === currentUser.id) {
      return false;
    }

    // If there's no search term, show all users
    if (!searchTerm.trim()) {
      return true;
    }

    // Local search filtering
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const username = user.username.toLowerCase();
    const search = searchTerm.toLowerCase();

    return fullName.includes(search) || username.includes(search);
  });

  // Show users without existing conversations when searching
  const availableUsers = filteredUsers.filter((user) => {
    // If we're searching, show all users that match the search
    if (searchTerm.trim()) {
      return true;
    }
    // If not searching, only show users without existing conversations
    return !conversations.some((conv) => conv.partnerId === user.id);
  });

  // Handle starting a new conversation
  const handleStartConversation = async (user: any) => {
    if (!user.id || (currentUser && user.id === currentUser.id)) {
      console.warn("Cannot start conversation with invalid or self user");
      return;
    }

    // Select the conversation (this will create it if it doesn't exist)
    await selectConversation(user.id);
    setShowUserSearch(false);
    setSearchTerm("");

    // Update URL
    navigate(`/dashboard/hybrid-chat/${user.id}`);
  };

  // Handle selecting a conversation
  const handleSelectChat = async (partnerId: string) => {
    await selectConversation(partnerId);
    navigate(`/dashboard/hybrid-chat/${partnerId}`);
  };

  // Handle clearing selection
  const handleClearSelection = () => {
    navigate("/dashboard/hybrid-chat");
  };

  // Group messages by date
  const groupedMessages = currentMessages.reduce((groups: any, msg: any) => {
    const date = new Date(msg.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
    return groups;
  }, {});

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
    <div className="max-w-7xl mx-auto h-[90vh] max-h-[800px]">
      {/* Split-pane layout */}
      <div className="flex bg-white rounded-lg shadow-sm h-full overflow-hidden">
        {/* Left Panel - Chat List */}
        <div
          className={`bg-gray-50 border-r border-gray-200 flex-shrink-0 transition-all duration-300 ${
            activeConversationId ? "w-80 lg:w-96" : "w-full lg:w-96"
          } ${activeConversationId ? "hidden lg:flex" : "flex"} flex-col`}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-white">
            <div className="flex items-center space-x-3 mb-4">
              <Icon name="chat-bubble" className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Chats</h1>
                <p className="text-gray-600">Chat with other members</p>
              </div>
            </div>
            <button
              onClick={() => setShowUserSearch(!showUserSearch)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <Icon name="plus" className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>

          {/* User Search Section */}
          {showUserSearch && (
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Search people..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Icon
                  name="user"
                  className="absolute left-3 top-3 w-4 h-4 text-gray-400"
                />
              </div>

              {/* User Search Results */}
              {searchTerm && (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {availableUsers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {allUsers.length === 0
                        ? "No users loaded from database"
                        : filteredUsers.length === 0
                        ? "No users found matching search"
                        : "All users already have conversations"}
                    </div>
                  ) : (
                    availableUsers.map((user: any, index: number) => (
                      <div
                        key={user.id || `user-${index}`}
                        onClick={() => handleStartConversation(user)}
                        className="p-3 hover:bg-gray-50 cursor-pointer transition-colors duration-200 flex items-center space-x-3"
                      >
                        <img
                          className="w-8 h-8 rounded-full"
                          src={getAvatarUrl(user.avatar || null, user.gender)}
                          alt={`${user.firstName} ${user.lastName}`}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-xs text-gray-500">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
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
              <div className="divide-y divide-gray-200">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.partnerId}
                    className={`p-4 hover:bg-white transition-colors duration-200 flex items-center justify-between cursor-pointer ${
                      activeConversationId === conversation.partnerId
                        ? "bg-blue-50 border-r-2 border-blue-600"
                        : ""
                    }`}
                    onClick={() => handleSelectChat(conversation.partnerId)}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="relative">
                        <img
                          className="w-10 h-10 rounded-full"
                          src={getAvatarUrl(
                            conversation.partnerAvatar || null,
                            (conversation.partnerGender as "male" | "female") ||
                              "male"
                          )}
                          alt={conversation.partnerName}
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
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {conversation.partnerName}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {conversation.lastMessageContent || "No messages"}
                        </p>
                      </div>
                      <div className="text-xs text-gray-400">
                        {conversation.lastMessageTime &&
                          formatTime(conversation.lastMessageTime)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat Window */}
        <div
          className={`flex-1 flex flex-col ${
            activeConversationId ? "flex" : "hidden lg:flex"
          }`}
        >
          {activeConversationId && activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleClearSelection}
                    className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Icon name="arrow-left" className="w-5 h-5" />
                  </button>
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
                    <h2 className="text-lg font-semibold text-gray-900">
                      {activeConversation.partnerName}
                    </h2>
                    <p className="text-sm text-gray-500">
                      @{activeConversation.partnerUsername}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {totalUnreadCount > 0 && (
                    <span className="bg-blue-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                      {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading && currentMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading messages...</p>
                    </div>
                  </div>
                ) : currentMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Icon
                        name="chat-bubble"
                        className="w-12 h-12 mx-auto mb-4 text-gray-300"
                      />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Start the conversation
                      </h3>
                      <p className="text-gray-500">
                        Send a message to {activeConversation.partnerName}
                      </p>
                    </div>
                  </div>
                ) : (
                  Object.entries(groupedMessages).map(([date, messages]) => (
                    <div key={date}>
                      {/* Date Separator */}
                      <div className="flex items-center justify-center my-4">
                        <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                          {formatDate(date)}
                        </div>
                      </div>

                      {/* Messages for this date */}
                      {(messages as any[]).map((message, index) => (
                        <div
                          key={message.messageId || index}
                          className={`flex ${
                            message.isFromMe ? "justify-end" : "justify-start"
                          } mb-4`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              message.isFromMe
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <p
                              className={`text-xs mt-1 ${
                                message.isFromMe
                                  ? "text-blue-100"
                                  : "text-gray-500"
                              }`}
                            >
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}

                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg">
                      <p className="text-sm">
                        {typingUsers.join(", ")}{" "}
                        {typingUsers.length === 1 ? "is" : "are"} typing...
                      </p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    placeholder={`Message ${activeConversation.partnerName}...`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* No Chat Selected */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Icon
                  name="chat-bubble"
                  className="w-16 h-16 mx-auto mb-4 text-gray-300"
                />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Select a conversation
                </h2>
                <p className="text-gray-600">
                  Choose a conversation from the left or start a new chat
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

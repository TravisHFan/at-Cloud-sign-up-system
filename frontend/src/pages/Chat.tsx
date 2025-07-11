import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext";
import { Icon } from "../components/common";
import { getAvatarUrl } from "../utils/avatarUtils";
import { useAuth } from "../hooks/useAuth";

export default function Chat() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser } = useAuth();

  // Split-pane chat interface state
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(
    userId || null
  );

  const {
    chatConversations,
    markChatAsRead,
    sendMessage,
    getAllUsers,
    startConversation,
    deleteConversation,
    deleteMessage,
  } = useNotifications();

  const [message, setMessage] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set initial selected chat based on URL
  useEffect(() => {
    if (userId) {
      setSelectedChatUserId(userId);
    } else {
      setSelectedChatUserId(null);
    }
  }, [userId]);

  // Find the selected conversation
  const selectedConversation = selectedChatUserId
    ? chatConversations.find((conv) => conv.userId === selectedChatUserId) || {
        userId: selectedChatUserId,
        user: {
          id: selectedChatUserId,
          firstName: "Unknown",
          lastName: "User",
          username: `user_${selectedChatUserId}`,
          avatar: undefined,
          gender: "male" as const,
        },
        messages: [],
        unreadCount: 0,
      }
    : null;

  // Check if this is a self-chat attempt
  const isSelfChat = currentUser && selectedChatUserId === currentUser.id;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedConversation?.messages]);

  // Handle selecting a chat (for split-pane interface)
  const handleSelectChat = (userId: string) => {
    setSelectedChatUserId(userId);
    markChatAsRead(userId);
    // Update URL without navigation for direct access
    window.history.replaceState({}, "", `/dashboard/chat/${userId}`);
  };

  // Handle clearing chat selection (show only list on mobile)
  const handleClearSelection = () => {
    setSelectedChatUserId(null);
    window.history.replaceState({}, "", "/dashboard/chat");
  };

  // Handle starting a new conversation with a user
  const handleStartConversation = (user: any) => {
    // Prevent self-chat
    if (currentUser && user.id === currentUser.id) {
      alert("You cannot start a conversation with yourself!");
      return;
    }

    const fullName = `${user.firstName} ${user.lastName}`;
    startConversation(user.id, fullName, user.gender);
    setShowUserSearch(false);
    setSearchTerm("");
    handleSelectChat(user.id);
  };

  // Handle deleting a conversation
  const handleDeleteConversation = (userId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this conversation? This action cannot be undone."
      )
    ) {
      deleteConversation(userId);
      if (userId === selectedChatUserId) {
        handleClearSelection();
      }
    }
  };

  // Handle deleting a specific message
  const handleDeleteMessage = (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessage(selectedChatUserId!, messageId);
    }
  };

  // Filter users based on search term and exclude current user
  const allUsers = getAllUsers();
  const filteredUsers = allUsers.filter((user) => {
    // Exclude current user to prevent self-chat
    if (currentUser && user.id === currentUser.id) {
      return false;
    }

    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const username = user.username.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || username.includes(search);
  });

  // Filter out users who already have conversations
  const availableUsers = filteredUsers.filter(
    (user) => !chatConversations.some((conv) => conv.userId === user.id)
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for self-chat prevention
    if (currentUser && selectedChatUserId === currentUser.id) {
      alert("You cannot send messages to yourself!");
      return;
    }

    if (message.trim() && selectedChatUserId) {
      sendMessage(selectedChatUserId, message.trim());
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

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)]">
      {/* Split-pane layout */}
      <div className="flex bg-white rounded-lg shadow-sm h-full overflow-hidden">
        {/* Left Panel - Chat List */}
        <div
          className={`bg-gray-50 border-r border-gray-200 flex-shrink-0 transition-all duration-300 ${
            selectedChatUserId ? "w-80 lg:w-96" : "w-full lg:w-96"
          } ${selectedChatUserId ? "hidden lg:flex" : "flex"} flex-col`}
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
                      {filteredUsers.length === 0
                        ? "No users found"
                        : "All users already have conversations"}
                    </div>
                  ) : (
                    availableUsers.map((user) => (
                      <div
                        key={user.id}
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
              <div className="divide-y divide-gray-200">
                {chatConversations.map((conversation) => (
                  <div
                    key={conversation.userId}
                    className={`p-4 hover:bg-white transition-colors duration-200 flex items-center justify-between cursor-pointer ${
                      selectedChatUserId === conversation.userId
                        ? "bg-blue-50 border-r-2 border-blue-600"
                        : ""
                    }`}
                    onClick={() => handleSelectChat(conversation.userId)}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
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
                        <p className="text-sm font-medium text-gray-900 truncate">
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conversation.userId);
                      }}
                      className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Delete conversation"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat Window */}
        <div
          className={`flex-1 flex flex-col ${
            selectedChatUserId ? "flex" : "hidden lg:flex"
          }`}
        >
          {!selectedConversation ? (
            /* No chat selected state */
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Icon
                  name="chat-bubble"
                  className="w-16 h-16 mx-auto mb-4 text-gray-300"
                />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  Select a conversation
                </h3>
                <p className="text-gray-500">
                  Choose a chat from the list to start messaging
                </p>
              </div>
            </div>
          ) : (
            /* Chat interface */
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-white flex items-center space-x-3">
                {/* Back button for mobile */}
                <button
                  onClick={handleClearSelection}
                  className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <Icon name="arrow-left" className="w-5 h-5" />
                </button>

                <img
                  className="w-10 h-10 rounded-full"
                  src={getAvatarUrl(
                    selectedConversation.user.avatar || null,
                    selectedConversation.user.gender
                  )}
                  alt={`${selectedConversation.user.firstName} ${selectedConversation.user.lastName}`}
                />
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedConversation.user.firstName}{" "}
                    {selectedConversation.user.lastName}
                    {isSelfChat && (
                      <span className="text-sm text-orange-600 font-normal ml-2">
                        (You)
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-600">
                    @{selectedConversation.user.username}
                  </p>
                </div>

                {/* Delete conversation button */}
                {!isSelfChat && (
                  <button
                    onClick={() =>
                      handleDeleteConversation(selectedConversation.userId)
                    }
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    title="Delete conversation"
                  >
                    <Icon name="trash" className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Self-chat warning */}
              {isSelfChat && (
                <div className="p-3 bg-orange-50 border-b border-orange-200">
                  <div className="flex items-center space-x-2">
                    <Icon
                      name="check-circle"
                      className="w-5 h-5 text-orange-600"
                    />
                    <p className="text-sm text-orange-800">
                      You are viewing a conversation with yourself. You cannot
                      send messages to yourself.
                    </p>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
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
                        ? "This is a conversation with yourself."
                        : "Start the conversation by sending a message below."}
                    </p>
                  </div>
                ) : (
                  Object.entries(groupedMessages).map(
                    ([date, messages]: [string, any]) => (
                      <div key={date}>
                        {/* Date separator */}
                        <div className="text-center my-4">
                          <span className="bg-white text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm">
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
                                onClick={() => handleDeleteMessage(msg.id)}
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
              </div>

              {/* Message Input */}
              <div className="border-t border-gray-200 p-4 bg-white">
                {isSelfChat ? (
                  <div className="text-center text-gray-500 py-4">
                    <Icon name="clock" className="w-5 h-5 mx-auto mb-2" />
                    <p className="text-sm">
                      You cannot send messages to yourself
                    </p>
                  </div>
                ) : (
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
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Icon } from "../common";
import { getAvatarUrl } from "../../utils/avatarUtils";

interface ChatListProps {
  chatConversations: any[];
  selectedChatUserId: string | null;
  onSelectChat: (userId: string) => void;
  onDeleteConversation: (userId: string) => void;
  onStartConversation: (user: any) => void;
  allUsers: any[];
  currentUser: any;
}

export default function ChatList({
  chatConversations,
  selectedChatUserId,
  onSelectChat,
  onDeleteConversation,
  onStartConversation,
  allUsers,
  currentUser,
}: ChatListProps) {
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter users based on search term and exclude current user
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

  return (
    <div className="bg-gray-50 border-r border-gray-200 flex-shrink-0 w-80 lg:w-96 flex flex-col">
      {/* Header */}
      <div className="p-1 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3 mb-1">
          <Icon name="chat-bubble" className="w-5 h-5 text-blue-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Chats</h1>
            <p className="text-xs text-gray-600">Chat with other members</p>
          </div>
        </div>

        <button
          onClick={() => setShowUserSearch(!showUserSearch)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
        >
          <Icon name="plus" className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* User Search Section */}
      {showUserSearch && (
        <div className="p-1 border-b border-gray-200 bg-white">
          <div className="relative mb-2">
            <input
              type="text"
              placeholder="Search people..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Icon
              name="user"
              className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
            />
          </div>

          {/* User Search Results */}
          {searchTerm && (
            <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
              {availableUsers.length === 0 ? (
                <div className="p-2 text-center text-gray-500">
                  {filteredUsers.length === 0
                    ? "No users found"
                    : "All users already have conversations"}
                </div>
              ) : (
                availableUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => {
                      onStartConversation(user);
                      setShowUserSearch(false);
                      setSearchTerm("");
                    }}
                    className="p-2 hover:bg-gray-50 cursor-pointer transition-colors duration-200 flex items-center space-x-3"
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
                      <p className="text-xs text-gray-500">@{user.username}</p>
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
          <div className="p-2 text-center">
            <Icon name="mail" className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              No conversations yet
            </h3>
            <p className="text-xs text-gray-500">
              Start a conversation by messaging other members.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {chatConversations.map((conversation) => (
              <div
                key={conversation.userId}
                className={`p-2 hover:bg-white transition-colors duration-200 flex items-center justify-between cursor-pointer ${
                  selectedChatUserId === conversation.userId
                    ? "bg-blue-50 border-r-2 border-blue-600"
                    : ""
                }`}
                onClick={() => onSelectChat(conversation.userId)}
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
                      {conversation.user.firstName} {conversation.user.lastName}
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
                    onDeleteConversation(conversation.userId);
                  }}
                  className="ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
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
  );
}

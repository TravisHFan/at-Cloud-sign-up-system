import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext";
import { Icon } from "../components/common";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { getAvatarUrl } from "../utils/avatarUtils";
import { useAuth } from "../hooks/useAuth";

export default function ChatList() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    chatConversations,
    getAllUsers,
    startConversation,
    deleteConversation,
  } = useNotifications();
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
  }>({
    isOpen: false,
    userId: "",
    userName: "",
  });

  // Handle starting a new conversation with a user
  const handleStartConversation = (user: any) => {
    const fullName = `${user.firstName} ${user.lastName}`;
    startConversation(user.id, fullName, user.gender);
    setShowUserSearch(false);
    setSearchTerm("");
    navigate(`/dashboard/chat/${user.id}`);
  };

  // Handle deleting a conversation
  const handleDeleteConversation = (userId: string) => {
    const conversation = chatConversations.find(
      (conv) => conv.userId === userId
    );
    setDeleteConfirmation({
      isOpen: true,
      userId,
      userName: conversation
        ? `${conversation.user.firstName} ${conversation.user.lastName}`
        : "this user",
    });
  };

  const confirmDeleteConversation = () => {
    deleteConversation(deleteConfirmation.userId);
    setDeleteConfirmation({
      isOpen: false,
      userId: "",
      userName: "",
    });
  };

  const cancelDeleteConversation = () => {
    setDeleteConfirmation({
      isOpen: false,
      userId: "",
      userName: "",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter users based on search term
  const allUsers = getAllUsers();
  const filteredUsers = allUsers.filter((user) => {
    // Exclude current user from search results
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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-3">
          <Icon name="speech-bubble" className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chats</h1>
            <p className="text-gray-600">Chat with other members</p>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Conversations
            </h2>
            <button
              onClick={() => setShowUserSearch(!showUserSearch)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Icon name="plus" className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>

          {/* User Search Section */}
          {showUserSearch && (
            <div className="mb-4">
              <div className="relative">
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
                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {availableUsers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No users found
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
                className="p-4 hover:bg-gray-50 transition-colors duration-200 flex items-center justify-between"
              >
                <div
                  onClick={() =>
                    navigate(`/dashboard/chat/${conversation.userId}`)
                  }
                  className="flex items-center space-x-3 cursor-pointer flex-1"
                >
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
                    handleDeleteConversation(conversation.userId);
                  }}
                  className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  title="Delete conversation"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={cancelDeleteConversation}
        onConfirm={confirmDeleteConversation}
        title="Delete Conversation"
        message={`Are you sure you want to delete the entire conversation with ${deleteConfirmation.userName}?\n\nThis action cannot be undone and will permanently remove all messages in this conversation.`}
        confirmText="Delete Conversation"
        type="danger"
      />
    </div>
  );
}

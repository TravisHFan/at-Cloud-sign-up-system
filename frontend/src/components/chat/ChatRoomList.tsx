import React, { useEffect } from "react";
import { useMessagesApi, type ChatRoom } from "../../hooks/useMessagesApi";

interface ChatRoomListProps {
  onSelectChatRoom: (chatRoom: ChatRoom) => void;
  selectedChatRoom?: ChatRoom;
}

const ChatRoomList: React.FC<ChatRoomListProps> = ({
  onSelectChatRoom,
  selectedChatRoom,
}) => {
  const { chatRooms, loading, error, getChatRooms } = useMessagesApi();

  useEffect(() => {
    getChatRooms();
  }, [getChatRooms]);

  const formatLastMessageTime = (date: Date | string) => {
    const messageDate = new Date(date);
    const now = new Date();
    const diffInMinutes = (now.getTime() - messageDate.getTime()) / (1000 * 60);

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return messageDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    }
  };

  if (loading && chatRooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat rooms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 m-4">
        <p className="text-red-800 text-sm">{error}</p>
        <button
          onClick={() => getChatRooms()}
          className="mt-2 text-red-600 hover:text-red-800 underline text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (chatRooms.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 px-4">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <p className="text-lg font-medium">No chat rooms yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Join some events to start chatting!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h2 className="font-semibold text-gray-900">Messages</h2>
        <p className="text-sm text-gray-600">
          {chatRooms.length} chat room{chatRooms.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {chatRooms.map((chatRoom) => (
          <button
            key={chatRoom._id}
            onClick={() => onSelectChatRoom(chatRoom)}
            className={`w-full text-left p-4 hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50 ${
              selectedChatRoom?._id === chatRoom._id
                ? "bg-blue-50 border-r-2 border-blue-500"
                : ""
            }`}
          >
            <div className="flex items-start space-x-3">
              {/* Chat Room Icon */}
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {chatRoom.type === "general"
                      ? "💬"
                      : chatRoom.type === "event"
                      ? "📅"
                      : chatRoom.type === "direct"
                      ? "👤"
                      : "📢"}
                  </span>
                </div>
              </div>

              {/* Chat Room Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {chatRoom.name}
                  </h3>
                  {chatRoom.lastMessage && (
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {formatLastMessageTime(chatRoom.lastMessage.sentAt)}
                    </span>
                  )}
                </div>

                {chatRoom.lastMessage ? (
                  <p className="text-sm text-gray-600 truncate mt-1">
                    <span className="font-medium">
                      {chatRoom.lastMessage.senderName}:
                    </span>{" "}
                    {chatRoom.lastMessage.content}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 mt-1">No messages yet</p>
                )}

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                      {chatRoom.type}
                    </span>
                    {chatRoom.isPrivate && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                        🔒 Private
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                      />
                    </svg>
                    <span>{chatRoom.participants.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChatRoomList;

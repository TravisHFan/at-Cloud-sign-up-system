import React, { useState, useEffect, useRef } from "react";
import { useMessagesApi, type ChatRoom } from "../../hooks/useMessagesApi";
import { useSocket } from "../../hooks/useSocket";

interface ChatWindowProps {
  chatRoom: ChatRoom;
  onClose?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatRoom, onClose }) => {
  const { messages, loading, error, getMessages, sendMessage, addReaction } =
    useMessagesApi();

  // Real-time Socket.IO integration
  const {
    joinRoom,
    leaveRoom,
    onNewMessage,
    onUserTyping,
    startTyping,
    stopTyping,
    connected,
  } = useSocket();

  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages when chat room changes
  useEffect(() => {
    if (chatRoom?._id) {
      getMessages({ chatRoomId: chatRoom._id });

      // Join Socket.IO room for real-time updates
      if (connected) {
        joinRoom(chatRoom._id);
      }
    }
  }, [chatRoom?._id, getMessages, connected, joinRoom]);

  // Handle real-time events
  useEffect(() => {
    if (!chatRoom?._id) return;

    // Handle new messages
    const unsubscribeNewMessage = onNewMessage((message) => {
      if (message.chatRoomId === chatRoom._id) {
        // Message is automatically added to messages state via useMessagesApi
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    });

    // Handle typing indicators
    const unsubscribeTyping = onUserTyping((data) => {
      if (data.isTyping) {
        setTypingUsers((prev) => [
          ...prev.filter((id) => id !== data.userId),
          data.userId,
        ]);
      } else {
        setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
      }
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeTyping();
      leaveRoom(chatRoom._id);
    };
  }, [chatRoom?._id, onNewMessage, onUserTyping, leaveRoom]);

  // Handle typing indicator
  useEffect(() => {
    if (chatRoom?._id && connected) {
      if (isTyping) {
        startTyping(chatRoom._id);
      } else {
        stopTyping(chatRoom._id);
      }
    }
  }, [isTyping, chatRoom?._id, connected, startTyping, stopTyping]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage({
        content: newMessage.trim(),
        chatRoomId: chatRoom._id,
        messageType: "text",
      });
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await addReaction(messageId, emoji);
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  const formatTime = (date: Date | string) => {
    const messageDate = new Date(date);
    const now = new Date();
    const diffInHours =
      (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return messageDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div>
          <h3 className="font-semibold text-gray-900">{chatRoom.name}</h3>
          <p className="text-sm text-gray-600">
            {chatRoom.participants.length} participant
            {chatRoom.participants.length !== 1 ? "s" : ""}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {messages.length === 0 && !loading ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet. Start the conversation! 💬</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message._id} className="flex space-x-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <img
                  className="h-8 w-8 rounded-full"
                  src={message.senderAvatar || "/default-avatar-male.jpg"}
                  alt={message.senderName}
                />
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">
                    {message.senderName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(message.createdAt)}
                  </span>
                  {message.isEdited && (
                    <span className="text-xs text-gray-400">(edited)</span>
                  )}
                </div>

                <div className="mt-1">
                  {message.isDeleted ? (
                    <p className="text-gray-400 italic">{message.content}</p>
                  ) : (
                    <p className="text-gray-900">{message.content}</p>
                  )}
                </div>

                {/* Reactions */}
                {message.reactions && message.reactions.length > 0 && (
                  <div className="flex space-x-1 mt-2">
                    {message.reactions.map((reaction, index) => (
                      <button
                        key={index}
                        onClick={() =>
                          handleReaction(message._id, reaction.emoji)
                        }
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <span>{reaction.emoji}</span>
                        <span className="ml-1 text-gray-600">1</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Reactions */}
                {!message.isDeleted && (
                  <div className="flex space-x-1 mt-2 opacity-0 hover:opacity-100 transition-opacity">
                    {["👍", "❤️", "😄", "🎉"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(message._id, emoji)}
                        className="text-sm hover:bg-gray-100 rounded-full p-1 transition-colors"
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500">
            {typingUsers.length} user
            {typingUsers.length !== 1 ? "s" : ""} typing...
          </p>
        </div>
      )}

      {/* Message Input */}
      <form
        onSubmit={handleSendMessage}
        className="p-4 border-t border-gray-200"
      >
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${chatRoom.name}...`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={sending}
            onFocus={() => setIsTyping(true)}
            onBlur={() => setIsTyping(false)}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatWindow;

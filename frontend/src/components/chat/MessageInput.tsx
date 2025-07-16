import { useState } from "react";
import { Icon } from "../common";

interface MessageInputProps {
  isSelfChat: boolean;
  onSendMessage: (message: string) => void;
  onKeyDown: () => void;
  typingUsers: string[];
}

export default function MessageInput({
  isSelfChat,
  onSendMessage,
  onKeyDown,
  typingUsers,
}: MessageInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  return (
    <>
      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-3 py-1 text-gray-500 text-xs bg-white border-t border-gray-100">
          {typingUsers.length === 1
            ? `${typingUsers[0]} is typing...`
            : `${typingUsers.join(", ")} are typing...`}
        </div>
      )}

      {/* Message Input */}
      <div className="border-t border-gray-200 p-1 bg-white flex-shrink-0">
        {isSelfChat ? (
          <div className="text-center text-gray-500 py-1">
            <Icon name="clock" className="w-4 h-4 mx-auto mb-1" />
            <p className="text-xs">You cannot send messages to yourself</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              onKeyDown={onKeyDown}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              type="submit"
              disabled={!message.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </>
  );
}

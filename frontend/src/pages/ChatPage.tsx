import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import ChatRoomList from "../components/chat/ChatRoomList";
import ChatWindow from "../components/chat/ChatWindow";
import { type ChatRoom } from "../hooks/useMessagesApi";

const ChatPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [selectedChatRoom, setSelectedChatRoom] = useState<ChatRoom | null>(
    null
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Please Login
          </h1>
          <p className="text-gray-600">
            You need to be logged in to access the chat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Chat</h1>
          <p className="mt-2 text-gray-600">
            Connect with @Cloud members and event participants
          </p>
        </div>

        {/* Chat Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
          {/* Chat Room List */}
          <div className="lg:col-span-1">
            <ChatRoomList
              onSelectChatRoom={setSelectedChatRoom}
              selectedChatRoom={selectedChatRoom || undefined}
            />
          </div>

          {/* Chat Window */}
          <div className="lg:col-span-2">
            {selectedChatRoom ? (
              <ChatWindow
                chatRoom={selectedChatRoom}
                onClose={() => setSelectedChatRoom(null)}
              />
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="mb-4">
                    <svg
                      className="mx-auto h-16 w-16 text-gray-400"
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
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a chat room
                  </h3>
                  <p className="text-gray-500">
                    Choose a chat room from the list to start messaging
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>💬 Chat system powered by @Cloud backend API</p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

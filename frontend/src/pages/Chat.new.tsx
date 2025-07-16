import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Icon } from "../components/common";
import {
  ChatHeader,
  ChatList,
  MessageList,
  MessageInput,
} from "../components/chat";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { useChatLogic } from "../hooks/useChatLogic";

export default function Chat() {
  const { userId } = useParams<{ userId: string }>();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    selectedChatUserId,
    selectedConversation,
    isSelfChat,
    typingUsers,
    showScrollButton,
    groupedMessages,
    chatConversations,
    currentUser,
    allUsers,
    handleSelectChat,
    handleClearSelection,
    handleStartConversation,
    handleSendMessage,
    handleKeyDown,
    handleScroll,
    deleteConversation,
    deleteMessage,
  } = useChatLogic(userId);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "deleteConversation" | "deleteMessage";
    title: string;
    message: string;
    onConfirm: () => void;
    targetId?: string;
  }>({
    isOpen: false,
    type: "deleteConversation",
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Alert modal state for informational messages
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  // Helper function to show alert
  const showAlert = (title: string, message: string) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
    });
  };

  // Handle starting a new conversation with validation
  const handleStartConversationWithValidation = (user: any) => {
    const result = handleStartConversation(user);
    if (result.error) {
      showAlert("Cannot Start Conversation", result.error);
    }
  };

  // Handle deleting a conversation with confirmation
  const handleDeleteConversation = (userId: string) => {
    const conversation = chatConversations.find(
      (conv) => conv.userId === userId
    );
    const userName = conversation
      ? `${conversation.user.firstName} ${conversation.user.lastName}`
      : "this user";

    setConfirmModal({
      isOpen: true,
      type: "deleteConversation",
      title: "Delete Conversation",
      message: `Are you sure you want to delete your conversation with ${userName}? This action cannot be undone.`,
      onConfirm: () => {
        deleteConversation(userId);
        if (userId === selectedChatUserId) {
          handleClearSelection();
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      targetId: userId,
    });
  };

  // Handle deleting a specific message with confirmation
  const handleDeleteMessage = (messageId: string) => {
    setConfirmModal({
      isOpen: true,
      type: "deleteMessage",
      title: "Delete Message",
      message:
        "Are you sure you want to delete this message? This action cannot be undone.",
      onConfirm: () => {
        deleteMessage(selectedChatUserId!, messageId);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      targetId: messageId,
    });
  };

  // Handle sending a message with validation
  const handleSendMessageWithValidation = (message: string) => {
    const result = handleSendMessage(message);
    if (result.error) {
      showAlert("Cannot Send Message", result.error);
    }
  };

  // Handle scroll events
  const onScroll = () => {
    if (messagesContainerRef.current) {
      handleScroll(messagesContainerRef.current);
    }
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const element = messagesContainerRef.current;
      element.scrollTop = element.scrollHeight;
    }
  };

  return (
    <div className="w-full">
      {/* Compact Chat Layout */}
      <div className="flex bg-white rounded-lg shadow-sm h-[30vh] min-h-[250px] max-h-[300px] overflow-hidden">
        {/* Left Panel - Chat List */}
        <div className={`${selectedChatUserId ? "hidden lg:flex" : "flex"}`}>
          <ChatList
            chatConversations={chatConversations}
            selectedChatUserId={selectedChatUserId}
            onSelectChat={handleSelectChat}
            onDeleteConversation={handleDeleteConversation}
            onStartConversation={handleStartConversationWithValidation}
            allUsers={allUsers}
            currentUser={currentUser}
          />
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
              <ChatHeader
                selectedConversation={selectedConversation}
                isSelfChat={!!isSelfChat}
                onClearSelection={handleClearSelection}
                onDeleteConversation={handleDeleteConversation}
              />

              <MessageList
                groupedMessages={groupedMessages}
                selectedConversation={selectedConversation}
                currentUser={currentUser}
                isSelfChat={!!isSelfChat}
                showScrollButton={showScrollButton}
                onDeleteMessage={handleDeleteMessage}
                onScroll={onScroll}
                onScrollToBottom={scrollToBottom}
              />

              <MessageInput
                isSelfChat={!!isSelfChat}
                onSendMessage={handleSendMessageWithValidation}
                onKeyDown={handleKeyDown}
                typingUsers={typingUsers}
              />
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={
          confirmModal.type === "deleteConversation"
            ? "Delete Conversation"
            : "Delete Message"
        }
        cancelText="Cancel"
        type="danger"
      />

      {/* Alert Modal for informational messages */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-blue-100">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {alertModal.title}
                  </h3>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-500">{alertModal.message}</p>
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={() =>
                    setAlertModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

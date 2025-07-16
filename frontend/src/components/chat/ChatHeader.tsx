import { Icon } from "../common";
import { getAvatarUrl } from "../../utils/avatarUtils";

interface ChatHeaderProps {
  selectedConversation: any;
  isSelfChat: boolean;
  onClearSelection: () => void;
  onDeleteConversation: (userId: string) => void;
}

export default function ChatHeader({
  selectedConversation,
  isSelfChat,
  onClearSelection,
  onDeleteConversation,
}: ChatHeaderProps) {
  return (
    <>
      {/* Chat Header */}
      <div className="p-1 border-b border-gray-200 bg-white flex items-center space-x-3">
        {/* Back button for mobile */}
        <button
          onClick={onClearSelection}
          className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <Icon name="arrow-left" className="w-4 h-4" />
        </button>

        <img
          className="w-8 h-8 rounded-full"
          src={getAvatarUrl(
            selectedConversation.user.avatar || null,
            selectedConversation.user.gender
          )}
          alt={`${selectedConversation.user.firstName} ${selectedConversation.user.lastName}`}
        />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">
            {selectedConversation.user.firstName}{" "}
            {selectedConversation.user.lastName}
            {isSelfChat && (
              <span className="text-xs text-orange-600 font-normal ml-2">
                (You)
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-600">
            @{selectedConversation.user.username}
          </p>
        </div>

        {/* Delete conversation button */}
        {!isSelfChat && (
          <button
            onClick={() => onDeleteConversation(selectedConversation.userId)}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
            title="Delete conversation"
          >
            <Icon name="trash" className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Self-chat warning */}
      {isSelfChat && (
        <div className="p-2 bg-orange-50 border-b border-orange-200">
          <div className="flex items-center space-x-2">
            <Icon name="check-circle" className="w-4 h-4 text-orange-600" />
            <p className="text-xs text-orange-800">
              You are viewing a conversation with yourself. You cannot send
              messages to yourself.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

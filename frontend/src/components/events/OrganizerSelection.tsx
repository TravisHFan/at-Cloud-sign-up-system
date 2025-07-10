import { useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useUserData } from "../../hooks/useUserData";
import { getAvatarUrl, getAvatarAlt } from "../../utils/avatarUtils";
import type { User } from "../../types/management";

interface Organizer {
  id: number;
  firstName: string;
  lastName: string;
  systemRole: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
}

interface OrganizerSelectionProps {
  currentUser: Organizer;
  selectedOrganizers: Organizer[];
  onOrganizersChange: (organizers: Organizer[]) => void;
}

export default function OrganizerSelection({
  currentUser,
  selectedOrganizers,
  onOrganizersChange,
}: OrganizerSelectionProps) {
  const [showUserList, setShowUserList] = useState(false);
  const { users } = useUserData();

  // Convert User to Organizer format
  const convertUserToOrganizer = (user: User): Organizer => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    systemRole: user.role,
    roleInAtCloud: user.roleInAtCloud,
    gender: user.gender,
    avatar: user.avatar || null,
  });

  // Available users (excluding current user and already selected organizers)
  const availableUsers = users.filter(
    (user) =>
      user.id !== currentUser.id &&
      !selectedOrganizers.some((org) => org.id === user.id)
  );

  const handleAddOrganizer = (user: User) => {
    const newOrganizer = convertUserToOrganizer(user);
    onOrganizersChange([...selectedOrganizers, newOrganizer]);
    setShowUserList(false);
  };

  const handleRemoveOrganizer = (organizerId: number) => {
    onOrganizersChange(
      selectedOrganizers.filter((org) => org.id !== organizerId)
    );
  };

  const OrganizerCard = ({
    organizer,
    isCurrentUser = false,
    onRemove,
  }: {
    organizer: Organizer;
    isCurrentUser?: boolean;
    onRemove?: () => void;
  }) => (
    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border">
      {/* Avatar */}
      <img
        src={getAvatarUrl(organizer.avatar, organizer.gender)}
        alt={getAvatarAlt(
          organizer.firstName,
          organizer.lastName,
          !!organizer.avatar
        )}
        className="h-12 w-12 rounded-full object-cover"
      />

      {/* User Info */}
      <div className="flex-1">
        <div className="font-medium text-gray-900">
          {organizer.firstName} {organizer.lastName}
          {isCurrentUser && (
            <span className="ml-2 text-sm text-blue-600 font-normal">
              (You)
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {organizer.systemRole}
          {organizer.roleInAtCloud && (
            <span className="ml-2 text-gray-500">
              • {organizer.roleInAtCloud}
            </span>
          )}
        </div>
      </div>

      {/* Remove Button */}
      {!isCurrentUser && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="Remove organizer"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Event Organizers <span className="text-red-500">*</span>
      </label>

      {/* Current User - Always First */}
      <OrganizerCard organizer={currentUser} isCurrentUser />

      {/* Additional Organizers */}
      {selectedOrganizers.map((organizer) => (
        <OrganizerCard
          key={organizer.id}
          organizer={organizer}
          onRemove={() => handleRemoveOrganizer(organizer.id)}
        />
      ))}

      {/* Add Organizer Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowUserList(!showUserList)}
          className="flex items-center space-x-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors w-full justify-center"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Add Co-organizer</span>
        </button>

        {/* User Selection Dropdown */}
        {showUserList && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
            {availableUsers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No additional users available
              </div>
            ) : (
              <div className="p-2">
                {availableUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleAddOrganizer(user)}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <img
                      src={getAvatarUrl(user.avatar || null, user.gender)}
                      alt={getAvatarAlt(
                        user.firstName,
                        user.lastName,
                        !!user.avatar
                      )}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-600">
                        {user.role}
                        {user.roleInAtCloud && (
                          <span className="ml-2 text-gray-500">
                            • {user.roleInAtCloud}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close dropdown when clicking outside */}
      {showUserList && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowUserList(false)}
        />
      )}
    </div>
  );
}

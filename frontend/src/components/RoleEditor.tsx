import React, { type ChangeEvent } from "react";
import type { TemplateRole } from "../types/rolesTemplate";

interface RoleEditorProps {
  roles: TemplateRole[];
  onChange: (roles: TemplateRole[]) => void;
  canEdit?: boolean;
}

export function RoleEditor({
  roles,
  onChange,
  canEdit = true,
}: RoleEditorProps) {
  const addRole = () => {
    const newRole: TemplateRole = {
      name: "",
      description: "",
      maxParticipants: 1,
      openToPublic: false,
    };
    onChange([...roles, newRole]);
  };

  const addRoleAtPosition = (position: number) => {
    const newRole: TemplateRole = {
      name: "",
      description: "",
      maxParticipants: 1,
      openToPublic: false,
    };
    const updated = [...roles];
    updated.splice(position, 0, newRole);
    onChange(updated);
  };

  const removeRole = (index: number) => {
    const updated = [...roles];
    updated.splice(index, 1);
    onChange(updated);
  };

  const updateRole = (
    index: number,
    field: keyof TemplateRole,
    value: string | number | boolean | undefined
  ) => {
    const updated = [...roles];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const moveRole = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === roles.length - 1) return;

    const updated = [...roles];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = updated[targetIndex];
    updated[targetIndex] = updated[index];
    updated[index] = temp;
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Add Role Button (Top) - only show when there are roles */}
      {canEdit && roles.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => addRoleAtPosition(0)}
            className="px-3 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
          >
            + Add Role Here
          </button>
        </div>
      )}

      {/* Roles List */}
      {roles.map((role, index) => (
        <React.Fragment key={index}>
          <div className="p-4 border rounded-lg">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="flex-1 space-y-2">
                {canEdit ? (
                  <input
                    type="text"
                    placeholder="Role name (e.g., Participant, Speaker)"
                    value={role.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateRole(index, "name", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium text-gray-900"
                    required
                  />
                ) : (
                  <h4 className="font-medium text-gray-900">{role.name}</h4>
                )}
              </div>

              {canEdit && (
                <div className="flex flex-col items-end gap-2 min-w-[150px]">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveRole(index, "up")}
                      className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                    >
                      ↑ Move Up
                    </button>
                    <button
                      type="button"
                      disabled={index === roles.length - 1}
                      onClick={() => moveRole(index, "down")}
                      className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                    >
                      ↓ Move Down
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRole(index)}
                    className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Role Configuration Grid - matches CreateEvent layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Role Agenda */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-gray-700">Agenda</h5>
                <textarea
                  value={role.agenda || ""}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    updateRole(index, "agenda", e.target.value || undefined)
                  }
                  placeholder="Add role timing for this role..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[80px] resize-vertical"
                  rows={3}
                  disabled={!canEdit}
                />
              </div>

              {/* Role Description */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-gray-700">
                  Description
                </h5>
                {canEdit ? (
                  <textarea
                    value={role.description}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      updateRole(index, "description", e.target.value)
                    }
                    placeholder="Describe the role responsibilities..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm whitespace-pre-line min-h-[80px] resize-vertical"
                    rows={3}
                    required
                  />
                ) : (
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded whitespace-pre-line">
                    {role.description}
                  </div>
                )}
              </div>

              {/* Max Participants (Capacity) */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-gray-700">Capacity</h5>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    Max participants:
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={role.maxParticipants}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateRole(
                        index,
                        "maxParticipants",
                        parseInt(e.target.value) || 1
                      )
                    }
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                    disabled={!canEdit}
                    required
                  />
                </div>
              </div>

              {/* Open to Public Toggle */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-gray-700">
                  Public Access
                </h5>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={role.openToPublic || false}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateRole(index, "openToPublic", e.target.checked)
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={!canEdit}
                  />
                  <span className="text-sm text-gray-600">
                    Open to public registration
                  </span>
                </label>
                <p className="text-xs text-gray-500">
                  When enabled, this role will be available for public sign-up
                  when the event is published
                </p>
              </div>
            </div>
          </div>

          {/* Add Role Here button between roles */}
          {canEdit && (
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={() => addRoleAtPosition(index + 1)}
                className="px-3 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
              >
                + Add Role Here
              </button>
            </div>
          )}
        </React.Fragment>
      ))}

      {/* Empty state - show when no roles */}
      {roles.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No roles defined yet</p>
          {canEdit && (
            <button
              type="button"
              onClick={addRole}
              className="px-3 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
            >
              + Add First Role
            </button>
          )}
        </div>
      )}
    </div>
  );
}

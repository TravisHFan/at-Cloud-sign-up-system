import type { ChangeEvent } from "react";
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

  const removeRole = (index: number) => {
    const updated = [...roles];
    updated.splice(index, 1);
    onChange(updated);
  };

  const updateRole = (index: number, field: keyof TemplateRole, value: any) => {
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
      {/* Add Role Button (Top) */}
      {canEdit && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={addRole}
            className="px-4 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
          >
            + Add Role
          </button>
        </div>
      )}

      {/* Roles List */}
      {roles.map((role, index) => (
        <div key={index} className="p-4 border rounded-lg bg-white shadow-sm">
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

          {/* Role Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={role.description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  updateRole(index, "description", e.target.value)
                }
                placeholder="Describe the role responsibilities..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[80px] resize-vertical"
                rows={3}
                disabled={!canEdit}
                required
              />
            </div>

            {/* Max Participants */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Max Participants <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={role.maxParticipants}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  updateRole(
                    index,
                    "maxParticipants",
                    parseInt(e.target.value) || 1
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                disabled={!canEdit}
                required
              />
              <p className="text-xs text-gray-500">
                Number of people needed for this role
              </p>
            </div>

            {/* Agenda (Optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Agenda (Optional)
              </label>
              <textarea
                value={role.agenda || ""}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  updateRole(index, "agenda", e.target.value || undefined)
                }
                placeholder="Role-specific agenda or notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[60px] resize-vertical"
                rows={2}
                disabled={!canEdit}
              />
            </div>

            {/* Time Range (Optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Time Range (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={role.startTime || ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateRole(index, "startTime", e.target.value || undefined)
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  disabled={!canEdit}
                />
                <span className="self-center text-gray-500">to</span>
                <input
                  type="time"
                  value={role.endTime || ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateRole(index, "endTime", e.target.value || undefined)
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  disabled={!canEdit}
                />
              </div>
            </div>

            {/* Open to Public */}
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={role.openToPublic || false}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateRole(index, "openToPublic", e.target.checked)
                  }
                  className="rounded border-gray-300"
                  disabled={!canEdit}
                />
                <span className="font-medium text-gray-700">
                  Open to Public (unauthenticated users can register)
                </span>
              </label>
              <p className="text-xs text-gray-500 ml-6">
                When enabled, guests without accounts can sign up for this role
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Add Role Button (Bottom) */}
      {canEdit && roles.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={addRole}
            className="px-4 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
          >
            + Add Another Role
          </button>
        </div>
      )}

      {roles.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No roles defined yet</p>
          {canEdit && (
            <button
              type="button"
              onClick={addRole}
              className="px-4 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
            >
              + Add First Role
            </button>
          )}
        </div>
      )}
    </div>
  );
}

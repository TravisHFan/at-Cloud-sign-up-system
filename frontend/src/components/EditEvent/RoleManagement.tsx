import React from "react";
import type { ChangeEvent } from "react";
import type { UseFormSetValue } from "react-hook-form";

// FormRole interface - matches EditEvent.tsx watch type
interface FormRole {
  id: string;
  name: string;
  description: string;
  agenda?: string;
  maxParticipants: number;
  openToPublic?: boolean;
  currentSignups?: Array<unknown>;
}

interface RoleTemplate {
  _id: string;
  name: string;
  roles: Array<{
    name: string;
    description: string;
    maxParticipants: number;
    openToPublic?: boolean;
    agenda?: string;
    startTime?: string;
    endTime?: string;
  }>;
}

interface RoleValidation {
  hasWarnings: boolean;
  warnings: Record<string, string>;
}

interface RoleManagementProps {
  selectedEventType: string | null;
  formRoles: FormRole[];
  setValue: UseFormSetValue<any>;
  showTemplateSelector: boolean;
  setShowTemplateSelector: (value: boolean) => void;
  selectedTemplateId: string | null;
  setSelectedTemplateId: (value: string | null) => void;
  dbTemplates: Record<string, RoleTemplate[]>;
  highlightTemplateSelector: boolean;
  setHighlightTemplateSelector: (value: boolean) => void;
  setTemplateApplied: (value: boolean) => void;
  customizeRoles: boolean;
  setCustomizeRoles: (value: React.SetStateAction<boolean>) => void;
  highlightRoleSection: boolean;
  setHighlightRoleSection: (value: boolean) => void;
  roleValidation: RoleValidation;
  setConfirmResetModal: (value: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }) => void;
  notification: {
    warning: (message: string, options?: { title?: string }) => void;
  };
}

/**
 * RoleManagement Component
 *
 * Handles role configuration for events including:
 * - Template selector UI (single/multiple template scenarios)
 * - Role customization toggle
 * - Role CRUD operations (add, edit, remove, reorder)
 * - Role capacity and validation
 * - Public access toggle for roles
 *
 * @component
 */
const RoleManagement: React.FC<RoleManagementProps> = ({
  selectedEventType,
  formRoles,
  setValue,
  showTemplateSelector,
  setShowTemplateSelector,
  selectedTemplateId,
  setSelectedTemplateId,
  dbTemplates,
  highlightTemplateSelector,
  setHighlightTemplateSelector,
  setTemplateApplied,
  customizeRoles,
  setCustomizeRoles,
  highlightRoleSection,
  setHighlightRoleSection,
  roleValidation,
  setConfirmResetModal,
  notification,
}) => {
  return (
    <>
      {/* Template Selector UI - show when user clicks "Use Template" */}
      {selectedEventType && showTemplateSelector && (
        <div
          className={`mb-6 p-4 border border-blue-200 bg-blue-50 rounded-md transition-all duration-300 ${
            highlightTemplateSelector
              ? "ring-4 ring-blue-400 ring-opacity-75 shadow-lg scale-[1.02]"
              : ""
          }`}
        >
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            Choose a Roles Template
          </h4>
          <p className="text-xs text-gray-600 mb-3">
            {(dbTemplates[selectedEventType] || []).length === 1
              ? "Select the available template to get started."
              : "Multiple role templates are available for this event type. Select one to get started."}
          </p>
          <div className="mb-3">
            <label htmlFor="template-selector" className="sr-only">
              Choose Template
            </label>
            <select
              id="template-selector"
              value={selectedTemplateId || ""}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                setSelectedTemplateId(e.target.value || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {!selectedTemplateId && (
                <option value="">-- Select a template --</option>
              )}
              {(dbTemplates[selectedEventType] || []).map((template) => (
                <option key={template._id} value={template._id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedTemplateId) {
                  notification.warning("Please select a template first", {
                    title: "No Template Selected",
                  });
                  return;
                }
                // Apply the selected template
                const template = (dbTemplates[selectedEventType] || []).find(
                  (t) => t._id === selectedTemplateId
                );
                if (template) {
                  const formattedRoles = template.roles.map(
                    (role, index: number) => ({
                      id: `role-${index}`,
                      name: role.name,
                      description: role.description,
                      maxParticipants: role.maxParticipants,
                      currentSignups: [],
                      openToPublic: role.openToPublic,
                      agenda: role.agenda,
                      startTime: role.startTime,
                      endTime: role.endTime,
                    })
                  );
                  setValue("roles", formattedRoles);
                  setShowTemplateSelector(false);
                  setTemplateApplied(true); // Mark that a template was applied
                }
              }}
              disabled={!selectedTemplateId}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Template
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/dashboard/configure-roles-templates";
              }}
              className="px-4 py-2 text-sm bg-gray-100 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Configure Templates
            </button>
          </div>
        </div>
      )}

      {/* Role Configuration Section */}
      {selectedEventType && formRoles.length > 0 && !showTemplateSelector && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Configure Event Roles for {selectedEventType}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Set the number of participants needed for each role. These roles
            will be available for event registration.
          </p>

          {/* Configure Templates Link */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-1">Role Templates</p>
                <p className="text-xs text-gray-600">
                  Want to manage role templates for future events?
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const templatesForType =
                      dbTemplates[selectedEventType] || [];

                    if (templatesForType.length === 0) {
                      notification.warning(
                        "No templates available for this event type",
                        {
                          title: "No Templates",
                        }
                      );
                      return;
                    }

                    if (templatesForType.length === 1) {
                      // Single template scenario - show confirmation modal
                      const template = templatesForType[0];
                      setConfirmResetModal({
                        isOpen: true,
                        title:
                          "Are you sure to reset this event's role configuration with template?",
                        message:
                          "All role configurations to your current event will be lost.",
                        onConfirm: () => {
                          const formattedRoles = template.roles.map(
                            (role, index: number) => ({
                              id: `role-${index}`,
                              name: role.name,
                              description: role.description,
                              maxParticipants: role.maxParticipants,
                              currentSignups: [],
                              openToPublic: role.openToPublic,
                              agenda: role.agenda,
                              startTime: role.startTime,
                              endTime: role.endTime,
                            })
                          );
                          setValue("roles", formattedRoles);
                          setTemplateApplied(true); // Mark that a template was applied
                          // Trigger highlight effect on role section
                          setHighlightRoleSection(true);
                          setTimeout(
                            () => setHighlightRoleSection(false),
                            1200
                          );
                          setConfirmResetModal({
                            isOpen: false,
                            title: "",
                            message: "",
                            onConfirm: () => {},
                          });
                        },
                      });
                    } else {
                      // Multiple templates scenario - show confirmation then show dropdown
                      setConfirmResetModal({
                        isOpen: true,
                        title: "Are you sure to change template?",
                        message:
                          "All role configurations to your current event will be lost.",
                        onConfirm: () => {
                          // Reset to show the dropdown selector
                          setValue("roles", []);
                          setShowTemplateSelector(true);
                          setSelectedTemplateId(null);
                          // Trigger highlight effect
                          setHighlightTemplateSelector(true);
                          setTimeout(
                            () => setHighlightTemplateSelector(false),
                            1200
                          );
                          setConfirmResetModal({
                            isOpen: false,
                            title: "",
                            message: "",
                            onConfirm: () => {},
                          });
                        },
                      });
                    }
                  }}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Use Template
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href =
                      "/dashboard/configure-roles-templates";
                  }}
                  className="px-4 py-2 text-sm bg-white border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 hover:border-blue-400 transition-colors"
                >
                  Configure Templates
                </button>
              </div>
            </div>
          </div>

          {/* Customize Roles Toggle */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="text-sm text-gray-600">
              <p className="mb-1 font-medium">Customize Roles</p>
              <p className="text-xs">
                Changes apply to this event only and won't affect the event type
                template.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCustomizeRoles((v) => !v)}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            >
              {customizeRoles ? "Done" : "Customize Roles"}
            </button>
          </div>

          <div
            className={`space-y-4 transition-all duration-300 ${
              highlightRoleSection
                ? "ring-4 ring-blue-400 ring-opacity-75 shadow-lg scale-[1.02] rounded-lg p-1"
                : ""
            }`}
          >
            {customizeRoles && formRoles.length > 0 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    const newRole: FormRole = {
                      id: `role-${Date.now()}`,
                      name: "New Role",
                      description: "Describe this role",
                      agenda: "",
                      maxParticipants: 1,
                      currentSignups: [],
                    };
                    setValue("roles", [newRole, ...formRoles], {
                      shouldDirty: true,
                      shouldValidate: false,
                    });
                  }}
                  className="px-3 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
                >
                  + Add Role Here
                </button>
              </div>
            )}
            {formRoles.map((role, index) => {
              const currentCount = Array.isArray(role.currentSignups)
                ? role.currentSignups.length
                : 0;
              const minCap = currentCount;
              const removeDisabled = currentCount > 0;
              return (
                <React.Fragment key={role.id || index}>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-4 gap-3">
                      <div className="flex-1 space-y-2">
                        {customizeRoles ? (
                          <>
                            <input
                              type="text"
                              aria-label={`Role name ${index + 1}`}
                              value={formRoles[index]?.name || ""}
                              onChange={(e) => {
                                const updated = [...formRoles];
                                if (updated[index]) {
                                  updated[index] = {
                                    ...updated[index],
                                    name: e.target.value,
                                  };
                                  setValue("roles", updated, {
                                    shouldDirty: true,
                                    shouldValidate: false,
                                  });
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium text-gray-900"
                            />
                          </>
                        ) : (
                          <>
                            <h4 className="font-medium text-gray-900">
                              {role.name}
                            </h4>
                          </>
                        )}
                      </div>

                      {customizeRoles && (
                        <div className="flex flex-col items-end gap-2 min-w-[150px]">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              aria-label={`Move role ${index + 1} up`}
                              disabled={index === 0}
                              onClick={() => {
                                if (index === 0) return;
                                const updated = [...formRoles];
                                const tmp = updated[index - 1];
                                updated[index - 1] = updated[index];
                                updated[index] = tmp;
                                setValue("roles", updated, {
                                  shouldDirty: true,
                                  shouldValidate: false,
                                });
                              }}
                              className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                            >
                              ↑ Move Up
                            </button>
                            <button
                              type="button"
                              aria-label={`Move role ${index + 1} down`}
                              disabled={index === formRoles.length - 1}
                              onClick={() => {
                                if (index === formRoles.length - 1) return;
                                const updated = [...formRoles];
                                const tmp = updated[index + 1];
                                updated[index + 1] = updated[index];
                                updated[index] = tmp;
                                setValue("roles", updated, {
                                  shouldDirty: true,
                                  shouldValidate: false,
                                });
                              }}
                              className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                            >
                              ↓ Move Down
                            </button>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove role ${index + 1}`}
                            onClick={() => {
                              if (removeDisabled) return;
                              const updated = [...formRoles];
                              updated.splice(index, 1);
                              setValue("roles", updated, {
                                shouldDirty: true,
                                shouldValidate: false,
                              });
                            }}
                            disabled={removeDisabled}
                            className={`px-2 py-1 text-xs rounded border ${
                              removeDisabled
                                ? "border-gray-300 text-gray-400 cursor-not-allowed"
                                : "border-red-300 text-red-600 hover:bg-red-50"
                            }`}
                            title={
                              removeDisabled
                                ? "Cannot remove: role has registrants"
                                : "Remove role"
                            }
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Role Configuration Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Role Agenda */}
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-700">
                          Agenda
                        </h5>
                        <textarea
                          value={formRoles[index]?.agenda || ""}
                          onChange={(e) => {
                            const updated = [...formRoles];
                            if (updated[index]) {
                              updated[index] = {
                                ...updated[index],
                                agenda: e.target.value || undefined,
                              };
                              setValue("roles", updated, {
                                shouldDirty: true,
                                shouldValidate: false,
                              });
                            }
                          }}
                          placeholder="Add role timing for this role..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[80px] resize-vertical"
                          rows={3}
                        />
                      </div>

                      {/* Role Description */}
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-700">
                          Description
                        </h5>
                        {customizeRoles ? (
                          <textarea
                            aria-label={`Role description ${index + 1}`}
                            value={formRoles[index]?.description || ""}
                            onChange={(e) => {
                              const updated = [...formRoles];
                              if (updated[index]) {
                                updated[index] = {
                                  ...updated[index],
                                  description: e.target.value,
                                };
                                setValue("roles", updated, {
                                  shouldDirty: true,
                                  shouldValidate: false,
                                });
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm whitespace-pre-line min-h-[80px] resize-vertical"
                            rows={3}
                          />
                        ) : (
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded whitespace-pre-line">
                            {formRoles[index]?.description}
                          </div>
                        )}
                      </div>

                      {/* Max Participants */}
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-700">
                          Capacity
                        </h5>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">
                            Max participants:
                          </span>
                          <input
                            type="number"
                            min={minCap}
                            aria-label={`Max participants for ${
                              formRoles[index]?.name || `role ${index + 1}`
                            }`}
                            value={formRoles[index]?.maxParticipants || 0}
                            onChange={(e) => {
                              const raw = parseInt(e.target.value || "0", 10);
                              const next = isNaN(raw)
                                ? minCap
                                : Math.max(minCap, raw);
                              const updated = [...formRoles];
                              if (updated[index]) {
                                updated[index] = {
                                  ...updated[index],
                                  maxParticipants: next,
                                };
                                setValue("roles", updated, {
                                  shouldDirty: true,
                                  shouldValidate: false,
                                });
                              }
                            }}
                            className={`w-20 px-2 py-1 border rounded text-center ${
                              roleValidation.warnings[index]?.length
                                ? "border-orange-500 bg-orange-50"
                                : "border-gray-300"
                            }`}
                          />
                        </div>
                        {roleValidation.warnings[index]?.length ? (
                          <p className="text-xs text-orange-600 mt-1">
                            {roleValidation.warnings[index]}
                          </p>
                        ) : null}
                        {currentCount > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {currentCount} currently registered
                          </p>
                        )}
                      </div>

                      {/* Open to Public Toggle */}
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-700">
                          Public Access
                        </h5>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={
                              (
                                formRoles[index] as {
                                  openToPublic?: boolean;
                                }
                              )?.openToPublic || false
                            }
                            onChange={(e) => {
                              const updated = [...formRoles];
                              if (updated[index]) {
                                updated[index] = {
                                  ...updated[index],
                                  openToPublic: e.target.checked,
                                };
                                setValue("roles", updated, {
                                  shouldDirty: true,
                                  shouldValidate: false,
                                });
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-600">
                            Open to public registration
                          </span>
                        </label>
                        <p className="text-xs text-gray-500">
                          When enabled, this role will be available for public
                          sign-up when the event is published
                        </p>
                      </div>
                    </div>
                  </div>
                  {customizeRoles && (
                    <div className="flex justify-center py-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newRole: FormRole = {
                            id: `role-${Date.now()}`,
                            name: "New Role",
                            description: "Describe this role",
                            agenda: "",
                            maxParticipants: 1,
                            currentSignups: [],
                          };
                          const updated = [...formRoles];
                          updated.splice(index + 1, 0, newRole);
                          setValue("roles", updated, {
                            shouldDirty: true,
                            shouldValidate: false,
                          });
                        }}
                        className="px-3 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
                      >
                        + Add Role Here
                      </button>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

export default RoleManagement;

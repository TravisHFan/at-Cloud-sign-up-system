import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { rolesTemplateService } from "../services/api";
import type { GroupedTemplates, RolesTemplate } from "../types/rolesTemplate";
import { useAuth } from "../hooks/useAuth";

const EVENT_TYPES = [
  "Conference",
  "Webinar",
  "Effective Communication Workshop",
  "Mentor Circle",
] as const;

export default function ConfigureRolesTemplates() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [templates, setTemplates] = useState<GroupedTemplates>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    templateId: string;
    templateName: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Check if user can edit/delete a template
  const canEdit = (template: RolesTemplate): boolean => {
    if (!currentUser) return false;
    if (
      currentUser.role === "Super Admin" ||
      currentUser.role === "Administrator"
    ) {
      return true;
    }
    return template.createdBy._id === currentUser.id;
  };

  // Check if user can create templates
  const canCreate = (): boolean => {
    if (!currentUser) return false;
    return (
      currentUser.role === "Super Admin" ||
      currentUser.role === "Administrator" ||
      currentUser.role === "Leader"
    );
  };

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await rolesTemplateService.getAllTemplates();
        setTemplates(data as GroupedTemplates);
      } catch (err) {
        console.error("Failed to load templates:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load role templates"
        );
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  // Handle delete template
  const handleDelete = async (templateId: string) => {
    if (!deleteConfirm) return;

    try {
      setDeleting(true);
      await rolesTemplateService.deleteTemplate(templateId);

      // Remove from local state
      setTemplates((prev) => {
        const updated = { ...prev };
        for (const eventType in updated) {
          updated[eventType] = updated[eventType].filter(
            (t) => t._id !== templateId
          );
        }
        return updated;
      });

      // Show success message
      alert(
        `Template "${deleteConfirm.templateName}" has been deleted successfully.`
      );

      setDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete template:", err);
      alert(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading role templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Configure Event Roles Templates
          </h1>
          <p className="mt-2 text-gray-600">
            Manage role templates for different event types. Templates define
            the default roles available when creating events.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Event Types with Templates */}
        <div className="space-y-8">
          {EVENT_TYPES.map((eventType) => {
            const eventTemplates = templates[eventType] || [];

            return (
              <div
                key={eventType}
                className="bg-white rounded-lg shadow-md p-6"
              >
                {/* Event Type Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {eventType}
                  </h2>
                  {canCreate() && (
                    <button
                      onClick={() =>
                        navigate(
                          `/dashboard/create-roles-template?eventType=${eventType}`
                        )
                      }
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      + New Template
                    </button>
                  )}
                </div>

                {/* Templates List */}
                {eventTemplates.length === 0 ? (
                  <p className="text-gray-500 italic">
                    No templates yet for this event type.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {eventTemplates.map((template) => {
                      const canEditThis = canEdit(template);

                      return (
                        <div
                          key={template._id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-base font-medium text-gray-900">
                                {template.name}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {template.roles.length} role
                                {template.roles.length !== 1 ? "s" : ""}
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                Created by{" "}
                                {template.createdBy.firstName ||
                                  template.createdBy.username}{" "}
                                on{" "}
                                {new Date(
                                  template.createdAt
                                ).toLocaleDateString()}
                              </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() =>
                                  navigate(
                                    `/dashboard/edit-roles-template/${template._id}`
                                  )
                                }
                                disabled={!canEditThis}
                                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                                  canEditThis
                                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                                title={
                                  canEditThis
                                    ? "Edit template"
                                    : "You don't have permission to edit this template"
                                }
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteConfirm({
                                    templateId: template._id,
                                    templateName: template.name,
                                  })
                                }
                                disabled={!canEditThis}
                                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                                  canEditThis
                                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                                title={
                                  canEditThis
                                    ? "Delete template"
                                    : "You don't have permission to delete this template"
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {/* Role Summary */}
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Roles:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {template.roles.map((role, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                                >
                                  {role.name} ({role.maxParticipants})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Confirm Deletion
              </h3>
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete the template "
                <strong>{deleteConfirm.templateName}</strong>"? This action
                cannot be undone.
              </p>
              <p className="text-sm text-gray-600 mb-6">
                Note: Existing events using this template will not be affected.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm.templateId)}
                  disabled={deleting}
                  className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

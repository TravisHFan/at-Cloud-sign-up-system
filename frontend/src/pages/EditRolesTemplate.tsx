import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RoleEditor } from "../components/RoleEditor";
import { roleTemplateService } from "../services/api";
import type {
  TemplateRole,
  RolesTemplate,
  UpdateTemplatePayload,
} from "../types/rolesTemplate";

export default function EditRolesTemplate() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [template, setTemplate] = useState<RolesTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [roles, setRoles] = useState<TemplateRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store original values to detect changes
  const [originalName, setOriginalName] = useState("");
  const [originalRoles, setOriginalRoles] = useState<TemplateRole[]>([]);

  // Load template data
  useEffect(() => {
    if (!id) {
      setError("Template ID is missing");
      setLoading(false);
      return;
    }

    const loadTemplate = async () => {
      try {
        const data = (await roleTemplateService.getRolesTemplateById(
          id
        )) as RolesTemplate;
        setTemplate(data);
        setTemplateName(data.name);
        setRoles(data.roles);
        // Store original values
        setOriginalName(data.name);
        setOriginalRoles(JSON.parse(JSON.stringify(data.roles)));
      } catch (err) {
        console.error("Failed to load template:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load template"
        );
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [id]);

  // Detect if form has been modified
  const hasChanges = useMemo(() => {
    // Check if name changed
    if (templateName.trim() !== originalName.trim()) {
      return true;
    }

    // Check if roles count changed
    if (roles.length !== originalRoles.length) {
      return true;
    }

    // Deep comparison of roles - check ALL fields
    for (let i = 0; i < roles.length; i++) {
      const current = roles[i];
      const original = originalRoles[i];

      if (
        current.name !== original.name ||
        current.description !== original.description ||
        current.maxParticipants !== original.maxParticipants ||
        current.openToPublic !== original.openToPublic ||
        current.agenda !== original.agenda ||
        current.startTime !== original.startTime ||
        current.endTime !== original.endTime
      ) {
        return true;
      }
    }

    return false;
  }, [templateName, roles, originalName, originalRoles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!id) {
      setError("Template ID is missing");
      return;
    }

    // Validation
    if (!templateName.trim()) {
      setError("Template name is required");
      return;
    }

    if (roles.length === 0) {
      setError("At least one role is required");
      return;
    }

    // Validate all roles have required fields
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      if (!role.name.trim()) {
        setError(`Role #${i + 1}: Name is required`);
        return;
      }
      // Description is now optional - removed validation
      if (role.maxParticipants < 1) {
        setError(`Role #${i + 1}: Max participants must be at least 1`);
        return;
      }
    }

    setSaving(true);

    try {
      const payload: UpdateTemplatePayload = {
        name: templateName.trim(),
        roles,
      };

      await roleTemplateService.updateRolesTemplate(id, payload);

      // Navigate back to configure page
      navigate("/dashboard/configure-roles-templates");
    } catch (err) {
      console.error("Failed to update template:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update template"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading template...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
          <button
            onClick={() => navigate("/dashboard/configure-roles-templates")}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            ← Back to Templates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/dashboard/configure-roles-templates")}
            className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1"
          >
            ← Back to Templates
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Edit Roles Template
            {template && (
              <span className="text-gray-600"> for {template.eventType}</span>
            )}
          </h1>
          <p className="mt-2 text-gray-600">
            Modify the template configuration. Changes will not affect existing
            events.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template Basic Info */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Template Information
            </h2>

            <div className="space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Standard Conference, Small Workshop"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  A descriptive name to identify this template
                </p>
              </div>

              {/* Event Type (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Type
                </label>
                <input
                  type="text"
                  value={template?.eventType || ""}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                  disabled
                  readOnly
                />
                <p className="mt-1 text-sm text-gray-500">
                  Event type cannot be changed after creation
                </p>
              </div>

              {/* Creator Info */}
              {template?.createdBy && (
                <div className="pt-2 text-sm text-gray-600">
                  <p>
                    Created by:{" "}
                    <span className="font-medium">
                      {template.createdBy.firstName &&
                      template.createdBy.lastName
                        ? `${template.createdBy.firstName} ${template.createdBy.lastName}`
                        : template.createdBy.username}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last updated:{" "}
                    {new Date(template.updatedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Roles Configuration */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Configure Roles
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Modify the roles in this template. Changes will not affect
              existing events that were created using this template.
            </p>

            <RoleEditor roles={roles} onChange={setRoles} canEdit={true} />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pb-8">
            <button
              type="button"
              onClick={() => navigate("/dashboard/configure-roles-templates")}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !hasChanges}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !hasChanges
                  ? "No changes detected"
                  : saving
                  ? "Saving..."
                  : "Save changes"
              }
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

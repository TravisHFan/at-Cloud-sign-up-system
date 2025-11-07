import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RoleEditor } from "../components/RoleEditor";
import { roleTemplateService } from "../services/api";
import type { TemplateRole, RolesTemplate } from "../types/rolesTemplate";

export default function ViewRolesTemplate() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [template, setTemplate] = useState<RolesTemplate | null>(null);
  const [roles, setRoles] = useState<TemplateRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setRoles(data.roles);
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
            View Roles Template (Read-Only)
            {template && (
              <span className="text-gray-600"> for {template.eventType}</span>
            )}
          </h1>
          <p className="mt-2 text-gray-600">
            View the template configuration. You cannot edit templates created
            by others.
          </p>
        </div>

        {/* Read-Only Notice */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm text-blue-800 font-medium">
                Read-Only Mode
              </p>
              <p className="text-sm text-blue-700 mt-1">
                This template was created by another user. You can view it for
                reference, but you cannot make changes to it.
              </p>
            </div>
          </div>
        </div>

        {/* Template Basic Info */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Template Information
          </h2>

          <div className="space-y-4">
            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={template?.name || ""}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                disabled
                readOnly
              />
            </div>

            {/* Event Type */}
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
            </div>

            {/* Creator Info */}
            {template?.createdBy && (
              <div className="pt-2 text-sm text-gray-600">
                <p>
                  Created by:{" "}
                  <span className="font-medium">
                    {template.createdBy.firstName && template.createdBy.lastName
                      ? `${template.createdBy.firstName} ${template.createdBy.lastName}`
                      : template.createdBy.username}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Created on: {new Date(template.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  Last updated: {new Date(template.updatedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Roles Configuration (Read-Only) */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Template Roles
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Below are the roles defined in this template. All fields are
            read-only.
          </p>

          <RoleEditor roles={roles} onChange={() => {}} canEdit={false} />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pb-8 mt-6">
          <button
            type="button"
            onClick={() => navigate("/dashboard/configure-roles-templates")}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Templates
          </button>
        </div>
      </div>
    </div>
  );
}

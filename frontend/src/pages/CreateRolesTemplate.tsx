import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RoleEditor } from "../components/RoleEditor";
import { rolesTemplateService } from "../services/api";
import type { EventData } from "../types/event";
import type { RolesTemplate } from "../types/rolesTemplate";
import PopulateFromEventModal from "../components/rolesTemplate/PopulateFromEventModal";
import PopulateFromTemplateModal from "../components/rolesTemplate/PopulateFromTemplateModal";
import Icon from "../components/common/Icon";
import type {
  TemplateRole,
  CreateTemplatePayload,
} from "../types/rolesTemplate";

const EVENT_TYPES = [
  "Conference",
  "Webinar",
  "Effective Communication Workshop",
  "Mentor Circle",
];

export default function CreateRolesTemplate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedEventType = searchParams.get("eventType") || "";

  const [templateName, setTemplateName] = useState("");
  const [eventType, setEventType] = useState(preselectedEventType || "");
  const [roles, setRoles] = useState<TemplateRole[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Modal states
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Handlers for populate functionality
  const handleSelectEvent = (event: EventData) => {
    // Convert EventRole[] to TemplateRole[]
    const templateRoles: TemplateRole[] = event.roles.map((role) => ({
      name: role.name,
      description: role.description || "",
      maxParticipants: role.maxParticipants,
      openToPublic: role.openToPublic,
      agenda: role.agenda,
      startTime: role.startTime,
      endTime: role.endTime,
    }));

    setRoles(templateRoles);
    setShowEventModal(false);
    setError(null);
  };

  const handleSelectTemplate = (template: RolesTemplate) => {
    // Copy roles from template
    setRoles([...template.roles]);
    setShowTemplateModal(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!templateName.trim()) {
      setError("Template name is required");
      return;
    }

    if (!eventType) {
      setError("Event type is required");
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
      const payload: CreateTemplatePayload = {
        name: templateName.trim(),
        eventType,
        roles,
      };

      await rolesTemplateService.createTemplate(payload);

      // Navigate back to configure page
      navigate("/dashboard/configure-roles-templates");
    } catch (err) {
      console.error("Failed to create template:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create template"
      );
    } finally {
      setSaving(false);
    }
  };

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
            Create Roles Template
            {eventType && (
              <span className="text-gray-600"> for {eventType}</span>
            )}
          </h1>
          <p className="mt-2 text-gray-600">
            Create a reusable template for event roles that can be applied to
            new events
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

              {/* Event Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select event type...</option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  This template will be available when creating{" "}
                  {eventType || "this type of"} events
                </p>
              </div>
            </div>
          </div>

          {/* Roles Configuration */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Configure Roles
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Define the roles that will be available for events using this
              template. You can add, remove, and reorder roles as needed.
            </p>

            {/* Show populate buttons only when no roles exist */}
            {roles.length === 0 && eventType && (
              <div className="text-center py-4 mb-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600 mb-4">
                  Start by adding roles manually or populate from an existing
                  source
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEventModal(true)}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-2"
                  >
                    <Icon name="calendar" size="sm" />
                    Populate from Event
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className="px-4 py-2 text-sm font-medium text-green-600 bg-white border border-green-300 rounded-md hover:bg-green-50 transition-colors flex items-center gap-2"
                  >
                    <Icon name="clipboard-list" size="sm" />
                    Populate from Template
                  </button>
                </div>
              </div>
            )}

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
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creating..." : "Create Template"}
            </button>
          </div>
        </form>

        {/* Populate Modals */}
        <PopulateFromEventModal
          isOpen={showEventModal}
          onClose={() => setShowEventModal(false)}
          onSelect={handleSelectEvent}
          eventType={eventType}
        />

        <PopulateFromTemplateModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onSelect={handleSelectTemplate}
          eventType={eventType}
        />
      </div>
    </div>
  );
}

import { useState } from "react";
import Icon from "./Icon";

interface Template {
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

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Template) => void;
  templates: Template[];
  title?: string;
  message?: string;
}

export default function TemplateSelectorModal({
  isOpen,
  onClose,
  onSelectTemplate,
  templates,
  title = "Select a Template",
  message = "Choose a template to apply to this event. All current role configurations will be replaced.",
}: TemplateSelectorModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );

  if (!isOpen) return null;

  const handleConfirm = () => {
    const selectedTemplate = templates.find(
      (t) => t._id === selectedTemplateId
    );
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
      setSelectedTemplateId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-blue-100">
              <Icon name="clipboard-list" className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-4">{message}</p>

            <div className="space-y-2">
              {templates.map((template) => (
                <label
                  key={template._id}
                  className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedTemplateId === template._id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={template._id}
                    checked={selectedTemplateId === template._id}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {template.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {template.roles.length} role
                      {template.roles.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4">
            <button
              onClick={() => {
                onClose();
                setSelectedTemplateId(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedTemplateId}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

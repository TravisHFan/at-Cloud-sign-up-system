import type { EventData } from "../../types/event";

interface WorkshopGroupsSectionProps {
  event: EventData;
  isPassedEvent: boolean;
  canEditWorkshopGroup: (group: "A" | "B" | "C" | "D" | "E" | "F") => boolean;
  editingGroup: "A" | "B" | "C" | "D" | "E" | "F" | null;
  topicDraft: string;
  setTopicDraft: (value: string) => void;
  startEditTopic: (group: "A" | "B" | "C" | "D" | "E" | "F") => void;
  saveTopic: () => void;
  cancelEditTopic: () => void;
}

function WorkshopGroupsSection({
  event,
  isPassedEvent,
  canEditWorkshopGroup,
  editingGroup,
  topicDraft,
  setTopicDraft,
  startEditTopic,
  saveTopic,
  cancelEditTopic,
}: WorkshopGroupsSectionProps) {
  if (event.type !== "Effective Communication Workshop") {
    return null;
  }

  return (
    <div className="mb-8 border rounded-lg p-4 bg-gray-50">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">
        Group Practice Topics
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Each group can have a topic. Editable by Super Admin, Administrator,
        event initiator, co-organizers, and the registered Group Leader for that
        group.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(["A", "B", "C", "D", "E", "F"] as const).map((g) => {
          const topic = event.workshopGroupTopics?.[g] || "";
          const canEdit = canEditWorkshopGroup(g);
          const isEditing = editingGroup === g;
          return (
            <div
              key={g}
              className="bg-white border border-gray-200 rounded-md p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-gray-900">Group {g}</div>
                {canEdit &&
                  !isPassedEvent &&
                  (isEditing ? (
                    <div className="space-x-2">
                      <button
                        onClick={saveTopic}
                        className="px-2 py-1 text-sm bg-blue-600 text-white rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditTopic}
                        className="px-2 py-1 text-sm bg-gray-200 text-gray-800 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditTopic(g)}
                      className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      Edit
                    </button>
                  ))}
              </div>
              {isEditing ? (
                <textarea
                  value={topicDraft}
                  onChange={(e) => setTopicDraft(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 text-sm"
                  rows={3}
                  maxLength={200}
                  placeholder={`Enter topic for Group ${g} (max 200 chars)`}
                />
              ) : (
                <div className="text-sm text-gray-700 min-h-[3rem] whitespace-pre-wrap">
                  {topic ? (
                    topic
                  ) : (
                    <span className="text-gray-400">No topic set</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WorkshopGroupsSection;

import { useState } from "react";
import type { EventData } from "../types/event";
import { eventService } from "../services/api";

export type WorkshopGroup = "A" | "B" | "C" | "D" | "E" | "F";

export interface WorkshopGroupsResult {
  editingGroup: WorkshopGroup | null;
  topicDraft: string;
  setTopicDraft: (draft: string) => void;
  canEditWorkshopGroup: (group: WorkshopGroup) => boolean;
  startEditTopic: (group: WorkshopGroup) => void;
  cancelEditTopic: () => void;
  saveTopic: () => Promise<void>;
}

export interface UseWorkshopGroupsParams {
  event: EventData | null;
  currentUser: {
    id: string;
    role?: string;
  } | null;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  notification: {
    success: (message: string, options?: { title?: string }) => void;
    error: (message: string, options?: { title?: string }) => void;
  };
}

export function useWorkshopGroups({
  event,
  currentUser,
  setEvent,
  notification,
}: UseWorkshopGroupsParams): WorkshopGroupsResult {
  // Workshop group topic editing state
  const [editingGroup, setEditingGroup] = useState<WorkshopGroup | null>(null);
  const [topicDraft, setTopicDraft] = useState<string>("");

  // Permission checks for editing workshop topics
  const canEditWorkshopGroup = (group: WorkshopGroup): boolean => {
    if (!event || !currentUser) return false;
    const userRole = currentUser.role;
    if (userRole === "Super Admin" || userRole === "Administrator") return true;
    // Event initiator (createdBy matches currentUser.id)
    if (event.createdBy === currentUser.id) return true;
    // Listed co-organizers in organizerDetails
    if (event.organizerDetails?.some((o) => o.userId === currentUser.id))
      return true;
    // Registered Group {X} Leader
    const leaderRoleName = `Group ${group} Leader`;
    return event.roles.some(
      (role) =>
        role.name === leaderRoleName &&
        role.currentSignups.some((s) => s.userId === currentUser.id)
    );
  };

  const startEditTopic = (group: WorkshopGroup) => {
    if (!event) return;
    setEditingGroup(group);
    const current = event.workshopGroupTopics?.[group] || "";
    setTopicDraft(current);
  };

  const cancelEditTopic = () => {
    setEditingGroup(null);
    setTopicDraft("");
  };

  const saveTopic = async () => {
    if (!event || !editingGroup) return;
    try {
      const updated = await eventService.updateWorkshopGroupTopic(
        event.id,
        editingGroup,
        topicDraft.trim()
      );
      // Merge back minimal parts we need
      setEvent((prev) => {
        if (!prev) return prev;
        const converted: EventData = {
          ...prev,
          // keep previous roles mapping; backend returns full event, but we only need topics here
          workshopGroupTopics: updated.workshopGroupTopics || {
            ...(prev.workshopGroupTopics || {}),
            [editingGroup]: topicDraft.trim(),
          },
        };
        return converted;
      });
      notification.success(`Saved topic for Group ${editingGroup}.`, {
        title: "Workshop Topic",
      });
      setEditingGroup(null);
      setTopicDraft("");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save topic.";
      notification.error(message, {
        title: "Workshop Topic",
      });
    }
  };

  return {
    editingGroup,
    topicDraft,
    setTopicDraft,
    canEditWorkshopGroup,
    startEditTopic,
    cancelEditTopic,
    saveTopic,
  };
}

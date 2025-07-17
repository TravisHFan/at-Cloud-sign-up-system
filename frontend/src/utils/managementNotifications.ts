import { useNotifications } from "../contexts/NotificationContext";
// Management notification utilities for role changes and administrative actions

export interface ManagementAction {
  targetUserId: string;
  targetUserName: string;
  actionType: "promotion" | "demotion" | "role_change";
  fromRole: string;
  toRole: string;
  actorName: string;
  actorUserId?: string; // Add optional actor user ID
}

export function useManagementNotifications() {
  const { addNotification } = useNotifications();

  const sendManagementActionNotification = (action: ManagementAction) => {
    const {
      actionType,
      fromRole,
      toRole,
      actorName,
      targetUserName,
      targetUserId,
      actorUserId,
    } = action;

    let title = "";
    let message = "";

    switch (actionType) {
      case "promotion":
        title = "Congratulations! You've been promoted";
        message = `${actorName} has promoted you from ${fromRole} to ${toRole}. Congratulations on your new role!`;
        break;
      case "demotion":
        title = "Role Update";
        message = `${actorName} has updated your role from ${fromRole} to ${toRole}.`;
        break;
      case "role_change":
        title = "Role Changed";
        message = `${actorName} has changed your role from ${fromRole} to ${toRole}.`;
        break;
    }

    // Send bell notification
    addNotification({
      type: "management_action",
      title,
      message,
      isRead: false,
      userId: targetUserId,
      actionType,
      actionDetails: {
        fromRole,
        toRole,
        actorName,
      },
    });

    // Note: System messages for auth level changes will be created server-side
    // when the role update is processed by the backend
    if (actorUserId) {
      console.log("Auth level change processed:", {
        targetUserId,
        targetUserName,
        fromRole,
        toRole,
        actorUserId,
      });
    }
  };

  return { sendManagementActionNotification };
}

// Predefined role hierarchy for determining promotion vs demotion
export const ROLE_HIERARCHY = [
  "Participant",
  "Leader",
  "Administrator",
  "Super Admin",
];

export function getActionType(
  fromRole: string,
  toRole: string
): "promotion" | "demotion" | "role_change" {
  const fromIndex = ROLE_HIERARCHY.indexOf(fromRole);
  const toIndex = ROLE_HIERARCHY.indexOf(toRole);

  if (fromIndex === -1 || toIndex === -1) {
    return "role_change";
  }

  if (toIndex > fromIndex) {
    return "promotion";
  } else if (toIndex < fromIndex) {
    return "demotion";
  } else {
    return "role_change";
  }
}

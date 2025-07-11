import { useNotifications } from "../contexts/NotificationContext";

export interface ManagementAction {
  targetUserId: string;
  targetUserName: string;
  actionType: "promotion" | "demotion" | "role_change";
  fromRole: string;
  toRole: string;
  actorName: string;
}

export function useManagementNotifications() {
  const { addNotification } = useNotifications();

  const sendManagementActionNotification = (action: ManagementAction) => {
    const { actionType, fromRole, toRole, actorName, targetUserName } = action;
    
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

    addNotification({
      type: "management_action",
      title,
      message,
      isRead: false,
      actionType,
      actionDetails: {
        fromRole,
        toRole,
        actorName,
      },
    });

    console.log(`Management notification sent to ${targetUserName}: ${title}`);
  };

  return { sendManagementActionNotification };
}

// Predefined role hierarchy for determining promotion vs demotion
export const ROLE_HIERARCHY = [
  "Participant",
  "Leader", 
  "Administrator",
  "Super Admin"
];

export function getActionType(fromRole: string, toRole: string): "promotion" | "demotion" | "role_change" {
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

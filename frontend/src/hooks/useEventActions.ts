import type { EventData } from "../types/event";
import { eventService } from "../services/api";
import { apiFetch } from "../lib/apiClient";
import * as XLSX from "xlsx";

export interface EventActionsResult {
  handleDownloadCalendar: () => Promise<void>;
  handleExportSignups: () => void;
  handleDeleteEvent: () => Promise<void>;
  handleCancelEvent: () => Promise<void>;
}

export interface UseEventActionsParams {
  event: EventData | null;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  setManagementMode: (mode: boolean) => void;
  notification: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: (message: string, options?: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    success: (message: string, options?: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warning: (message: string, options?: any) => void;
  };
  navigate: (path: string) => void;
}

export function useEventActions({
  event,
  setEvent,
  setManagementMode,
  notification,
  navigate,
}: UseEventActionsParams): EventActionsResult {
  // Helper function to download calendar file
  const handleDownloadCalendar = async () => {
    if (!event) return;

    try {
      const response = await apiFetch(`/events/${event.id}/calendar`);
      if (!response.ok) {
        throw new Error("Failed to download calendar file");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading calendar file:", error);
      notification.error(
        "Failed to download calendar file. Please try again.",
        {
          title: "Download Failed",
        }
      );
    }
  };

  // Export signups to Excel
  const handleExportSignups = () => {
    if (!event) return;

    // Prepare data for export
    const exportData: Array<Record<string, string | number | undefined>> = [];

    event.roles.forEach((role) => {
      role.currentSignups?.forEach((signup) => {
        exportData.push({
          "First Name": signup.firstName || "",
          "Last Name": signup.lastName || "",
          Username: signup.username,
          "System Authorization Level": signup.systemAuthorizationLevel || "",
          "Role in @Cloud": signup.roleInAtCloud || "",
          Gender: signup.gender || "",
          "Event Role": role.name,
          "Role Description": role.description,
          "Signup Notes": signup.notes || "",
          "User ID": signup.userId,
        });
      });
    });

    if (exportData.length === 0) {
      notification.warning(
        "There are currently no signups to export for this event.",
        {
          title: "No Data to Export",
          autoCloseDelay: 4000,
        }
      );
      return;
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();

    // Convert data to worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Event Signups");

    // Generate filename with current date
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    const filename = `${event.title.replace(
      /\s+/g,
      "_"
    )}_signups_${today}.xlsx`;

    // Write and download the file
    XLSX.writeFile(wb, filename);

    notification.success(
      `Successfully exported signup data for ${exportData.length} participants.`,
      {
        title: "Export Complete",
        autoCloseDelay: 4000,
        actionButton: {
          text: "Export Again",
          onClick: () => handleExportSignups(),
          variant: "secondary",
        },
      }
    );
  };

  // Handle event deletion
  const handleDeleteEvent = async () => {
    if (!event) return;

    try {
      // Call the actual backend API to delete the event
      await eventService.deleteEvent(event.id);

      notification.success(
        `"${event.title}" has been permanently deleted from the system.`,
        {
          title: "Event Deleted",
          autoCloseDelay: 3000,
          actionButton: {
            text: "Browse Events",
            onClick: () => navigate("/dashboard/upcoming"),
            variant: "primary",
          },
        }
      );

      // Navigate back to upcoming events
      navigate("/dashboard/upcoming");
    } catch (error: unknown) {
      console.error("Error deleting event:", error);

      // Handle specific error cases
      let errorMessage =
        "Unable to delete the event. Please try again or contact support.";
      let errorTitle = "Deletion Failed";

      const message = error instanceof Error ? error.message : "";

      if (message.includes("participants")) {
        errorMessage =
          "Cannot delete event with registered participants. Please remove all participants first.";
        errorTitle = "Event Has Participants";
      } else if (message.includes("permissions")) {
        errorMessage =
          "You don't have permission to delete this event. Only event organizers or administrators can delete events.";
        errorTitle = "Permission Denied";
      } else if (message.includes("not found")) {
        errorMessage =
          "This event has already been deleted or no longer exists.";
        errorTitle = "Event Not Found";
      }

      notification.error(errorMessage, {
        title: errorTitle,
        actionButton: {
          text:
            errorTitle === "Event Not Found" ? "Browse Events" : "Retry Delete",
          onClick: () => {
            if (errorTitle === "Event Not Found") {
              navigate("/dashboard/upcoming");
            } else {
              handleDeleteEvent();
            }
          },
          variant: "primary",
        },
      });
    }
  };

  // Handle event cancellation
  const handleCancelEvent = async () => {
    if (!event) return;

    try {
      // Call the backend API to update event status to cancelled
      await eventService.updateEvent(event.id, {
        status: "cancelled",
        // Include organizerDetails to satisfy UpdateEventPayload contract
        organizerDetails: event.organizerDetails ?? [],
      });

      // Update local state to mark as cancelled
      const updatedEvent = { ...event, status: "cancelled" as const };
      setEvent(updatedEvent);

      notification.success(
        `"${event.title}" has been cancelled. All participants will be notified automatically.`,
        {
          title: "Event Cancelled",
          autoCloseDelay: 5000,
          actionButton: {
            text: "Undo Cancel",
            onClick: async () => {
              try {
                await eventService.updateEvent(event.id, {
                  status: "upcoming",
                  organizerDetails: event.organizerDetails ?? [],
                });
                const restoredEvent = {
                  ...event,
                  status: undefined,
                };
                setEvent(restoredEvent);
                notification.success(`"${event.title}" has been restored.`, {
                  title: "Event Restored",
                });
              } catch {
                notification.error("Unable to restore event.", {
                  title: "Restore Failed",
                });
              }
            },
            variant: "secondary",
          },
        }
      );

      // Close management mode if open
      setManagementMode(false);
    } catch (error: unknown) {
      console.error("Error cancelling event:", error);

      // Handle specific error cases
      let errorMessage =
        "Unable to cancel the event. Please try again or contact support.";
      let errorTitle = "Cancellation Failed";
      const message = error instanceof Error ? error.message : "";

      if (message.includes("permissions")) {
        errorMessage =
          "You don't have permission to cancel this event. Only event organizers or administrators can cancel events.";
        errorTitle = "Permission Denied";
      } else if (message.includes("not found")) {
        errorMessage =
          "This event has already been deleted or no longer exists.";
        errorTitle = "Event Not Found";
      }

      notification.error(errorMessage, {
        title: errorTitle,
        actionButton: {
          text:
            errorTitle === "Event Not Found" ? "Browse Events" : "Retry Cancel",
          onClick: () => {
            if (errorTitle === "Event Not Found") {
              navigate("/dashboard/upcoming");
            } else {
              handleCancelEvent();
            }
          },
          variant: "primary",
        },
      });
    }
  };

  return {
    handleDownloadCalendar,
    handleExportSignups,
    handleDeleteEvent,
    handleCancelEvent,
  };
}

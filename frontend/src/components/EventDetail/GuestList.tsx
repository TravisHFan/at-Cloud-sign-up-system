import { GuestApi } from "../../services/guestApi";
import type { EventData } from "../../types/event";

interface Guest {
  id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
}

interface GuestListProps {
  roleId: string;
  guestsByRole: Record<string, Guest[]>;
  currentUserRole: string;
  isCurrentUserOrganizer: boolean | null;
  event: EventData | null;
  notification: {
    success: (message: string, options?: { title?: string }) => void;
    error: (message: string, options?: { title?: string }) => void;
  };
  setCancelConfirm: (value: {
    open: boolean;
    roleId: string;
    guest: Guest;
  }) => void;
  setEditGuest: (value: {
    open: boolean;
    roleId: string;
    guest: Guest;
  }) => void;
}

function GuestList({
  roleId,
  guestsByRole,
  currentUserRole,
  isCurrentUserOrganizer,
  event,
  notification,
  setCancelConfirm,
  setEditGuest,
}: GuestListProps) {
  const list = guestsByRole[roleId] || [];
  if (list.length === 0) return null;
  const isAdminViewer =
    currentUserRole === "Super Admin" ||
    currentUserRole === "Administrator" ||
    isCurrentUserOrganizer;
  // Only render for admins or event organizers/co-organizers
  if (!isAdminViewer) return null;
  return (
    <div className="mt-3 space-y-1" data-testid={`admin-guests-${roleId}`}>
      <h4 className="font-medium text-gray-700">Guests:</h4>
      <div className="space-y-2">
        {list.map((g, idx) => (
          <div
            key={g.id || idx}
            className="flex items-center justify-between p-3 rounded-md bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            data-testid={`admin-guest-${g.id || idx}`}
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                Guest
              </span>
              <span className="text-gray-900 font-medium">{g.fullName}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500">
                {g.email && <span className="mr-3">{g.email}</span>}
                {g.phone && <span>{g.phone}</span>}
              </div>
              {isAdminViewer && g.id && (
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                    onClick={async () => {
                      const confirm = window.confirm(
                        "Send a fresh manage link to this guest via email?"
                      );
                      if (!confirm) return;
                      try {
                        await GuestApi.resendManageLink(g.id!, {
                          eventId: event?.id,
                        });
                        notification.success("Manage link sent to guest.", {
                          title: "Email Sent",
                        });
                      } catch (e: unknown) {
                        const message =
                          e instanceof Error
                            ? e.message
                            : "Failed to send manage link.";
                        notification.error(message, { title: "Send Failed" });
                      }
                    }}
                  >
                    Re-send manage link
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600"
                    onClick={() => {
                      setCancelConfirm({ open: true, roleId, guest: g });
                    }}
                  >
                    Cancel Guest
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700"
                    onClick={() => {
                      setEditGuest({ open: true, roleId, guest: g });
                    }}
                  >
                    Edit Guest
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GuestList;

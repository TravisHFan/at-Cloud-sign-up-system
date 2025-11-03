import { createPortal } from "react-dom";
import { GuestApi } from "../../services/guestApi";
import { eventService } from "../../services/api";
import EventDeletionModal from "../common/EventDeletionModal";
import ConfirmationModal from "../common/ConfirmationModal";
import GuestEditModal from "../common/GuestEditModal";
import NameCardActionModal from "../common/NameCardActionModal";
import ShareModal from "../share/ShareModal";
import type { EventData } from "../../types/event";

interface Guest {
  id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
}

interface EventModalsProps {
  event: EventData;
  showDeletionModal: boolean;
  setShowDeletionModal: (value: boolean) => void;
  handleDeleteEvent: () => Promise<void>;
  handleCancelEvent: () => Promise<void>;
  cancelConfirm: { open: boolean; roleId?: string; guest?: Guest };
  setCancelConfirm: (value: {
    open: boolean;
    roleId?: string;
    guest?: Guest;
  }) => void;
  guestsByRole: Record<string, Guest[]>;
  setGuestsByRole: React.Dispatch<
    React.SetStateAction<Record<string, Guest[]>>
  >;
  notification: {
    success: (message: string, options?: { title?: string }) => void;
    error: (message: string, options?: { title?: string }) => void;
  };
  editGuest: { open: boolean; roleId?: string; guest?: Guest };
  setEditGuest: (value: {
    open: boolean;
    roleId?: string;
    guest?: Guest;
  }) => void;
  nameCardModal: {
    isOpen: boolean;
    userId: string;
    userName: string;
    userRole?: string;
  };
  setNameCardModal: (value: {
    isOpen: boolean;
    userId: string;
    userName: string;
    userRole?: string;
  }) => void;
  emailModal: {
    open: boolean;
    subject: string;
    bodyHtml: string;
    includeUsers: boolean;
    includeGuests: boolean;
    sending: boolean;
  };
  setEmailModal: React.Dispatch<
    React.SetStateAction<{
      open: boolean;
      subject: string;
      bodyHtml: string;
      includeUsers: boolean;
      includeGuests: boolean;
      sending: boolean;
    }>
  >;
  emailEditorRef: React.RefObject<HTMLDivElement | null>;
  applyEditorCommand: (command: string, value?: string) => void;
  resendLinkConfirm: { open: boolean; guestId?: string; guestName?: string };
  setResendLinkConfirm: (value: {
    open: boolean;
    guestId?: string;
    guestName?: string;
  }) => void;
  showShareModal: boolean;
  setShowShareModal: (value: boolean) => void;
}

function EventModals({
  event,
  showDeletionModal,
  setShowDeletionModal,
  handleDeleteEvent,
  handleCancelEvent,
  cancelConfirm,
  setCancelConfirm,
  guestsByRole,
  setGuestsByRole,
  notification,
  editGuest,
  setEditGuest,
  nameCardModal,
  setNameCardModal,
  emailModal,
  setEmailModal,
  emailEditorRef,
  applyEditorCommand,
  resendLinkConfirm,
  setResendLinkConfirm,
  showShareModal,
  setShowShareModal,
}: EventModalsProps) {
  const id = event?.id;

  return (
    <>
      {/* Event Deletion Modal */}
      <EventDeletionModal
        isOpen={showDeletionModal}
        onClose={() => setShowDeletionModal(false)}
        onDelete={handleDeleteEvent}
        onCancel={handleCancelEvent}
        eventTitle={event.title}
      />

      {/* Guest Cancel Confirmation */}
      <ConfirmationModal
        isOpen={cancelConfirm.open}
        onClose={() => setCancelConfirm({ open: false })}
        onConfirm={async () => {
          // Immediately close the modal for snappy UX
          setCancelConfirm({ open: false });
          if (!cancelConfirm.guest?.id || !cancelConfirm.roleId) return;
          const roleId = cancelConfirm.roleId;
          const guestId = cancelConfirm.guest.id;
          const prev = guestsByRole[roleId] || [];
          const updated = prev.filter((x) => x.id !== guestId);
          // Optimistically update UI
          setGuestsByRole({ ...guestsByRole, [roleId]: updated });
          try {
            await GuestApi.adminCancelGuest(guestId, undefined, {
              eventId: event?.id,
            });
            notification.success("Guest registration cancelled.", {
              title: "Cancelled",
            });
          } catch (error: unknown) {
            // Rollback on failure
            setGuestsByRole({ ...guestsByRole, [roleId]: prev });
            notification.error(
              error instanceof Error
                ? error.message
                : "Failed to cancel guest registration.",
              { title: "Cancel Failed" }
            );
          }
        }}
        title="Cancel guest?"
        message="Cancel this guest's registration?"
        confirmText="Yes, cancel"
        type="danger"
      />

      {/* Guest Edit Modal */}
      <GuestEditModal
        isOpen={editGuest.open}
        initialName={editGuest.guest?.fullName || ""}
        initialPhone={editGuest.guest?.phone || ""}
        onClose={() => setEditGuest({ open: false })}
        onSave={async ({ fullName, phone }) => {
          if (!editGuest.guest?.id || !editGuest.roleId) return;
          const guestId = editGuest.guest.id;
          const roleId = editGuest.roleId;
          try {
            await GuestApi.adminUpdateGuest(
              guestId,
              { fullName, phone },
              { eventId: event?.id }
            );
            setGuestsByRole((prev) => {
              const list = prev[roleId] || [];
              const next = list.map((x) =>
                x.id === guestId
                  ? {
                      ...x,
                      fullName: fullName || x.fullName,
                      // if phone is an empty string, clear it; else use provided or existing
                      phone:
                        typeof phone === "string" && phone.trim().length === 0
                          ? undefined
                          : phone ?? x.phone,
                    }
                  : x
              );
              return { ...prev, [roleId]: next };
            });
            notification.success("Guest details updated.", {
              title: "Updated",
            });
            setEditGuest({ open: false });
          } catch (error: unknown) {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to update guest.";
            notification.error(message, {
              title: "Update Failed",
            });
          }
        }}
      />

      {/* Name Card Action Modal */}
      <NameCardActionModal
        isOpen={nameCardModal.isOpen}
        onClose={() => setNameCardModal({ ...nameCardModal, isOpen: false })}
        userId={nameCardModal.userId}
        userName={nameCardModal.userName}
        userRole={nameCardModal.userRole}
      />

      {/* Email Participants Modal */}
      {emailModal.open &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-participants-title"
          >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
              <div className="p-6">
                <h2
                  id="email-participants-title"
                  className="text-lg font-semibold mb-4"
                >
                  Email Participants
                </h2>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="email-subject"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Subject
                    </label>
                    <input
                      id="email-subject"
                      type="text"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={emailModal.subject}
                      onChange={(e) =>
                        setEmailModal((m) => ({
                          ...m,
                          subject: e.target.value,
                        }))
                      }
                      placeholder={`Regarding: ${event.title}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Message
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Bold"
                          className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                          onClick={() => applyEditorCommand("bold")}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          title="Italic"
                          className="px-2 py-1 text-sm border rounded hover:bg-gray-50 italic"
                          onClick={() => applyEditorCommand("italic")}
                        >
                          I
                        </button>
                        <button
                          type="button"
                          title="Bulleted list"
                          className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                          onClick={() =>
                            applyEditorCommand("insertUnorderedList")
                          }
                        >
                          ••
                        </button>
                        <button
                          type="button"
                          title="Numbered list"
                          className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                          onClick={() =>
                            applyEditorCommand("insertOrderedList")
                          }
                        >
                          1.
                        </button>
                        <button
                          type="button"
                          title="Insert link"
                          className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                          onClick={() => {
                            const url = window.prompt("Enter URL", "https://");
                            if (!url) return;
                            applyEditorCommand("createLink", url);
                          }}
                        >
                          Link
                        </button>
                        <button
                          type="button"
                          title="Clear formatting"
                          className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                          onClick={() => applyEditorCommand("removeFormat")}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div
                      ref={emailEditorRef}
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-label="Message editor"
                      aria-multiline="true"
                      className="rich-editor min-h-[180px] max-h-[360px] overflow-y-auto border rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onInput={() =>
                        setEmailModal((m) => ({
                          ...m,
                          bodyHtml: emailEditorRef.current?.innerHTML || "",
                        }))
                      }
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData("text/plain");
                        // insert as plain text to avoid messy HTML
                        document.execCommand("insertText", false, text);
                      }}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Basic formatting supported. Replies go to the organizer.
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={emailModal.includeUsers}
                        onChange={(e) =>
                          setEmailModal((m) => ({
                            ...m,
                            includeUsers: e.target.checked,
                          }))
                        }
                      />
                      Include registered users
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={emailModal.includeGuests}
                        onChange={(e) =>
                          setEmailModal((m) => ({
                            ...m,
                            includeGuests: e.target.checked,
                          }))
                        }
                      />
                      Include guests
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setEmailModal({
                        open: false,
                        subject: "",
                        bodyHtml: "",
                        includeUsers: true,
                        includeGuests: false,
                        sending: false,
                      })
                    }
                    disabled={emailModal.sending}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!id) return;
                      const subject = emailModal.subject.trim();
                      const bodyHtml = emailModal.bodyHtml.trim();
                      if (!subject || !bodyHtml) {
                        notification.error(
                          "Subject and message are required.",
                          {
                            title: "Missing Fields",
                          }
                        );
                        return;
                      }
                      try {
                        setEmailModal((m) => ({ ...m, sending: true }));
                        const res = await eventService.sendEventEmails(id, {
                          subject,
                          bodyHtml,
                          includeGuests: emailModal.includeGuests,
                          includeUsers: emailModal.includeUsers,
                        });
                        const count: number =
                          typeof res.recipientCount === "number"
                            ? res.recipientCount
                            : typeof res.sent === "number"
                            ? res.sent
                            : 0;
                        notification.success(
                          count > 0
                            ? `Email sent to ${count} recipient${
                                count === 1 ? "" : "s"
                              }.`
                            : "No recipients found for this event.",
                          { title: "Email Sent" }
                        );
                        setEmailModal({
                          open: false,
                          subject: "",
                          bodyHtml: "",
                          includeUsers: true,
                          includeGuests: false,
                          sending: false,
                        });
                      } catch (e: unknown) {
                        const message =
                          e instanceof Error
                            ? e.message
                            : "Failed to send emails.";
                        notification.error(message, { title: "Send Failed" });
                        setEmailModal((m) => ({ ...m, sending: false }));
                      }
                    }}
                    disabled={emailModal.sending}
                    className="px-4 py-2 text-sm font-medium text-white rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {emailModal.sending ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Resend Link Confirmation Modal */}
      <ConfirmationModal
        isOpen={resendLinkConfirm.open}
        onClose={() => setResendLinkConfirm({ open: false })}
        onConfirm={async () => {
          if (!resendLinkConfirm.guestId) {
            setResendLinkConfirm({ open: false });
            return;
          }
          try {
            await GuestApi.resendManageLink(resendLinkConfirm.guestId, {
              eventId: event?.id,
            });
            notification.success("Manage link sent to guest.", {
              title: "Email Sent",
            });
          } catch (e: unknown) {
            const { friendlyGenericError } = await import(
              "../../utils/errorMessages"
            );
            notification.error(
              friendlyGenericError(e, "Failed to send manage link."),
              { title: "Send Failed" }
            );
          } finally {
            setResendLinkConfirm({ open: false });
          }
        }}
        title="Send Manage Link"
        message={`Send a fresh manage link to ${resendLinkConfirm.guestName} via email?`}
        confirmText="Yes, Send Link"
        cancelText="Cancel"
        type="info"
      />

      {/* Share Modal */}
      <ShareModal
        eventId={event.id}
        publicSlug={event.publicSlug || ""}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </>
  );
}

export default EventModals;

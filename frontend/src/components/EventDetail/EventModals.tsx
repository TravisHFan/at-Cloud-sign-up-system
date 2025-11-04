import { GuestApi } from "../../services/guestApi";
import EventDeletionModal from "../common/EventDeletionModal";
import ConfirmationModal from "../common/ConfirmationModal";
import GuestEditModal from "../common/GuestEditModal";
import NameCardActionModal from "../common/NameCardActionModal";
import ShareModal from "../share/ShareModal";
import EmailParticipantsModal from "./EmailParticipantsModal";
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
      <EmailParticipantsModal
        isOpen={emailModal.open}
        eventId={event.id}
        eventTitle={event.title}
        emailModal={emailModal}
        setEmailModal={setEmailModal}
        emailEditorRef={emailEditorRef}
        applyEditorCommand={applyEditorCommand}
        notification={notification}
      />

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

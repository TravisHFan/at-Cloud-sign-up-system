import { useNavigate, useLocation } from "react-router-dom";
import ConfirmationModal from "../common/ConfirmationModal";
import { RegistrationDeletionConfirmModal } from "../RegistrationDeletionConfirmModal";
import { eventService } from "../../services/api";
import { deriveFlyerUrlForUpdate } from "../../utils/flyerUrl";
import { normalizeEventDate } from "../../utils/eventStatsUtils";
import type { EventFormData } from "../../schemas/eventSchema";
import type { OrganizerDetail } from "../../types/event";

interface FormRole {
  id: string;
  name: string;
  description: string;
  agenda?: string;
  maxParticipants: number;
  startTime?: string;
  endTime?: string;
  openToPublic?: boolean;
}

interface RoleUpdatePayload {
  id?: string;
  name: string;
  description: string;
  agenda?: string;
  maxParticipants: number;
  startTime?: string;
  endTime?: string;
  openToPublic?: boolean;
}

interface EventUpdatePayload {
  title: string;
  type: string;
  format: string;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
  timeZone?: string;
  organizer: string;
  purpose?: string;
  agenda?: string;
  location?: string;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  disclaimer?: string;
  hostedBy?: string;
  flyerUrl?: string | null;
  secondaryFlyerUrl?: string | null;
  programLabels?: string[];
  roles: RoleUpdatePayload[];
  organizerDetails: OrganizerDetail[];
  suppressNotifications?: boolean;
  forceDeleteRegistrations?: boolean;
  [key: string]: unknown;
}

interface ConfirmResetModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface RegistrationDeletionModalState {
  isOpen: boolean;
  registrationCount: number;
  userCount: number;
  guestCount: number;
  pendingFormData: EventFormData | null;
}

interface EditEventModalsProps {
  eventId: string;
  confirmResetModal: ConfirmResetModalState;
  setConfirmResetModal: (state: ConfirmResetModalState) => void;
  registrationDeletionModal: RegistrationDeletionModalState;
  setRegistrationDeletionModal: (state: RegistrationDeletionModalState) => void;
  setIsSubmitting: (value: boolean) => void;
  sendNotificationsPref: boolean | null;
  organizerDetails: OrganizerDetail[];
  originalFlyerUrl: string | null;
  originalSecondaryFlyerUrl: string | null;
  notification: {
    success: (
      message: string,
      options?: { title?: string; autoCloseDelay?: number }
    ) => void;
    error: (message: string, options?: { title?: string }) => void;
  };
}

export default function EditEventModals({
  eventId,
  confirmResetModal,
  setConfirmResetModal,
  registrationDeletionModal,
  setRegistrationDeletionModal,
  setIsSubmitting,
  sendNotificationsPref,
  organizerDetails,
  originalFlyerUrl,
  originalSecondaryFlyerUrl,
  notification,
}: EditEventModalsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleRegistrationDeletionConfirm = async () => {
    // User confirmed - proceed with update and force delete registrations
    const formData = registrationDeletionModal.pendingFormData;
    if (!formData) return;

    try {
      setIsSubmitting(true);

      // Close modal first
      setRegistrationDeletionModal({
        isOpen: false,
        registrationCount: 0,
        userCount: 0,
        guestCount: 0,
        pendingFormData: null,
      });

      // Build payload with forceDeleteRegistrations flag
      const normalizedDate = normalizeEventDate(formData.date);
      const payload: EventUpdatePayload = {
        title: formData.title,
        type: formData.type,
        format: formData.format,
        date: normalizedDate,
        endDate: formData.endDate || normalizedDate,
        time: formData.time,
        endTime: formData.endTime,
        timeZone: formData.timeZone,
        organizer: formData.organizer,
        purpose: formData.purpose,
        agenda: formData.agenda,
        location: formData.location,
        disclaimer: formData.disclaimer,
        hostedBy: formData.hostedBy,
        flyerUrl: deriveFlyerUrlForUpdate(originalFlyerUrl, formData.flyerUrl),
        secondaryFlyerUrl: deriveFlyerUrlForUpdate(
          originalSecondaryFlyerUrl,
          formData.secondaryFlyerUrl
        ),
        programLabels:
          (formData as { programLabels?: string[] }).programLabels || [],
        roles: (formData.roles || []).map(
          (r: FormRole & { startTime?: string; endTime?: string }) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            agenda: r.agenda,
            maxParticipants: Number(r.maxParticipants || 0),
            startTime: r.startTime,
            endTime: r.endTime,
            openToPublic: r.openToPublic === true,
          })
        ),
        organizerDetails: organizerDetails || [],
        forceDeleteRegistrations: true, // IMPORTANT: Force delete all registrations
      };

      // Handle format-specific fields
      if (
        payload.format === "Online" ||
        payload.format === "Hybrid Participation"
      ) {
        payload.zoomLink = formData.zoomLink || "";
        payload.meetingId = formData.meetingId || "";
        payload.passcode = formData.passcode || "";
        if (payload.format === "Online") {
          payload.location = "Online";
        }
      } else if (payload.format === "In-person") {
        delete (payload as { zoomLink?: string }).zoomLink;
        delete (payload as { meetingId?: string }).meetingId;
        delete (payload as { passcode?: string }).passcode;
      }

      if (sendNotificationsPref === false) {
        payload.suppressNotifications = true;
      }

      await eventService.updateEvent(eventId, payload);
      notification.success(
        "Event updated successfully! All registrations have been removed.",
        {
          title: "Success",
          autoCloseDelay: 3000,
        }
      );

      const state = (location.state as { returnTo?: string } | null) || null;
      const returnTo = state?.returnTo || "/dashboard/upcoming";
      navigate(returnTo);
    } catch (error) {
      console.error("Error updating event:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";
      notification.error(errorMessage, {
        title: "Error",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Confirmation Modal for template reset */}
      <ConfirmationModal
        isOpen={confirmResetModal.isOpen}
        onClose={() =>
          setConfirmResetModal({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: () => {},
          })
        }
        onConfirm={confirmResetModal.onConfirm}
        title={confirmResetModal.title}
        message={confirmResetModal.message}
        confirmText="Yes"
        cancelText="Cancel"
        type="warning"
      />

      {/* Confirmation Modal for registration deletion when applying template */}
      <RegistrationDeletionConfirmModal
        isOpen={registrationDeletionModal.isOpen}
        registrationCount={registrationDeletionModal.registrationCount}
        userCount={registrationDeletionModal.userCount}
        guestCount={registrationDeletionModal.guestCount}
        onCancel={() => {
          setRegistrationDeletionModal({
            isOpen: false,
            registrationCount: 0,
            userCount: 0,
            guestCount: 0,
            pendingFormData: null,
          });
          setIsSubmitting(false);
        }}
        onConfirm={handleRegistrationDeletionConfirm}
      />
    </>
  );
}

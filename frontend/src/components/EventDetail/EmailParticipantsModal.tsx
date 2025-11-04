import { createPortal } from "react-dom";
import { eventService } from "../../services/api";

interface EmailParticipantsModalProps {
  isOpen: boolean;
  eventId: string;
  eventTitle: string;
  emailModal: {
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
  notification: {
    success: (message: string, options?: { title?: string }) => void;
    error: (message: string, options?: { title?: string }) => void;
  };
}

/**
 * EmailParticipantsModal - Modal for composing and sending emails to event participants
 *
 * Features:
 * - Rich text editor with formatting toolbar (bold, italic, lists, links)
 * - Subject line input
 * - Checkboxes to include registered users and/or guests
 * - Paste as plain text to avoid formatting issues
 * - Loading state during email send
 * - Recipient count feedback
 */
export default function EmailParticipantsModal({
  isOpen,
  eventId,
  eventTitle,
  emailModal,
  setEmailModal,
  emailEditorRef,
  applyEditorCommand,
  notification,
}: EmailParticipantsModalProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    setEmailModal({
      open: false,
      subject: "",
      bodyHtml: "",
      includeUsers: true,
      includeGuests: false,
      sending: false,
    });
  };

  const handleSend = async () => {
    const subject = emailModal.subject.trim();
    const bodyHtml = emailModal.bodyHtml.trim();

    if (!subject || !bodyHtml) {
      notification.error("Subject and message are required.", {
        title: "Missing Fields",
      });
      return;
    }

    try {
      setEmailModal((m) => ({ ...m, sending: true }));
      const res = await eventService.sendEventEmails(eventId, {
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
          ? `Email sent to ${count} recipient${count === 1 ? "" : "s"}.`
          : "No recipients found for this event.",
        { title: "Email Sent" }
      );

      handleClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to send emails.";
      notification.error(message, { title: "Send Failed" });
      setEmailModal((m) => ({ ...m, sending: false }));
    }
  };

  return createPortal(
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
            {/* Subject Input */}
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
                placeholder={`Regarding: ${eventTitle}`}
              />
            </div>

            {/* Rich Text Editor */}
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
                    onClick={() => applyEditorCommand("insertUnorderedList")}
                  >
                    ••
                  </button>
                  <button
                    type="button"
                    title="Numbered list"
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                    onClick={() => applyEditorCommand("insertOrderedList")}
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

            {/* Recipient Checkboxes */}
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

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={emailModal.sending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
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
  );
}

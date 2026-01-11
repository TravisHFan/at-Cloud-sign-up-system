import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

/**
 * Recipient options for events (registered users and guests)
 */
export interface EventRecipientOptions {
  type: "event";
  includeUsers: boolean;
  includeGuests: boolean;
}

/**
 * Recipient options for programs (mentors, class reps, mentees)
 */
export interface ProgramRecipientOptions {
  type: "program";
  includeMentors: boolean;
  includeClassReps: boolean;
  includeMentees: boolean;
}

export type RecipientOptions = EventRecipientOptions | ProgramRecipientOptions;

export interface EmailModalState<
  T extends RecipientOptions = RecipientOptions
> {
  open: boolean;
  subject: string;
  bodyHtml: string;
  sending: boolean;
  recipients: T;
}

interface EmailParticipantsModalProps<T extends RecipientOptions> {
  isOpen: boolean;
  title: string; // Event or Program title
  modalTitle?: string; // Custom modal title, defaults to "Email Participants"
  emailModal: EmailModalState<T>;
  setEmailModal: React.Dispatch<React.SetStateAction<EmailModalState<T>>>;
  emailEditorRef: React.RefObject<HTMLDivElement | null>;
  applyEditorCommand: (command: string, value?: string) => void;
  onSend: () => Promise<void>;
  onClose: () => void;
  /** Render recipient checkboxes based on type */
  renderRecipientOptions: () => React.ReactNode;
  /** Optional: Initial body content (e.g., meeting agenda link) */
  initialBodyHtml?: string;
}

/**
 * EmailParticipantsModal - Reusable modal for composing and sending emails to participants
 *
 * Features:
 * - Rich text editor with formatting toolbar (bold, italic, lists, links)
 * - Subject line input
 * - Configurable recipient checkboxes (different for events vs programs)
 * - Paste as plain text to avoid formatting issues
 * - Loading state during email send
 */
export default function EmailParticipantsModal<T extends RecipientOptions>({
  isOpen,
  title,
  modalTitle = "Email Participants",
  emailModal,
  setEmailModal,
  emailEditorRef,
  applyEditorCommand,
  onSend,
  onClose,
  renderRecipientOptions,
  initialBodyHtml,
}: EmailParticipantsModalProps<T>) {
  const hasInitializedRef = useRef(false);

  // Initialize default text when modal opens (only once per open)
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    if (!hasInitializedRef.current && initialBodyHtml) {
      hasInitializedRef.current = true;
      setEmailModal((prev) => {
        if (prev.bodyHtml.trim().length > 0) return prev;
        return { ...prev, bodyHtml: initialBodyHtml };
      });
    }
  }, [isOpen, initialBodyHtml, setEmailModal]);

  // Sync editor innerHTML when bodyHtml state changes
  useEffect(() => {
    if (emailEditorRef.current && emailModal.bodyHtml) {
      if (emailEditorRef.current.innerHTML !== emailModal.bodyHtml) {
        emailEditorRef.current.innerHTML = emailModal.bodyHtml;
      }
    }
  }, [emailModal.bodyHtml, emailEditorRef]);

  if (!isOpen) return null;

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
            {modalTitle}
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
                placeholder={`Regarding: ${title}`}
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

            {/* Recipient Checkboxes - rendered by parent */}
            <div className="flex items-center gap-6 flex-wrap">
              {renderRecipientOptions()}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={emailModal.sending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSend}
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

import { useState, useEffect, useRef } from "react";

export interface EmailModalState {
  open: boolean;
  subject: string;
  bodyHtml: string;
  includeUsers: boolean;
  includeGuests: boolean;
  sending: boolean;
}

export interface EmailModalResult {
  emailModal: EmailModalState;
  setEmailModal: React.Dispatch<React.SetStateAction<EmailModalState>>;
  emailEditorRef: React.RefObject<HTMLDivElement | null>;
  savedSelection: React.MutableRefObject<Range | null>;
  applyEditorCommand: (command: string, value?: string) => void;
}

export function useEmailModal(): EmailModalResult {
  const [emailModal, setEmailModal] = useState<EmailModalState>({
    open: false,
    subject: "",
    bodyHtml: "",
    includeUsers: true,
    includeGuests: false,
    sending: false,
  });
  const emailEditorRef = useRef<HTMLDivElement | null>(null);
  const savedSelection = useRef<Range | null>(null);

  // Initialize editor content only when opening to avoid caret jumping on every input
  useEffect(() => {
    if (emailModal.open && emailEditorRef.current) {
      emailEditorRef.current.innerHTML = emailModal.bodyHtml || "";
    }
    // Intentionally exclude emailModal.bodyHtml to prevent resetting caret on each keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailModal.open]);

  // Track and preserve selection within the editor so toolbar actions apply at caret
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      const editor = emailEditorRef.current;
      if (!sel || !editor || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (
        editor.contains(range.startContainer) &&
        editor.contains(range.endContainer)
      ) {
        savedSelection.current = range;
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const applyEditorCommand = (command: string, value?: string) => {
    const editor = emailEditorRef.current;
    if (!editor) return;
    // prevent losing caret and restore selection if available
    editor.focus();
    const sel = window.getSelection();
    if (savedSelection.current && sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedSelection.current);
      } catch {
        // ignore selection restoration errors
      }
    }
    document.execCommand(command, false, value);
    // sync state after command
    setEmailModal((m) => ({ ...m, bodyHtml: editor.innerHTML }));
  };

  return {
    emailModal,
    setEmailModal,
    emailEditorRef,
    savedSelection,
    applyEditorCommand,
  };
}

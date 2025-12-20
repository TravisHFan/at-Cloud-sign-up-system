import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import useShortLink from "../../hooks/useShortLink";

interface ShareModalProps {
  eventId: string;
  publicSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

// Basic accessible modal (focus trap & ESC close) - lightweight for now.
export const ShareModal: React.FC<ShareModalProps> = ({
  eventId,
  publicSlug,
  isOpen,
  onClose,
}) => {
  const { load, record, status, loading, error, copy, copied } =
    useShortLink(eventId);
  const firstFocusable = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      void load();
      // focus first button after microtask
      setTimeout(() => firstFocusable.current?.focus(), 0);
    }
  }, [isOpen, load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortUrl = record?.url;
  const stateLabel = status?.state;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share Event"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-md bg-white shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-100">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Share Event</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring dark:hover:bg-gray-700"
            ref={firstFocusable}
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-4 text-sm">
          <div>
            <span className="font-medium">Public Page:</span>{" "}
            <code className="break-all text-blue-600 dark:text-blue-400">
              /p/{publicSlug}
            </code>
          </div>

          <div className="space-y-1">
            <span className="font-medium">Short Link:</span>
            {loading && <div className="text-gray-500">Generating…</div>}
            {error && (
              <div className="text-red-600" role="alert">
                {error}
              </div>
            )}
            {!loading && !error && shortUrl && (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shortUrl}
                  className="flex-1 truncate rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-mono dark:border-gray-600 dark:bg-gray-900"
                />
                <button
                  onClick={() => copy()}
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
            {status && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Status: {stateLabel}
              </div>
            )}
          </div>

          {status?.state === "expired" && (
            <div className="rounded bg-amber-50 p-2 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              This short link has expired (event has ended).
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-gray-200 px-4 py-2 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded bg-gray-800 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring dark:bg-gray-600 dark:hover:bg-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ShareModal;

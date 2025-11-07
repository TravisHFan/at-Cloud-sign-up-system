import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  ExclamationTriangleIcon,
  LightBulbIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../hooks/useAuth";
import { apiClient, fileService } from "../services/api";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { getAvatarUrlWithCacheBust } from "../utils/avatarUtils";

// Feedback schema
const feedbackSchema = yup.object({
  type: yup
    .string()
    .oneOf(["bug", "improvement", "general"], "Please select a feedback type")
    .required("Please select a feedback type"),
  subject: yup
    .string()
    .min(5, "Subject must be at least 5 characters")
    .max(200, "Subject must be less than 200 characters")
    .required("Subject is required"),
  // We'll validate message based on HTML textContent length
  message: yup.string().required("Message is required"),
  includeContact: yup.boolean().default(false),
});

type FeedbackForm = yup.InferType<typeof feedbackSchema>;

export default function Feedback() {
  const { currentUser } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { success, error } = useToastReplacement();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
    setValue,
  } = useForm<FeedbackForm>({
    resolver: yupResolver(feedbackSchema),
    defaultValues: {
      type: "general",
      includeContact: false,
    },
  });

  // Keep RHF wired for message validation/error display
  watch("message", "");
  const watchedType = watch("type", "general");

  // Rich-text editor refs and helpers (reuse approach from EventDetail)
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelection = useRef<Range | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      const editor = editorRef.current;
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
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (savedSelection.current && sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedSelection.current);
      } catch (err) {
        // Selection restoration can fail in edge cases; safely ignore
        void err;
      }
    }
    document.execCommand(command, false, value);
    // Keep RHF in sync after formatting changes
    const html = editorRef.current?.innerHTML || "";
    setValue("message", html, { shouldValidate: true, shouldDirty: true });
  };

  // no-op helper reserved for future syncing if needed

  // Insert image at caret
  const insertImageAtCaret = (url: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const img = document.createElement("img");
    img.src = url;
    img.alt = "uploaded";
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    // execCommand insertImage keeps caret placement consistent
    document.execCommand("insertImage", false, url);
    // Sync with RHF after mutation
    const html = editorRef.current?.innerHTML || "";
    setValue("message", html, { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = async (data: FeedbackForm) => {
    try {
      // Validate editor content length
      const html = editorRef.current?.innerHTML || "";
      const text = editorRef.current?.textContent?.trim() || "";
      if (text.length < 10) {
        throw new Error("Message must be at least 10 characters");
      }
      if (text.length > 2000) {
        throw new Error("Message must be less than 2000 characters");
      }

      await apiClient.submitFeedback({
        ...data,
        message: html,
      });

      setIsSubmitted(true);
      success(
        "Feedback submitted successfully! Thank you for helping us improve."
      );
      reset();
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      error(err instanceof Error ? err.message : "Failed to submit feedback.");
    }
  };

  const getFeedbackTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return <ExclamationTriangleIcon className="w-5 h-5" />;
      case "improvement":
        return <LightBulbIcon className="w-5 h-5" />;
      case "general":
        return <ChatBubbleLeftRightIcon className="w-5 h-5" />;
      default:
        return <ChatBubbleLeftRightIcon className="w-5 h-5" />;
    }
  };

  const getFeedbackTypeDescription = (type: string) => {
    switch (type) {
      case "bug":
        return "Found something that's not working as expected? Let us know!";
      case "improvement":
        return "Have ideas to make our system even better? We'd love to hear them!";
      case "general":
        return "Questions, compliments, or anything else on your mind.";
      default:
        return "";
    }
  };

  const getFeedbackTypeColor = (type: string) => {
    switch (type) {
      case "bug":
        return "text-red-600 bg-red-50 border-red-200 hover:bg-red-100";
      case "improvement":
        return "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100";
      case "general":
        return "text-green-600 bg-green-50 border-green-200 hover:bg-green-100";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100";
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Thank you for your feedback!
          </h2>
          <p className="text-gray-600 mb-6">
            Your message has been sent to our team. We'll review it and get back
            to you if needed.
          </p>
          <button
            onClick={() => setIsSubmitted(false)}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Send Another Feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Feedback</h1>
        <p className="text-gray-600">
          Help us improve @Cloud by sharing your thoughts, reporting bugs, or
          suggesting new features.
        </p>
      </div>

      {/* User Info Display */}
      {currentUser && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Feedback from:
          </h3>
          <div className="flex items-center space-x-3">
            <img
              className="w-10 h-10 rounded-full object-cover"
              src={getAvatarUrlWithCacheBust(
                currentUser.avatar || null,
                (currentUser.gender ?? "female") as "male" | "female"
              )}
              alt={`${currentUser.firstName} ${currentUser.lastName}`}
            />
            <div>
              <p className="font-medium text-gray-900">
                {currentUser.firstName} {currentUser.lastName}
              </p>
              <p className="text-sm text-gray-600">{currentUser.email}</p>
              {currentUser.roleInAtCloud && (
                <p className="text-xs text-gray-500">
                  {currentUser.roleInAtCloud}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Feedback Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            What type of feedback do you have?
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {["bug", "improvement", "general"].map((type) => (
              <label
                key={type}
                className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                  watchedType === type
                    ? getFeedbackTypeColor(type)
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <input
                  {...register("type")}
                  type="radio"
                  value={type}
                  className="sr-only"
                />
                <div className="flex items-center">
                  <div className="mr-3">{getFeedbackTypeIcon(type)}</div>
                  <div>
                    <div className="font-medium capitalize">{type} Report</div>
                    <div className="text-xs mt-1">
                      {getFeedbackTypeDescription(type)}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
          {errors.type && (
            <p className="mt-2 text-sm text-red-600">{errors.type.message}</p>
          )}
        </div>

        {/* Subject */}
        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Subject
          </label>
          <input
            {...register("subject")}
            type="text"
            id="subject"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Brief summary of your feedback"
          />
          {errors.subject && (
            <p className="mt-2 text-sm text-red-600">
              {errors.subject.message}
            </p>
          )}
        </div>

        {/* Message (Rich Text) */}
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
              {/* Paperclip upload */}
              <label className="px-2 py-1 text-sm border rounded hover:bg-gray-50 cursor-pointer">
                📎
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    // Capture the input element immediately to avoid React event pooling issues
                    const inputEl = e.currentTarget;
                    const file = inputEl.files?.[0];
                    if (!file) return;
                    try {
                      const { url } = await fileService.uploadGenericImage(
                        file
                      );
                      insertImageAtCaret(url);
                    } catch (err) {
                      console.error("Image upload failed", err);
                      error("Failed to upload image");
                    } finally {
                      // Safely reset the input so selecting the same file again re-triggers change
                      inputEl.value = "";
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="rich-editor min-h-[180px] max-h-[360px] overflow-y-auto border rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-placeholder="Please provide detailed information about your feedback..."
            onInput={() => {
              // Keep RHF value in sync so validation and submission work
              const html = editorRef.current?.innerHTML || "";
              setValue("message", html, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onPaste={async (e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              for (const item of items as unknown as DataTransferItem[]) {
                if (item.kind === "file" && item.type.startsWith("image/")) {
                  e.preventDefault();
                  const file = item.getAsFile();
                  if (!file) continue;
                  try {
                    const { url } = await fileService.uploadGenericImage(file);
                    insertImageAtCaret(url);
                  } catch (err) {
                    console.error("Paste image upload failed", err);
                    error("Failed to insert pasted image");
                  }
                }
              }
              // Ensure value is synced even when pasting non-images
              const html = editorRef.current?.innerHTML || "";
              setValue("message", html, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          {/* Hidden input to register with RHF so errors display */}
          <input
            id="feedback-message-hidden"
            type="hidden"
            {...register("message")}
          />
          {errors.message && (
            <p className="mt-2 text-sm text-red-600">
              {errors.message.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            You can paste screenshots or click the paperclip to attach images.
          </p>
        </div>

        {/* Include Contact Info */}
        <div className="flex items-center">
          <input
            {...register("includeContact")}
            id="includeContact"
            type="checkbox"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="includeContact"
            className="ml-2 block text-sm text-gray-700"
          >
            I'm okay with the team contacting me about this feedback
          </label>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Clear Form
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

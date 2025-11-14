import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import Feedback from "../../pages/Feedback";

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      _id: "user123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      roleInAtCloud: "Administrator",
      avatar: null,
      gender: "female" as const,
    },
  }),
}));

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

const mockSubmitFeedback = vi.fn();
const mockUploadImage = vi.fn();

vi.mock("../../services/api", () => ({
  apiClient: {
    submitFeedback: (...args: unknown[]) => mockSubmitFeedback(...args),
  },
  fileService: {
    uploadGenericImage: (...args: unknown[]) => mockUploadImage(...args),
  },
}));

describe("Feedback page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders feedback form with heading and description", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    expect(screen.getByText("Feedback")).toBeInTheDocument();
    expect(
      screen.getByText(
        /help us improve @cloud by sharing your thoughts, reporting bugs/i
      )
    ).toBeInTheDocument();
  });

  it("displays current user information", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    expect(screen.getByText("Feedback from:")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByAltText("Test User")).toBeInTheDocument();
  });

  it("renders three feedback type options", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    expect(screen.getByText(/bug report/i)).toBeInTheDocument();
    expect(screen.getByText(/improvement report/i)).toBeInTheDocument();
    expect(screen.getByText(/general report/i)).toBeInTheDocument();

    // Check descriptions
    expect(
      screen.getByText(/found something that's not working as expected/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/have ideas to make our system even better/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/questions, compliments, or anything else/i)
    ).toBeInTheDocument();
  });

  it("defaults to general feedback type", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const generalRadio = screen.getByRole("radio", {
      name: /general report/i,
    }) as HTMLInputElement;
    expect(generalRadio.checked).toBe(true);
  });

  it("allows switching feedback types", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const bugRadio = screen.getByRole("radio", { name: /bug report/i });
    await user.click(bugRadio);

    expect((bugRadio as HTMLInputElement).checked).toBe(true);
  });

  it("renders subject input field", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    expect(subjectInput).toBeInTheDocument();
    expect(subjectInput).toHaveAttribute(
      "placeholder",
      "Brief summary of your feedback"
    );
  });

  it("renders rich text editor toolbar", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    expect(screen.getByTitle("Bold")).toBeInTheDocument();
    expect(screen.getByTitle("Italic")).toBeInTheDocument();
    expect(screen.getByTitle("Bulleted list")).toBeInTheDocument();
    expect(screen.getByTitle("Numbered list")).toBeInTheDocument();
    expect(screen.getByTitle("Insert link")).toBeInTheDocument();
    expect(screen.getByTitle("Clear formatting")).toBeInTheDocument();
  });

  it("renders message editor with placeholder", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const editor = document.querySelector('[contenteditable="true"]');
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute("data-placeholder");
  });

  it("renders includeContact checkbox", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const checkbox = screen.getByLabelText(
      /i'm okay with the team contacting me/i
    );
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute("type", "checkbox");
  });

  it("renders Clear Form and Submit Feedback buttons", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("button", { name: /clear form/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit feedback/i })
    ).toBeInTheDocument();
  });

  it("validates subject field minimum length", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    await user.type(subjectInput, "Hi");

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/subject must be at least 5 characters/i)
      ).toBeInTheDocument();
    });
  });

  it("validates subject field maximum length", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    const longText = "a".repeat(201);
    await user.type(subjectInput, longText);

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/subject must be less than 200 characters/i)
      ).toBeInTheDocument();
    });
  });

  it("submits feedback successfully with valid data", async () => {
    const user = userEvent.setup();
    mockSubmitFeedback.mockResolvedValue({ success: true });

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    // Fill in subject
    const subjectInput = screen.getByLabelText(/subject/i);
    await user.type(subjectInput, "Test Subject");

    // Fill in message via contentEditable
    const editor = document.querySelector(
      '[contenteditable="true"]'
    ) as HTMLElement;
    await user.click(editor);

    // Simulate typing in contentEditable
    editor.textContent = "This is a test feedback message with enough content.";
    editor.dispatchEvent(new Event("input", { bubbles: true })); // Submit form
    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "general",
          subject: "Test Subject",
          includeContact: false,
        })
      );
    });

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Feedback submitted successfully")
      );
    });
  });

  it("shows success state after submission", async () => {
    const user = userEvent.setup();
    mockSubmitFeedback.mockResolvedValue({ success: true });

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    await user.type(subjectInput, "Test Subject");

    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;

    editor.textContent = "This is a test feedback message with enough content.";
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/thank you for your feedback!/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/your message has been sent to our team/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send another feedback/i })
    ).toBeInTheDocument();
  });

  it("returns to form after sending another feedback", async () => {
    const user = userEvent.setup();
    mockSubmitFeedback.mockResolvedValue({ success: true });

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    // Submit feedback
    const subjectInput = screen.getByLabelText(/subject/i);
    await user.type(subjectInput, "First feedback");

    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;

    editor.textContent = "First feedback message with enough content.";
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    await user.click(screen.getByRole("button", { name: /submit feedback/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/thank you for your feedback!/i)
      ).toBeInTheDocument();
    });

    // Click "Send Another Feedback"
    const sendAnotherButton = screen.getByRole("button", {
      name: /send another feedback/i,
    });
    await user.click(sendAnotherButton);

    // Should return to form
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit feedback/i })
    ).toBeInTheDocument();
  });

  it("handles submission error gracefully", async () => {
    const user = userEvent.setup();
    mockSubmitFeedback.mockRejectedValue(new Error("Network error"));

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    await user.type(subjectInput, "Test Subject");

    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;

    editor.textContent = "Test message with enough content to pass validation.";
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith("Network error");
    });
  });

  it("validates message minimum length", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    await user.type(subjectInput, "Valid Subject");

    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;

    editor.textContent = "Short";
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining("at least 10 characters")
      );
    });
  });

  it("validates message maximum length", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    await user.type(subjectInput, "Valid Subject");

    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;

    editor.textContent = "a".repeat(2001);
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining("less than 2000 characters")
      );
    });
  });

  it("clears form when Clear Form button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const subjectInput = screen.getByLabelText(/subject/i) as HTMLInputElement;
    await user.type(subjectInput, "Test Subject");

    const clearButton = screen.getByRole("button", { name: /clear form/i });
    await user.click(clearButton);

    await waitFor(() => {
      expect(subjectInput.value).toBe("");
    });
  });

  it("shows submitting state while form is submitting", async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    mockSubmitFeedback.mockReturnValue(submitPromise);

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    await user.type(subjectInput, "Test Subject");

    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;

    editor.textContent = "Test message with enough content.";
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    const submitButton = screen.getByRole("button", {
      name: /submit feedback/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/submitting.../i)).toBeInTheDocument();
    });

    expect(submitButton).toBeDisabled();

    resolveSubmit!();
  });

  it("allows selecting includeContact checkbox", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const checkbox = screen.getByLabelText(
      /i'm okay with the team contacting me/i
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await user.click(checkbox);

    expect(checkbox.checked).toBe(true);
  });

  it("displays image upload hint text", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/you can paste screenshots or click the paperclip/i)
    ).toBeInTheDocument();
  });

  it("renders file upload button (paperclip)", () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    );

    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThan(0);
  });
});

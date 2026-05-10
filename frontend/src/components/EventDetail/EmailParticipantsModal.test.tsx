import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";
import EmailParticipantsModal from "./EmailParticipantsModal";
import useShortLink from "../../hooks/useShortLink";

vi.mock("../../hooks/useShortLink", () => ({
  default: vi.fn(),
}));

vi.mock("../../services/api", () => ({
  eventService: {
    sendEventEmails: vi.fn(),
  },
}));

const mockUseShortLink = vi.mocked(useShortLink);

function renderModal() {
  function Harness() {
    const emailEditorRef = useRef<HTMLDivElement | null>(null);
    const [emailModal, setEmailModal] = useState({
      open: true,
      subject: "",
      bodyHtml: "",
      includeUsers: true,
      includeGuests: false,
      sending: false,
    });

    return (
      <EmailParticipantsModal
        isOpen={emailModal.open}
        eventId="event-1"
        eventTitle="Webinar"
        publicSlug="webinar"
        emailModal={emailModal}
        setEmailModal={setEmailModal}
        emailEditorRef={emailEditorRef}
        applyEditorCommand={vi.fn()}
        notification={{
          success: vi.fn(),
          error: vi.fn(),
        }}
      />
    );
  }

  return render(<Harness />);
}

describe("EventDetail EmailParticipantsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses an absolute short link as-is in the default agenda message", async () => {
    mockUseShortLink.mockReturnValue({
      loading: false,
      load: vi.fn(),
      copy: vi.fn(),
      resetCaches: vi.fn(),
      hasActive: true,
      record: {
        key: "EYTETmaR",
        eventId: "event-1",
        slug: "webinar",
        url: "https://at-cloud-sign-up-system.onrender.com/s/EYTETmaR",
      },
      status: {
        state: "active",
        slug: "webinar",
        eventId: "event-1",
      },
    });

    renderModal();

    const editor = screen.getByRole("textbox", { name: /message editor/i });
    await waitFor(() => {
      expect(editor.innerHTML).toContain(
        'href="https://at-cloud-sign-up-system.onrender.com/s/EYTETmaR"',
      );
    });
    expect(editor.innerHTML).not.toContain(
      `${window.location.origin}https://at-cloud-sign-up-system.onrender.com`,
    );
  });

  it("expands a relative short link against the current origin", async () => {
    mockUseShortLink.mockReturnValue({
      loading: false,
      load: vi.fn(),
      copy: vi.fn(),
      resetCaches: vi.fn(),
      hasActive: true,
      record: {
        key: "abc123",
        eventId: "event-1",
        slug: "webinar",
        url: "/s/abc123",
      },
      status: {
        state: "active",
        slug: "webinar",
        eventId: "event-1",
      },
    });

    renderModal();

    const expectedUrl = `${window.location.origin}/s/abc123`;
    const editor = screen.getByRole("textbox", { name: /message editor/i });
    await waitFor(() => {
      expect(editor.innerHTML).toContain(`href="${expectedUrl}"`);
    });
  });
});

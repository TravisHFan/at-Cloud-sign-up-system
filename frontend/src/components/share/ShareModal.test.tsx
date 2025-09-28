import {
  describe,
  it,
  expect,
  vi,
  afterEach,
  beforeAll,
  beforeEach,
} from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShareModal from "./ShareModal";
import { clearShortLinkCaches } from "../../services/shortLinks";

// Robust clipboard mock (navigator.clipboard is often a read-only getter)
beforeAll(() => {
  if (!("clipboard" in navigator)) {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  } else {
    // Redefine if already present but not writable
    try {
      (navigator as any).clipboard.writeText = vi
        .fn()
        .mockResolvedValue(undefined);
    } catch {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
      });
    }
  }
});

// Simple fetch mock helper
function mockFetchSequence(responses: Array<{ status: number; body: any }>) {
  let i = 0;
  (globalThis as any).fetch = vi.fn().mockImplementation(() => {
    if (i >= responses.length) throw new Error("No more mock fetch responses");
    const { status, body } = responses[i++];
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    }) as any;
  });
}

describe("ShareModal", () => {
  beforeEach(() => {
    clearShortLinkCaches();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading then short link and status active", async () => {
    mockFetchSequence([
      // create
      {
        status: 201,
        body: {
          success: true,
          created: true,
          data: {
            key: "abc123",
            eventId: "evt1",
            slug: "my-event",
            expiresAt: "2025-12-01T00:00:00.000Z",
            url: "/s/abc123",
          },
        },
      },
      // status
      {
        status: 200,
        body: {
          success: true,
          data: { status: "active", slug: "my-event", eventId: "evt1" },
        },
      },
    ]);

    render(
      <ShareModal
        eventId="evt1"
        publicSlug="my-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/Generating/i)).toBeInTheDocument();

    await screen.findByDisplayValue("/s/abc123");
    expect(screen.getByText(/Status:/)).toHaveTextContent("active");
  });

  it("handles expired status display", async () => {
    mockFetchSequence([
      // create
      {
        status: 201,
        body: {
          success: true,
          created: true,
          data: {
            key: "zzz999",
            eventId: "evt1",
            slug: "my-event",
            expiresAt: "2025-12-01T00:00:00.000Z",
            url: "/s/zzz999",
          },
        },
      },
      // status expired
      {
        status: 410,
        body: {
          success: false,
          status: "expired",
          message: "Short link expired",
        },
      },
    ]);

    render(
      <ShareModal
        eventId="evt1"
        publicSlug="my-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await screen.findByDisplayValue("/s/zzz999");
    // There are two 'expired' texts (status line + alert). Assert status line specifically.
    const statusLine = screen.getByText(/Status:/);
    expect(statusLine).toHaveTextContent(/expired/i);
    expect(screen.getByText(/has expired/i)).toBeInTheDocument();
  });

  it("copies short link to clipboard", async () => {
    mockFetchSequence([
      // create
      {
        status: 201,
        body: {
          success: true,
          created: true,
          data: {
            key: "copy1",
            eventId: "evt1",
            slug: "my-event",
            expiresAt: "2025-12-01T00:00:00.000Z",
            url: "/s/copy1",
          },
        },
      },
      // status
      {
        status: 200,
        body: {
          success: true,
          data: { status: "active", slug: "my-event", eventId: "evt1" },
        },
      },
    ]);

    render(
      <ShareModal
        eventId="evt1"
        publicSlug="my-event"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await screen.findByDisplayValue("/s/copy1");
    const btn = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(btn).toHaveTextContent(/copied/i);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("/s/copy1");
  });

  it("shows error on creation failure", async () => {
    mockFetchSequence([
      { status: 400, body: { success: false, message: "Invalid eventId" } },
    ]);
    render(
      <ShareModal
        eventId="bad"
        publicSlug="bad"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/400/i);
    });
  });
});

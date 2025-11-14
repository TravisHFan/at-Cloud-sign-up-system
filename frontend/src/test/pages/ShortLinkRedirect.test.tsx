import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ShortLinkRedirect from "../../pages/ShortLinkRedirect";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe("ShortLinkRedirect page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <MemoryRouter initialEntries={["/s/test123"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/resolving link/i)).toBeInTheDocument();
    expect(screen.getByText(/key:/i)).toBeInTheDocument();
    expect(screen.getByText("test123")).toBeInTheDocument();
  });

  it("redirects to public event page when link is active", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          status: "active",
          slug: "event-slug-123",
          eventId: "evt-123",
        },
      }),
    } as Response);

    render(
      <MemoryRouter initialEntries={["/s/abc123"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/p/event-slug-123", {
        replace: true,
      });
    });
  });

  it("shows expired state for HTTP 410 response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({
        success: false,
        status: "expired",
        message: "Link has expired",
      }),
    } as Response);

    render(
      <MemoryRouter initialEntries={["/s/expired123"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/link expired/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/the short link you used has expired/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/please request a new share link/i)
    ).toBeInTheDocument();
  });

  it("shows expired state when response status is 'expired'", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 200,
      json: async () => ({
        success: false,
        status: "expired",
      }),
    } as Response);

    render(
      <MemoryRouter initialEntries={["/s/exp456"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/link expired/i)).toBeInTheDocument();
    });
  });

  it("shows not found state for HTTP 404 response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        status: "not_found",
        message: "Short link not found",
      }),
    } as Response);

    render(
      <MemoryRouter initialEntries={["/s/notfound"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/link not found/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/we couldn't find a published event/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/double-check the url or request a fresh share link/i)
    ).toBeInTheDocument();
  });

  it("shows not found state when response status is 'not_found'", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 200,
      json: async () => ({
        success: false,
        status: "not_found",
      }),
    } as Response);

    render(
      <MemoryRouter initialEntries={["/s/missing"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/link not found/i)).toBeInTheDocument();
    });
  });

  it("shows error state for network failures", async () => {
    mockFetch.mockRejectedValue(new Error("Network connection failed"));

    render(
      <MemoryRouter initialEntries={["/s/error123"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/resolution error/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/network error resolving short link/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/network connection failed/i)).toBeInTheDocument();
  });

  it("shows error state with custom message from server", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        message: "Database connection timeout",
      }),
    } as Response);

    render(
      <MemoryRouter initialEntries={["/s/err500"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/resolution error/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/database connection timeout/i)
    ).toBeInTheDocument();
  });

  it("shows error state when key is missing", async () => {
    render(
      <MemoryRouter initialEntries={["/s/"]}>
        <Routes>
          <Route path="/s/:key?" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/resolution error/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/missing short link key/i)).toBeInTheDocument();
  });

  it("shows retry button when error occurs", async () => {
    mockFetch.mockRejectedValue(new Error("First attempt failed"));

    render(
      <MemoryRouter initialEntries={["/s/retry123"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial error
    await waitFor(() => {
      expect(screen.getByText(/resolution error/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    expect(retryButton).not.toBeDisabled();
  });

  it("shows fallback message when JSON parsing fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    } as unknown as Response);

    render(
      <MemoryRouter initialEntries={["/s/badjson"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/resolution error/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/unexpected response \(status 500\)/i)
    ).toBeInTheDocument();
  });

  it("displays client fallback helper text", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/s/test"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/short link client fallback/i)).toBeInTheDocument();
  });

  it("cleans up fetch on unmount", async () => {
    const abortSpy = vi.fn();
    const originalAbortController = globalThis.AbortController;

    globalThis.AbortController = class MockAbortController {
      signal = {} as AbortSignal;
      abort = abortSpy;
    } as unknown as typeof AbortController;

    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { unmount } = render(
      <MemoryRouter initialEntries={["/s/cleanup"]}>
        <Routes>
          <Route path="/s/:key" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    unmount();

    expect(abortSpy).toHaveBeenCalled();

    globalThis.AbortController = originalAbortController;
  });
});

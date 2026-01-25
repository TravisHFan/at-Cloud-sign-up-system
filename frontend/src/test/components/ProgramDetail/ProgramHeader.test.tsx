import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProgramHeader from "../../../components/ProgramDetail/ProgramHeader";

describe("ProgramHeader - Share Button", () => {
  const mockWriteText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard API using defineProperty
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });
    // Mock window.location.origin
    Object.defineProperty(window, "location", {
      value: {
        origin: "https://example.com",
        pathname: "/dashboard/programs/123",
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const defaultProps = {
    programId: "507f1f77bcf86cd799439011",
    title: "Test Program",
    programType: "EMBA Mentor Circles" as const,
    canEdit: false,
    canDelete: false,
    canCreateEvent: false,
    canEmail: false,
    onDelete: vi.fn(),
  };

  it("renders Share button", () => {
    render(
      <MemoryRouter>
        <ProgramHeader {...defaultProps} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Share")).toBeInTheDocument();
  });

  it("copies public URL to clipboard when Share is clicked", async () => {
    mockWriteText.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ProgramHeader {...defaultProps} />
      </MemoryRouter>,
    );

    const shareButton = screen.getByText("Share");
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(
        "https://example.com/pr/507f1f77bcf86cd799439011",
      );
    });
  });

  it("shows 'Copied!' feedback after successful copy", async () => {
    mockWriteText.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ProgramHeader {...defaultProps} />
      </MemoryRouter>,
    );

    const shareButton = screen.getByText("Share");
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });

  it("shows 'Copy failed' if clipboard API fails", async () => {
    mockWriteText.mockRejectedValue(new Error("Clipboard not available"));

    render(
      <MemoryRouter>
        <ProgramHeader {...defaultProps} />
      </MemoryRouter>,
    );

    const shareButton = screen.getByText("Share");
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(screen.getByText("Copy failed")).toBeInTheDocument();
    });
  });

  it("Share button is always visible regardless of permissions", () => {
    // Even when user has no edit/delete/create permissions, Share should be visible
    render(
      <MemoryRouter>
        <ProgramHeader
          {...defaultProps}
          canEdit={false}
          canDelete={false}
          canCreateEvent={false}
          canEmail={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Share")).toBeInTheDocument();
  });

  it("Share button appears alongside other action buttons", () => {
    render(
      <MemoryRouter>
        <ProgramHeader
          {...defaultProps}
          canEdit={true}
          canDelete={true}
          canCreateEvent={true}
        />
      </MemoryRouter>,
    );

    // All buttons should be present
    expect(screen.getByText("Share")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete Program")).toBeInTheDocument();
    expect(screen.getByText("Create New Event")).toBeInTheDocument();
  });
});

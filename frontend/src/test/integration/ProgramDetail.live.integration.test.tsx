import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationContext";
import { NotificationProvider as NotificationModalProvider } from "../../contexts/NotificationModalContext";

// We set env BEFORE importing modules that read import.meta.env
const LIVE_API = "http://localhost:5001/api";

async function backendHealthy(): Promise<boolean> {
  try {
    const res = await fetch(LIVE_API.replace(/\/api$/, "/health"));
    return res.ok;
  } catch {
    return false;
  }
}

// NOTE: This integration test is designed to be SKIPPED in most cases.
// It only runs when the backend server is running at localhost:5001.
// This is intentional - it's an optional live integration test.
describe("ProgramDetail live backend integration (optional)", () => {
  let healthy = false;

  beforeAll(async () => {
    healthy = await backendHealthy();
    if (!healthy) {
      console.log(
        "ℹ️  Skipping live integration test - backend not available at",
        LIVE_API
      );
      return;
    }
    console.log("✅ Backend healthy - running live integration test");
  });

  it("renders with server pagination hitting live endpoint (empty program)", async () => {
    if (!healthy) {
      console.log("⏭️  Skipping test - backend not healthy");
      return;
    }

    const { programService } = await import("../../services/api");
    const ProgramDetail = (await import("../../pages/ProgramDetail")).default;

    // Stub getById to return a fake program while listEventsPaged goes live
    const fakeProgram = {
      id: "ffffffffffffffffffffffff", // random 24-char hex
      title: "Live Test Program",
      programType: "Effective Communication Workshops" as const,
      introduction: "Temporary program for live integration test.",
      pricing: {
        fullPriceTicket: 0,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
      },
    };
    const spy = vi
      .spyOn(programService as any, "getById")
      .mockResolvedValue(fakeProgram as any);

    render(
      <AuthProvider>
        <NotificationModalProvider>
          <NotificationProvider>
            <MemoryRouter
              initialEntries={[`/dashboard/programs/${fakeProgram.id}`]}
            >
              <Routes>
                <Route
                  path="/dashboard/programs/:id"
                  element={<ProgramDetail forceServerPagination />}
                />
              </Routes>
            </MemoryRouter>
          </NotificationProvider>
        </NotificationModalProvider>
      </AuthProvider>
    );

    // Header renders from stubbed program
    await waitFor(() =>
      expect(screen.getByText(/Live Test Program/i)).toBeInTheDocument()
    );

    // Should settle to empty state (no events) from live backend
    // (Loading may be too fast to catch spinner, which is fine - means backend is responsive)
    await waitFor(
      () =>
        expect(
          screen.getByText(/No events linked to this program yet\./i)
        ).toBeInTheDocument(),
      { timeout: 5000 } // Give backend time to respond
    );

    // Verify pagination controls are present (shows the component fully loaded)
    expect(screen.getByText(/Page 1 of 1/i)).toBeInTheDocument();

    spy.mockRestore();
  });
});

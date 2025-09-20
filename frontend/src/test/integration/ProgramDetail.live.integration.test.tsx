import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

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

describe("ProgramDetail live backend integration (optional)", () => {
  let healthy = false;

  beforeAll(async () => {
    healthy = await backendHealthy();
    if (!healthy) return;
  });

  it.runIf(healthy)(
    "renders with server pagination hitting live endpoint (empty program)",
    async () => {
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
      );

      // Header renders from stubbed program
      await waitFor(() =>
        expect(screen.getByText(/Live Test Program/i)).toBeInTheDocument()
      );

      // Spinner should appear while fetching page 1 from live backend
      const status = await screen.findByRole("status");
      expect(status).toBeInTheDocument();

      // Then it should settle to empty state (no events) from live backend
      await waitFor(() =>
        expect(
          screen.getByText(/No events linked to this program yet\./i)
        ).toBeInTheDocument()
      );

      spy.mockRestore();
    }
  );
});

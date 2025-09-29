import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GuestEventList from "../../components/guest/GuestEventList";

describe("GuestEventList - Guest My Events prompt (deprecated)", () => {
  const onSignUp = vi.fn();
  const onViewDetails = vi.fn();

  function renderAt(pathname: string) {
    return render(
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route
            path="*"
            element={
              <GuestEventList
                events={[]}
                type="upcoming"
                title="Upcoming Events"
                onSignUp={onSignUp}
                onViewDetails={onViewDetails}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );
  }

  it("renders normal list UI (guest dashboard deprecated)", () => {
    renderAt("/events");

    // Shows the provided page title
    expect(
      screen.getByRole("heading", { name: /Upcoming Events/i })
    ).toBeInTheDocument();

    // With no events provided, should show the default empty state for upcoming
    expect(screen.getByText(/No upcoming events found\./i)).toBeInTheDocument();

    // Prompt elements removed with deprecation
    expect(
      screen.queryByText(/Sign up to unlock My Events/i)
    ).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GuestEventList from "../../components/guest/GuestEventList";

describe("GuestEventList - Guest My Events prompt", () => {
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

  it("renders a sign-up prompt when on /guest-dashboard/my-events", () => {
    renderAt("/guest-dashboard/my-events");

    // Heading and guidance
    expect(
      screen.getByRole("heading", { name: /My Events for Guests/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We suggest guests sign up for a free account/i)
    ).toBeInTheDocument();

    // CTA link to signup
    const signupCta = screen.getByRole("link", {
      name: /Sign up to unlock My Events/i,
    });
    expect(signupCta).toBeInTheDocument();
    expect(signupCta).toHaveAttribute("href", "/signup");

    // Should not show the standard search bar in the prompt view
    expect(
      screen.queryByPlaceholderText(/Search events/i)
    ).not.toBeInTheDocument();
  });

  it("renders normal list UI when not on the guest my-events route", () => {
    renderAt("/guest-dashboard/upcoming");

    // Shows the provided page title
    expect(
      screen.getByRole("heading", { name: /Upcoming Events/i })
    ).toBeInTheDocument();

    // With no events provided, should show the default empty state for upcoming
    expect(screen.getByText(/No upcoming events found\./i)).toBeInTheDocument();

    // Should not show the guest prompt-specific CTA text here
    expect(
      screen.queryByText(/Sign up to unlock My Events/i)
    ).not.toBeInTheDocument();
  });
});

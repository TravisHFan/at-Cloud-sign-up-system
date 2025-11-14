import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import GuestLanding from "../../pages/GuestLanding";

describe("GuestLanding page", () => {
  it("renders the guest landing page with heading and links", () => {
    render(
      <BrowserRouter>
        <GuestLanding />
      </BrowserRouter>
    );

    expect(
      screen.getByRole("heading", { name: /join an event as a guest/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/no account needed/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /browse upcoming events/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to login/i })
    ).toBeInTheDocument();
  });
});

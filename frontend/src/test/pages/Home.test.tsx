import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "../../pages/Home";

describe("Home page", () => {
  const renderHome = () =>
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

  it("renders hero heading and subtitle", () => {
    renderHome();

    expect(screen.getByText(/Welcome to @Cloud/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Events Resource Planning System/i)
    ).toBeInTheDocument();
  });

  it("has navigation links to login and signup", () => {
    renderHome();

    const loginLink = screen.getByRole("link", { name: /Login/i });
    const signupLink = screen.getByRole("link", { name: /Sign Up/i });

    expect(loginLink).toHaveAttribute("href", "/login");
    expect(signupLink).toHaveAttribute("href", "/signup");
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import GetInvolved from "../../pages/GetInvolved";

// Mock Icon component
vi.mock("../../components/common", () => ({
  DashboardCard: ({
    title,
    icon,
    children,
  }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="dashboard-card">
      <h3>{title}</h3>
      {icon}
      {children}
    </div>
  ),
  Icon: ({ name }: { name: string }) => (
    <span data-testid={`icon-${name}`}>{name}</span>
  ),
}));

vi.mock("../../components/ui", () => ({
  Button: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <button className={className}>{children}</button>,
}));

describe("GetInvolved page", () => {
  it("renders hero header with main title", () => {
    render(
      <BrowserRouter>
        <GetInvolved />
      </BrowserRouter>
    );

    expect(screen.getByText(/get involved at @cloud/i)).toBeInTheDocument();
    expect(
      screen.getByText(/discover meaningful ways to engage/i)
    ).toBeInTheDocument();
  });

  it("displays Join @Cloud Events section", () => {
    render(
      <BrowserRouter>
        <GetInvolved />
      </BrowserRouter>
    );

    expect(screen.getByText(/join @cloud events/i)).toBeInTheDocument();
    expect(screen.getByText(/emba program/i)).toBeInTheDocument();
    expect(screen.getByText(/seminars & workshops/i)).toBeInTheDocument();
    expect(screen.getByText(/mentorship programs/i)).toBeInTheDocument();
  });

  it("displays More Ways to Contribute section", () => {
    render(
      <BrowserRouter>
        <GetInvolved />
      </BrowserRouter>
    );

    expect(screen.getByText(/more ways to contribute/i)).toBeInTheDocument();
    expect(
      screen.getByText(/marketplace ministry co-worker/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/event volunteer/i)).toBeInTheDocument();
    expect(screen.getByText(/tech team/i)).toBeInTheDocument();
  });

  it("shows external links to at-cloud.biz", () => {
    render(
      <BrowserRouter>
        <GetInvolved />
      </BrowserRouter>
    );

    const links = screen.getAllByRole("link", { name: /at-cloud\.biz/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "https://at-cloud.biz/");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("renders Start Your Journey action section", () => {
    render(
      <BrowserRouter>
        <GetInvolved />
      </BrowserRouter>
    );

    expect(screen.getByText(/start your journey/i)).toBeInTheDocument();
    expect(
      screen.getByText(/ready to take the next step/i)
    ).toBeInTheDocument();
  });

  it("displays Explore Events button linking to upcoming events", () => {
    render(
      <BrowserRouter>
        <GetInvolved />
      </BrowserRouter>
    );

    const exploreButton = screen.getByRole("link", { name: /explore events/i });
    expect(exploreButton).toBeInTheDocument();
    expect(exploreButton).toHaveAttribute("href", "/dashboard/upcoming");
  });

  it("displays Visit @Cloud Website button", () => {
    render(
      <BrowserRouter>
        <GetInvolved />
      </BrowserRouter>
    );

    const websiteButton = screen.getByRole("link", {
      name: /visit @cloud website/i,
    });
    expect(websiteButton).toBeInTheDocument();
    expect(websiteButton).toHaveAttribute("href", "https://at-cloud.biz/");
  });

  it("renders all dashboard cards with icons", () => {
    render(
      <BrowserRouter>
        <GetInvolved />
      </BrowserRouter>
    );

    const cards = screen.getAllByTestId("dashboard-card");
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });
});

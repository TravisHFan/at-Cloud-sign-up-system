import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardCard from "../../../components/common/DashboardCard";

describe("DashboardCard", () => {
  it("renders title", () => {
    render(
      <DashboardCard title="Test Card" icon={<span>📊</span>}>
        <div>Content</div>
      </DashboardCard>
    );
    expect(screen.getByText("Test Card")).toBeDefined();
  });

  it("renders icon", () => {
    render(
      <DashboardCard title="Test" icon={<span data-testid="icon">📊</span>}>
        <div>Content</div>
      </DashboardCard>
    );
    expect(screen.getByTestId("icon")).toBeDefined();
  });

  it("renders children content", () => {
    render(
      <DashboardCard title="Test" icon={<span>📊</span>}>
        <div>Test Content Here</div>
      </DashboardCard>
    );
    expect(screen.getByText("Test Content Here")).toBeDefined();
  });
});

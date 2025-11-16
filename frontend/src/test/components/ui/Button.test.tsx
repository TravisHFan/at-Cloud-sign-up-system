import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Button from "../../../components/ui/Button";

describe("Button", () => {
  describe("Basic Rendering", () => {
    it("renders with children text", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText("Click me")).toBeDefined();
    });

    it("renders with default primary variant", () => {
      const { container } = render(<Button>Test</Button>);
      const button = container.querySelector("button");
      expect(button).toBeDefined();
    });

    it("renders with secondary variant", () => {
      render(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByText("Secondary")).toBeDefined();
    });

    it("renders with success variant", () => {
      render(<Button variant="success">Success</Button>);
      expect(screen.getByText("Success")).toBeDefined();
    });

    it("renders with danger variant", () => {
      render(<Button variant="danger">Danger</Button>);
      expect(screen.getByText("Danger")).toBeDefined();
    });

    it("renders with warning variant", () => {
      render(<Button variant="warning">Warning</Button>);
      expect(screen.getByText("Warning")).toBeDefined();
    });

    it("renders with ghost variant", () => {
      render(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByText("Ghost")).toBeDefined();
    });

    it("renders with link variant", () => {
      render(<Button variant="link">Link</Button>);
      expect(screen.getByText("Link")).toBeDefined();
    });

    it("renders with outline variant", () => {
      render(<Button variant="outline">Outline</Button>);
      expect(screen.getByText("Outline")).toBeDefined();
    });
  });

  describe("Sizes", () => {
    it("renders with default medium size", () => {
      render(<Button>Medium</Button>);
      expect(screen.getByText("Medium")).toBeDefined();
    });

    it("renders with small size", () => {
      render(<Button size="small">Small</Button>);
      expect(screen.getByText("Small")).toBeDefined();
    });

    it("renders with large size", () => {
      render(<Button size="large">Large</Button>);
      expect(screen.getByText("Large")).toBeDefined();
    });
  });

  describe("Loading State", () => {
    it("shows loading spinner when loading is true", () => {
      const { container } = render(<Button loading>Submit</Button>);
      const svg = container.querySelector("svg");
      expect(svg).toBeDefined();
      expect(svg?.classList.contains("animate-spin")).toBe(true);
    });

    it("shows 'Loading...' text when loading", () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByText("Loading...")).toBeDefined();
    });

    it("does not show children when loading", () => {
      render(<Button loading>Submit</Button>);
      expect(screen.queryByText("Submit")).toBeNull();
    });

    it("disables button when loading", () => {
      const { container } = render(<Button loading>Submit</Button>);
      const button = container.querySelector("button");
      expect(button?.disabled).toBe(true);
    });

    it("applies opacity and cursor styles when loading", () => {
      const { container } = render(<Button loading>Submit</Button>);
      const button = container.querySelector("button");
      expect(button?.classList.contains("opacity-50")).toBe(true);
      expect(button?.classList.contains("cursor-not-allowed")).toBe(true);
    });
  });

  describe("Disabled State", () => {
    it("disables button when disabled prop is true", () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      const button = container.querySelector("button");
      expect(button?.disabled).toBe(true);
    });

    it("applies disabled styling", () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      const button = container.querySelector("button");
      expect(button?.classList.contains("opacity-50")).toBe(true);
    });
  });

  describe("Icons", () => {
    it("renders with left icon", () => {
      const leftIcon = <span data-testid="left-icon">←</span>;
      render(<Button leftIcon={leftIcon}>With Left Icon</Button>);
      expect(screen.getByTestId("left-icon")).toBeDefined();
      expect(screen.getByText("With Left Icon")).toBeDefined();
    });

    it("renders with right icon", () => {
      const rightIcon = <span data-testid="right-icon">→</span>;
      render(<Button rightIcon={rightIcon}>With Right Icon</Button>);
      expect(screen.getByTestId("right-icon")).toBeDefined();
      expect(screen.getByText("With Right Icon")).toBeDefined();
    });

    it("renders with both left and right icons", () => {
      const leftIcon = <span data-testid="left-icon">←</span>;
      const rightIcon = <span data-testid="right-icon">→</span>;
      render(
        <Button leftIcon={leftIcon} rightIcon={rightIcon}>
          Both Icons
        </Button>
      );
      expect(screen.getByTestId("left-icon")).toBeDefined();
      expect(screen.getByTestId("right-icon")).toBeDefined();
      expect(screen.getByText("Both Icons")).toBeDefined();
    });

    it("renders without children but with icons", () => {
      const leftIcon = <span data-testid="icon-only">⚡</span>;
      render(<Button leftIcon={leftIcon} />);
      expect(screen.getByTestId("icon-only")).toBeDefined();
    });
  });

  describe("Custom Props", () => {
    it("applies custom className", () => {
      const { container } = render(
        <Button className="custom-class">Test</Button>
      );
      const button = container.querySelector("button");
      expect(button?.classList.contains("custom-class")).toBe(true);
    });

    it("forwards additional button props", () => {
      const { container } = render(
        <Button type="submit" data-testid="submit-btn">
          Submit
        </Button>
      );
      const button = container.querySelector("button");
      expect(button?.type).toBe("submit");
      expect(button?.getAttribute("data-testid")).toBe("submit-btn");
    });
  });
});

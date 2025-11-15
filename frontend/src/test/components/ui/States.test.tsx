import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  LoadingSpinner,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../../components/ui/States";

describe("States Components", () => {
  describe("LoadingSpinner", () => {
    it("renders with default medium size", () => {
      const { container } = render(<LoadingSpinner />);
      const svg = container.querySelector("svg");
      expect(svg).toBeDefined();
      expect(svg?.classList.contains("h-6")).toBe(true);
      expect(svg?.classList.contains("w-6")).toBe(true);
      expect(svg?.classList.contains("animate-spin")).toBe(true);
    });

    it("renders with small size", () => {
      const { container } = render(<LoadingSpinner size="sm" />);
      const svg = container.querySelector("svg");
      expect(svg?.classList.contains("h-4")).toBe(true);
      expect(svg?.classList.contains("w-4")).toBe(true);
    });

    it("renders with large size", () => {
      const { container } = render(<LoadingSpinner size="lg" />);
      const svg = container.querySelector("svg");
      expect(svg?.classList.contains("h-8")).toBe(true);
      expect(svg?.classList.contains("w-8")).toBe(true);
    });

    it("applies custom className", () => {
      const { container } = render(<LoadingSpinner className="text-red-500" />);
      const svg = container.querySelector("svg");
      expect(svg?.classList.contains("text-red-500")).toBe(true);
    });

    it("renders SVG with correct structure", () => {
      const { container } = render(<LoadingSpinner />);
      const svg = container.querySelector("svg");
      const circle = container.querySelector("circle");
      const path = container.querySelector("path");

      expect(svg).toBeDefined();
      expect(circle).toBeDefined();
      expect(path).toBeDefined();
    });

    it("renders SVG with correct viewBox", () => {
      const { container } = render(<LoadingSpinner />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    });
  });

  describe("LoadingState", () => {
    it("renders with default loading message", () => {
      render(<LoadingState />);
      expect(screen.getByText("Loading...")).toBeDefined();
    });

    it("renders with custom message", () => {
      render(<LoadingState message="Please wait..." />);
      expect(screen.getByText("Please wait...")).toBeDefined();
    });

    it("renders loading spinner", () => {
      const { container } = render(<LoadingState />);
      const svg = container.querySelector("svg");
      expect(svg).toBeDefined();
      expect(svg?.classList.contains("animate-spin")).toBe(true);
    });

    it("renders large spinner", () => {
      const { container } = render(<LoadingState />);
      const svg = container.querySelector("svg");
      expect(svg?.classList.contains("h-8")).toBe(true);
      expect(svg?.classList.contains("w-8")).toBe(true);
    });

    it("applies custom className", () => {
      const { container } = render(
        <LoadingState className="my-custom-class" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("my-custom-class")).toBe(true);
    });

    it("centers content", () => {
      const { container } = render(<LoadingState />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("flex")).toBe(true);
      expect(wrapper.classList.contains("items-center")).toBe(true);
      expect(wrapper.classList.contains("justify-center")).toBe(true);
    });
  });

  describe("ErrorState", () => {
    it("renders with default title and custom message", () => {
      render(<ErrorState message="Something went wrong" />);
      expect(screen.getByText("Error")).toBeDefined();
      expect(screen.getByText("Something went wrong")).toBeDefined();
    });

    it("renders with custom title", () => {
      render(<ErrorState title="Network Error" message="Connection failed" />);
      expect(screen.getByText("Network Error")).toBeDefined();
      expect(screen.getByText("Connection failed")).toBeDefined();
    });

    it("renders error icon", () => {
      const { container } = render(<ErrorState message="Test error" />);
      const iconWrapper = container.querySelector(".bg-red-100");
      expect(iconWrapper).toBeDefined();
      const svg = iconWrapper?.querySelector("svg");
      expect(svg?.classList.contains("text-red-600")).toBe(true);
    });

    it("renders action button when provided", () => {
      const action = <button>Retry</button>;
      render(<ErrorState message="Test error" action={action} />);
      expect(screen.getByText("Retry")).toBeDefined();
    });

    it("does not render action when not provided", () => {
      const { container } = render(<ErrorState message="Test error" />);
      const button = container.querySelector("button");
      expect(button).toBeNull();
    });

    it("applies custom className", () => {
      const { container } = render(
        <ErrorState message="Test" className="error-custom" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("error-custom")).toBe(true);
    });

    it("centers content", () => {
      const { container } = render(<ErrorState message="Test" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("flex")).toBe(true);
      expect(wrapper.classList.contains("items-center")).toBe(true);
      expect(wrapper.classList.contains("justify-center")).toBe(true);
    });
  });

  describe("EmptyState", () => {
    it("renders with title and message", () => {
      render(<EmptyState title="No Data" message="No items to display" />);
      expect(screen.getByText("No Data")).toBeDefined();
      expect(screen.getByText("No items to display")).toBeDefined();
    });

    it("renders default icon when custom icon not provided", () => {
      const { container } = render(
        <EmptyState title="Empty" message="Nothing here" />
      );
      const iconWrapper = container.querySelector(".bg-gray-100");
      expect(iconWrapper).toBeDefined();
      const svg = iconWrapper?.querySelector("svg");
      expect(svg?.classList.contains("text-gray-400")).toBe(true);
    });

    it("renders custom icon when provided", () => {
      const customIcon = (
        <div className="custom-icon" data-testid="custom-icon">
          📦
        </div>
      );
      render(
        <EmptyState title="Empty" message="Nothing here" icon={customIcon} />
      );
      expect(screen.getByTestId("custom-icon")).toBeDefined();
    });

    it("does not render default icon when custom icon provided", () => {
      const customIcon = <div data-testid="custom-icon">📦</div>;
      const { container } = render(
        <EmptyState title="Empty" message="Nothing here" icon={customIcon} />
      );
      const defaultIconWrapper = container.querySelector(".bg-gray-100");
      expect(defaultIconWrapper).toBeNull();
    });

    it("renders action button when provided", () => {
      const action = <button>Create New</button>;
      render(
        <EmptyState title="Empty" message="Nothing here" action={action} />
      );
      expect(screen.getByText("Create New")).toBeDefined();
    });

    it("does not render action when not provided", () => {
      const { container } = render(
        <EmptyState title="Empty" message="Nothing here" />
      );
      const button = container.querySelector("button");
      expect(button).toBeNull();
    });

    it("applies custom className", () => {
      const { container } = render(
        <EmptyState title="Empty" message="Nothing" className="empty-custom" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("empty-custom")).toBe(true);
    });

    it("centers content", () => {
      const { container } = render(
        <EmptyState title="Empty" message="Nothing" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("flex")).toBe(true);
      expect(wrapper.classList.contains("items-center")).toBe(true);
      expect(wrapper.classList.contains("justify-center")).toBe(true);
    });

    it("renders both custom icon and action", () => {
      const customIcon = <div data-testid="custom-icon">📦</div>;
      const action = <button>Add Item</button>;
      render(
        <EmptyState
          title="Empty"
          message="Nothing here"
          icon={customIcon}
          action={action}
        />
      );
      expect(screen.getByTestId("custom-icon")).toBeDefined();
      expect(screen.getByText("Add Item")).toBeDefined();
    });
  });
});

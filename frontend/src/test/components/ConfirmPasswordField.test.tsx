import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, FormProvider } from "react-hook-form";
import ConfirmPasswordField from "../../components/forms/ConfirmPasswordField";

// Test wrapper to provide form context
function TestWrapper({ errors }: { errors?: Record<string, unknown> }) {
  const methods = useForm({
    defaultValues: {
      confirmPassword: "",
    },
    errors,
  });

  return (
    <FormProvider {...methods}>
      <ConfirmPasswordField
        register={methods.register}
        errors={errors || methods.formState.errors}
      />
    </FormProvider>
  );
}

describe("ConfirmPasswordField component", () => {
  it("renders label with required asterisk", () => {
    render(<TestWrapper />);

    const label = screen.getByText(/confirm password/i);
    expect(label).toBeInTheDocument();
    expect(label.parentElement?.textContent).toContain("*");
  });

  it("renders password input with placeholder", () => {
    render(<TestWrapper />);

    const input = screen.getByPlaceholderText(/confirm your password/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");
  });

  it("toggles password visibility when eye icon clicked", async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);

    const input = screen.getByPlaceholderText(/confirm your password/i);
    expect(input).toHaveAttribute("type", "password");

    // Find and click the toggle button
    const toggleButton = screen.getByRole("button");
    await user.click(toggleButton);

    expect(input).toHaveAttribute("type", "text");

    // Click again to hide
    await user.click(toggleButton);
    expect(input).toHaveAttribute("type", "password");
  });

  it("displays error message when validation fails", () => {
    const errorMessage = "Passwords do not match";
    const errors = {
      confirmPassword: { message: errorMessage },
    };
    render(<TestWrapper errors={errors} />);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("shows eye icon initially", () => {
    render(<TestWrapper />);

    const toggleButton = screen.getByRole("button");
    expect(toggleButton).toBeInTheDocument();
    // Initially shows EyeIcon (password is hidden)
    const svg = toggleButton.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies error styling when there is an error", () => {
    const errors = {
      confirmPassword: { message: "Error" },
    };
    render(<TestWrapper errors={errors} />);

    const input = screen.getByPlaceholderText(/confirm your password/i);
    expect(input).toHaveClass("border-red-500");
  });

  it("applies normal styling when there is no error", () => {
    render(<TestWrapper />);

    const input = screen.getByPlaceholderText(/confirm your password/i);
    expect(input).toHaveClass("border-gray-300");
    expect(input).not.toHaveClass("border-red-500");
  });
});

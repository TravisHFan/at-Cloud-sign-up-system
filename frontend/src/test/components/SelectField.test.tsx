import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import SelectField from "../../components/forms/SelectField";

// Test wrapper component to provide form context
function TestWrapper({
  options,
  required = false,
  defaultValue = "",
}: {
  options: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
}) {
  const {
    register,
    formState: { errors },
  } = useForm({
    defaultValues: {
      testField: defaultValue,
    },
  });

  return (
    <SelectField
      label="Test Field"
      name="testField"
      register={register}
      errors={errors}
      options={options}
      required={required}
    />
  );
}

describe("SelectField component", () => {
  const mockOptions = [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3" },
  ];

  it("renders label with field name", () => {
    render(<TestWrapper options={mockOptions} />);

    expect(screen.getByText("Test Field")).toBeInTheDocument();
  });

  it("shows required asterisk when required prop is true", () => {
    render(<TestWrapper options={mockOptions} required={true} />);

    const label = screen.getByText("Test Field").parentElement;
    expect(label?.textContent).toContain("*");
  });

  it("renders all provided options", () => {
    render(<TestWrapper options={mockOptions} />);

    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 3")).toBeInTheDocument();
  });

  it("shows placeholder when no option has empty value", () => {
    render(<TestWrapper options={mockOptions} />);

    expect(screen.getByText("Select an option")).toBeInTheDocument();
  });

  it("does not show placeholder when options include empty value", () => {
    const optionsWithEmpty = [
      { value: "", label: "Choose one" },
      ...mockOptions,
    ];

    render(<TestWrapper options={optionsWithEmpty} />);

    // Placeholder should not be rendered
    expect(screen.queryByText("Select an option")).not.toBeInTheDocument();
    // But the empty option should be there
    expect(screen.getByText("Choose one")).toBeInTheDocument();
  });

  it("renders select element with proper attributes", () => {
    render(<TestWrapper options={mockOptions} required={true} />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(select).toHaveAttribute("required");
  });
});

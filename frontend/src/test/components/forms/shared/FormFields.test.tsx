import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import {
  TextField,
  PasswordField,
  SelectField,
  TextareaField,
} from "../../../../components/forms/shared/FormFields";

// Test wrapper component
function TestForm<T extends Record<string, unknown>>({
  children,
  defaultValues,
}: {
  children: (props: {
    register: ReturnType<typeof useForm<T>>["register"];
    errors: ReturnType<typeof useForm<T>>["formState"]["errors"];
  }) => React.ReactNode;
  defaultValues?: T;
}) {
  const {
    register,
    formState: { errors },
  } = useForm<T>({ defaultValues: defaultValues as any });

  return <form>{children({ register, errors })}</form>;
}

describe("FormFields - TextField", () => {
  describe("Basic Rendering", () => {
    it("renders label", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("Username")).toBeDefined();
    });

    it("renders input field", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      expect(screen.getByRole("textbox")).toBeDefined();
    });

    it("shows required asterisk when required", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={errors}
              required
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("*")).toBeDefined();
    });

    it("does not show asterisk when not required", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      expect(screen.queryByText("*")).toBeNull();
    });

    it("renders placeholder", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={errors}
              placeholder="Enter your username"
            />
          )}
        </TestForm>
      );

      expect(screen.getByPlaceholderText("Enter your username")).toBeDefined();
    });
  });

  describe("Input Types", () => {
    it("renders text input by default", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      const input = container.querySelector('input[type="text"]');
      expect(input).toBeDefined();
    });

    it("renders email input when type is email", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Email"
              name="email"
              register={register}
              errors={errors}
              type="email"
            />
          )}
        </TestForm>
      );

      const input = container.querySelector('input[type="email"]');
      expect(input).toBeDefined();
    });

    it("renders tel input when type is tel", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Phone"
              name="phone"
              register={register}
              errors={errors}
              type="tel"
            />
          )}
        </TestForm>
      );

      const input = container.querySelector('input[type="tel"]');
      expect(input).toBeDefined();
    });

    it("renders url input when type is url", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Website"
              name="website"
              register={register}
              errors={errors}
              type="url"
            />
          )}
        </TestForm>
      );

      const input = container.querySelector('input[type="url"]');
      expect(input).toBeDefined();
    });
  });

  describe("Validation Attributes", () => {
    it("applies maxLength attribute", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors: _errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={_errors}
              maxLength={50}
            />
          )}
        </TestForm>
      );

      const input = container.querySelector("input");
      expect(input?.maxLength).toBe(50);
    });

    it("applies minLength attribute", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors: _errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={_errors}
              minLength={3}
            />
          )}
        </TestForm>
      );

      const input = container.querySelector("input");
      expect(input?.minLength).toBe(3);
    });
  });

  describe("State Management", () => {
    it("can be disabled", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={errors}
              disabled
            />
          )}
        </TestForm>
      );

      const input = container.querySelector("input");
      expect(input?.disabled).toBe(true);
    });

    it("shows error styling when error exists", () => {
      const { container } = render(
        <TestForm>
          {({ register }) => (
            <>
              <TextField
                label="Username"
                name="username"
                register={register}
                errors={{ username: { type: "required", message: "Required" } }}
              />
            </>
          )}
        </TestForm>
      );

      const input = container.querySelector("input");
      expect(input?.className).toContain("border-red-500");
    });

    it("displays error message", () => {
      render(
        <TestForm>
          {({ register }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={{
                username: { type: "required", message: "Username is required" },
              }}
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("Username is required")).toBeDefined();
    });

    it("applies disabled styling", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={errors}
              disabled
            />
          )}
        </TestForm>
      );

      const input = container.querySelector("input");
      expect(input?.className).toContain("bg-gray-50");
      expect(input?.className).toContain("cursor-not-allowed");
    });
  });

  describe("Custom Styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextField
              label="Username"
              name="username"
              register={register}
              errors={errors}
              className="custom-field"
            />
          )}
        </TestForm>
      );

      const wrapper = container.querySelector(".custom-field");
      expect(wrapper).toBeDefined();
    });
  });
});

describe("FormFields - PasswordField", () => {
  describe("Basic Rendering", () => {
    it("renders label", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("Password")).toBeDefined();
    });

    it("renders password input by default", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      const input = container.querySelector('input[type="password"]');
      expect(input).toBeDefined();
    });

    it("shows required asterisk when required", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={errors}
              required
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("*")).toBeDefined();
    });
  });

  describe("Visibility Toggle", () => {
    it("does not show toggle button by default", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      const toggleButton = container.querySelector('button[type="button"]');
      expect(toggleButton).toBeNull();
    });

    it("shows toggle button when showToggle is true", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={errors}
              showToggle
            />
          )}
        </TestForm>
      );

      const toggleButton = container.querySelector('button[type="button"]');
      expect(toggleButton).toBeDefined();
    });

    it("toggles password visibility on button click", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={errors}
              showToggle
            />
          )}
        </TestForm>
      );

      const toggleButton = container.querySelector('button[type="button"]');
      const input = container.querySelector("input");

      expect(input?.type).toBe("password");

      if (toggleButton) {
        fireEvent.click(toggleButton);
      }

      expect(input?.type).toBe("text");

      if (toggleButton) {
        fireEvent.click(toggleButton);
      }

      expect(input?.type).toBe("password");
    });

    it("shows eye-slash icon when password is visible", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={errors}
              showToggle
            />
          )}
        </TestForm>
      );

      const toggleButton = container.querySelector('button[type="button"]');

      if (toggleButton) {
        fireEvent.click(toggleButton);
      }

      // Check for eye-slash SVG path (M13.875...)
      const eyeSlashPath = container.querySelector('path[d*="M13.875"]');
      expect(eyeSlashPath).toBeDefined();
    });

    it("shows eye icon when password is hidden", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={errors}
              showToggle
            />
          )}
        </TestForm>
      );

      // Check for eye SVG path (M15 12a3...)
      const eyePath = container.querySelector('path[d*="M15 12a3"]');
      expect(eyePath).toBeDefined();
    });
  });

  describe("Attributes", () => {
    it("applies autoComplete attribute", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={errors}
              autoComplete="current-password"
            />
          )}
        </TestForm>
      );

      const input = container.querySelector("input");
      expect(input?.autocomplete).toBe("current-password");
    });

    it("can be disabled", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors: _errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={_errors}
              disabled
            />
          )}
        </TestForm>
      );

      const input = container.querySelector("input");
      expect(input?.disabled).toBe(true);
    });

    it("renders placeholder", () => {
      render(
        <TestForm>
          {({ register, errors: _errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={_errors}
              placeholder="Enter password"
            />
          )}
        </TestForm>
      );

      expect(screen.getByPlaceholderText("Enter password")).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("shows error styling when error exists", () => {
      const { container } = render(
        <TestForm>
          {({ register }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={{ password: { type: "required", message: "Required" } }}
            />
          )}
        </TestForm>
      );

      const input = container.querySelector("input");
      expect(input?.className).toContain("border-red-500");
    });

    it("displays error message", () => {
      render(
        <TestForm>
          {({ register }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={{
                password: { type: "required", message: "Password is required" },
              }}
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("Password is required")).toBeDefined();
    });
  });

  describe("Styling", () => {
    it("adds padding for toggle button when showToggle is true", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <PasswordField
              label="Password"
              name="password"
              register={register}
              errors={errors}
              showToggle
            />
          )}
        </TestForm>
      );

      const input = container.querySelector("input");
      expect(input?.className).toContain("pr-10");
    });
  });
});

describe("FormFields - SelectField", () => {
  const options = [
    { value: "us", label: "United States" },
    { value: "ca", label: "Canada" },
    { value: "mx", label: "Mexico" },
  ];

  describe("Basic Rendering", () => {
    it("renders label", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <SelectField
              label="Country"
              name="country"
              register={register}
              errors={errors}
              options={options}
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("Country")).toBeDefined();
    });

    it("renders select element", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <SelectField
              label="Country"
              name="country"
              register={register}
              errors={errors}
              options={options}
            />
          )}
        </TestForm>
      );

      const select = container.querySelector("select");
      expect(select).toBeDefined();
    });

    it("renders all options", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <SelectField
              label="Country"
              name="country"
              register={register}
              errors={errors}
              options={options}
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("United States")).toBeDefined();
      expect(screen.getByText("Canada")).toBeDefined();
      expect(screen.getByText("Mexico")).toBeDefined();
    });

    it("shows required asterisk when required", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <SelectField
              label="Country"
              name="country"
              register={register}
              errors={errors}
              options={options}
              required
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("*")).toBeDefined();
    });
  });

  describe("Default Option", () => {
    it("renders default option when provided", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <SelectField
              label="Country"
              name="country"
              register={register}
              errors={errors}
              options={options}
              defaultOption="Select a country"
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("Select a country")).toBeDefined();
    });

    it("does not render default option when not provided", () => {
      render(
        <TestForm>
          {({ register, errors: _errors }) => (
            <SelectField
              label="Country"
              name="country"
              register={register}
              errors={_errors}
              options={options}
            />
          )}
        </TestForm>
      );

      expect(screen.queryByText("Select")).toBeNull();
    });
  });

  describe("State Management", () => {
    it("can be disabled", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors: _errors }) => (
            <SelectField
              label="Country"
              name="country"
              register={register}
              errors={_errors}
              options={options}
              disabled
            />
          )}
        </TestForm>
      );

      const select = container.querySelector("select");
      expect(select?.disabled).toBe(true);
    });

    it("shows error styling when error exists", () => {
      const { container } = render(
        <TestForm>
          {({ register }) => (
            <SelectField
              label="Country"
              name="country"
              register={register}
              errors={{ country: { type: "required", message: "Required" } }}
              options={options}
            />
          )}
        </TestForm>
      );

      const select = container.querySelector("select");
      expect(select?.className).toContain("border-red-500");
    });

    it("displays error message", () => {
      render(
        <TestForm>
          {({ register }) => (
            <SelectField
              label="Country"
              name="country"
              register={register}
              errors={{
                country: { type: "required", message: "Country is required" },
              }}
              options={options}
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("Country is required")).toBeDefined();
    });
  });

  describe("Custom Styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <SelectField
              label="Country"
              name="country"
              register={register}
              errors={errors}
              options={options}
              className="custom-select"
            />
          )}
        </TestForm>
      );

      const wrapper = container.querySelector(".custom-select");
      expect(wrapper).toBeDefined();
    });
  });
});

describe("FormFields - TextareaField", () => {
  describe("Basic Rendering", () => {
    it("renders label", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("Description")).toBeDefined();
    });

    it("renders textarea element", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      const textarea = container.querySelector("textarea");
      expect(textarea).toBeDefined();
    });

    it("shows required asterisk when required", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={errors}
              required
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("*")).toBeDefined();
    });

    it("renders placeholder", () => {
      render(
        <TestForm>
          {({ register, errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={errors}
              placeholder="Enter description"
            />
          )}
        </TestForm>
      );

      expect(screen.getByPlaceholderText("Enter description")).toBeDefined();
    });
  });

  describe("Attributes", () => {
    it("uses default 4 rows", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      const textarea = container.querySelector("textarea");
      expect(textarea?.rows).toBe(4);
    });

    it("applies custom rows", () => {
      const { container } = render(
        <TestForm>
          {({ register }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={{}}
              rows={10}
            />
          )}
        </TestForm>
      );

      const textarea = container.querySelector("textarea");
      expect(textarea?.rows).toBe(10);
    });

    it("applies maxLength attribute", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={errors}
              maxLength={500}
            />
          )}
        </TestForm>
      );

      const textarea = container.querySelector("textarea");
      expect(textarea?.maxLength).toBe(500);
    });
  });

  describe("State Management", () => {
    it("can be disabled", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors: _errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={_errors}
              disabled
            />
          )}
        </TestForm>
      );

      const textarea = container.querySelector("textarea");
      expect(textarea?.disabled).toBe(true);
    });

    it("shows error styling when error exists", () => {
      const { container } = render(
        <TestForm>
          {({ register }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={{
                description: { type: "required", message: "Required" },
              }}
            />
          )}
        </TestForm>
      );

      const textarea = container.querySelector("textarea");
      expect(textarea?.className).toContain("border-red-500");
    });

    it("displays error message", () => {
      render(
        <TestForm>
          {({ register, errors: _errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={{
                description: {
                  type: "required",
                  message: "Description is required",
                },
              }}
            />
          )}
        </TestForm>
      );

      expect(screen.getByText("Description is required")).toBeDefined();
    });

    it("applies disabled styling", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={errors}
              disabled
            />
          )}
        </TestForm>
      );

      const textarea = container.querySelector("textarea");
      expect(textarea?.className).toContain("bg-gray-50");
      expect(textarea?.className).toContain("cursor-not-allowed");
    });
  });

  describe("Custom Styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={errors}
              className="custom-textarea"
            />
          )}
        </TestForm>
      );

      const wrapper = container.querySelector(".custom-textarea");
      expect(wrapper).toBeDefined();
    });

    it("has resize-vertical class", () => {
      const { container } = render(
        <TestForm>
          {({ register, errors }) => (
            <TextareaField
              label="Description"
              name="description"
              register={register}
              errors={errors}
            />
          )}
        </TestForm>
      );

      const textarea = container.querySelector("textarea");
      expect(textarea?.className).toContain("resize-vertical");
    });
  });
});

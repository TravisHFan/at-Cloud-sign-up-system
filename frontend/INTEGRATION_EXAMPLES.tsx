// Example: How to use the new shared form components and validation

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  TextField,
  PasswordField,
  SelectField,
} from "../components/forms/shared/FormFields";
import { signUpSchema } from "../utils/validation";
import { useAuth } from "../hooks/useAuth";
import type { SignUpFormData } from "../types";

export function ExampleSignUpForm() {
  const { login } = useAuth();

  const form = useForm<SignUpFormData>({
    resolver: yupResolver(signUpSchema),
    defaultValues: {
      isAtCloudLeader: "No",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const onSubmit = async (data: SignUpFormData) => {
    try {
      // Use shared validation and types
      console.log("Form data:", data);

      // Integrate with auth context
      const result = await login({
        username: data.username,
        password: data.password,
      });

      if (result.success) {
        // Handle success
      }
    } catch (error) {
      // Handle error with shared error types
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Use shared form components */}
      <TextField
        label="Username"
        name="username"
        register={register}
        errors={errors}
        required
      />

      <TextField
        label="Email"
        name="email"
        type="email"
        register={register}
        errors={errors}
        required
      />

      <PasswordField
        label="Password"
        name="password"
        register={register}
        errors={errors}
        required
        showToggle
      />

      <SelectField
        label="Are you an @Cloud Leader?"
        name="isAtCloudLeader"
        register={register}
        errors={errors}
        required
        options={[
          { value: "No", label: "No" },
          { value: "Yes", label: "Yes" },
        ]}
      />

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
      >
        Sign Up
      </button>
    </form>
  );
}

// Example: How to use auth context and role-based access
import { useAuth, useRequireRole } from "../hooks/useAuth";

export function ExampleProtectedComponent() {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { hasAccess } = useRequireRole(["Super Admin", "Administrator"]);

  if (!isAuthenticated) {
    return <div>Please log in to access this page.</div>;
  }

  return (
    <div>
      <h1>Welcome, {currentUser?.firstName}!</h1>
      <p>Your role: {currentUser?.role}</p>

      {hasAccess && (
        <div>
          <h2>Admin Section</h2>
          <p>You have admin access!</p>
        </div>
      )}

      <button
        onClick={logout}
        className="bg-red-600 text-white px-4 py-2 rounded"
      >
        Logout
      </button>
    </div>
  );
}

// Example: How to use shared types and validation utilities
import { validateField, validateForm } from "../utils/validation";
import { loginSchema } from "../utils/validation";
import type { LoginFormData, ApiResponse } from "../types";

export async function exampleValidation() {
  // Field-level validation
  const fieldResult = await validateField(
    "email",
    "invalid-email",
    loginSchema
  );
  if (!fieldResult.isValid) {
    console.log("Email error:", fieldResult.error);
  }

  // Form-level validation
  const formData: LoginFormData = {
    username: "",
    password: "weak",
  };

  const formResult = await validateForm(formData, loginSchema);
  if (!formResult.isValid) {
    console.log("Form errors:", formResult.errors);
  }
}

// Example: API integration with shared types
export async function exampleApiCall(): Promise<ApiResponse<any>> {
  try {
    const response = await fetch("/api/users");
    const data = await response.json();

    return {
      success: true,
      data: data.users,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to fetch users",
    };
  }
}

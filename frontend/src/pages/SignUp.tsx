import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { signUpSchema } from "../schemas/signUpSchema";
import type { SignUpFormData } from "../schemas/signUpSchema";
import PasswordField from "../components/forms/PasswordField";
import ConfirmPasswordField from "../components/forms/ConfirmPasswordField";
import FormField from "../components/forms/FormField";
import SelectField from "../components/forms/SelectField";
import TextareaField from "../components/forms/TextareaField";
import {
  SignUpHeader,
  SignUpFormWrapper,
  LeaderQuestionSection,
} from "../components/signup";

export default function SignUp() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignUpFormData>({
    resolver: yupResolver<SignUpFormData, any, any>(signUpSchema),
    defaultValues: {
      isAtCloudLeader: "false",
    },
  });

  const password = watch("password");
  const isAtCloudLeader = watch("isAtCloudLeader");

  const onSubmit = async (data: SignUpFormData) => {
    setIsSubmitting(true);

    try {
      console.log("Sign up data:", data);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success(
        "Registration successful! Please check your email to verify your account."
      );

      if (data.isAtCloudLeader === "true") {
        console.log("Sending email to Owner about Leader role request");
        toast.success(
          "Your Leader role request has been sent to the Owner for review."
        );
      }

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      console.error("Sign up error:", error);
      toast.error("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const genderOptions = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <SignUpHeader />

        <SignUpFormWrapper
          onSubmit={handleSubmit(onSubmit)}
          isSubmitting={isSubmitting}
        >
          {/* Username */}
          <FormField
            label="Username"
            name="username"
            register={register}
            errors={errors}
            placeholder="Enter your username"
            required={true}
          />

          {/* Password Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PasswordField
              register={register}
              errors={errors}
              password={password}
              showStrengthIndicator={true}
            />
            <ConfirmPasswordField register={register} errors={errors} />
          </div>

          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="First Name"
              name="firstName"
              register={register}
              errors={errors}
              placeholder="Enter your first name"
              required={true}
            />
            <FormField
              label="Last Name"
              name="lastName"
              register={register}
              errors={errors}
              placeholder="Enter your last name"
              required={true}
            />
          </div>

          {/* Gender */}
          <SelectField
            label="Gender"
            name="gender"
            register={register}
            errors={errors}
            options={genderOptions}
            placeholder="Select Gender"
            required={true}
          />

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Email"
              name="email"
              register={register}
              errors={errors}
              type="email"
              placeholder="Enter your email address"
              required={true}
            />
            <FormField
              label="Phone"
              name="phone"
              register={register}
              errors={errors}
              type="tel"
              placeholder="Enter your phone number"
              required={false}
            />
          </div>

          {/* @Cloud Leader Question */}
          <LeaderQuestionSection
            register={register}
            errors={errors}
            isAtCloudLeader={isAtCloudLeader}
          />

          {/* Optional Fields */}
          <TextareaField
            label="Home Address"
            name="homeAddress"
            register={register}
            errors={errors}
            placeholder="Enter your home address"
            required={false}
          />

          <FormField
            label="Company"
            name="company"
            register={register}
            errors={errors}
            placeholder="Enter your company name"
            required={false}
          />
        </SignUpFormWrapper>
      </div>
    </div>
  );
}

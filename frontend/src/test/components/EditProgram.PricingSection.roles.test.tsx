import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import PricingSection from "../../components/EditProgram/PricingSection";
import type { ProgramStudentRoleForm } from "../../types/program";
import { DEFAULT_STUDENT_ROLES } from "../../utils/programRoles";

type ProgramFormData = {
  programType: string;
  title: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  hostedBy: string;
  introduction: string;
  flyerUrl?: string;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  teacherRoleName?: string;
  studentRoles?: ProgramStudentRoleForm[];
  isFree?: string;
  earlyBirdDeadline?: string;
  fullPriceTicket: number | undefined;
  classRepDiscount?: number | undefined;
  earlyBirdDiscount?: number | undefined;
  classRepLimit?: number | undefined;
};

function PricingSectionHarness({
  studentRoles = DEFAULT_STUDENT_ROLES,
}: {
  studentRoles?: ProgramStudentRoleForm[];
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProgramFormData>({
    defaultValues: {
      isFree: "false",
      fullPriceTicket: 100,
      earlyBirdDiscount: 10,
      earlyBirdDeadline: "",
      studentRoles,
    },
  });

  return (
    <PricingSection
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
    />
  );
}

describe("EditProgram PricingSection student discount roles", () => {
  it("allows zero tuition discount roles", () => {
    render(<PricingSectionHarness />);

    const discountToggles = screen.getAllByLabelText(/tuition discount role/i);
    expect(discountToggles).toHaveLength(2);
    expect(discountToggles[1]).toBeChecked();
    expect(screen.getByLabelText(/class representative discount/i)).toBeInTheDocument();

    fireEvent.click(discountToggles[1]);

    expect(discountToggles[1]).not.toBeChecked();
    expect(
      screen.queryByLabelText(/class representative discount/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("Early Bird")).toBeInTheDocument();
  });

  it("allows multiple tuition discount roles and renders pricing inputs for each", () => {
    render(<PricingSectionHarness />);

    const discountToggles = screen.getAllByLabelText(/tuition discount role/i);
    fireEvent.click(discountToggles[0]);

    expect(discountToggles[0]).toBeChecked();
    expect(discountToggles[1]).toBeChecked();
    expect(screen.getByLabelText(/mentee discount/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/class representative discount/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Mentee")).toBeInTheDocument();
    expect(screen.getByText("Class Representative")).toBeInTheDocument();
  });

  it("keeps newly added roles independently selectable for tuition discounts", () => {
    render(<PricingSectionHarness />);

    fireEvent.click(screen.getByRole("button", { name: /add role/i }));

    const roleNameInputs = screen.getAllByLabelText(/role name/i);
    fireEvent.change(roleNameInputs[2], { target: { value: "Scholar" } });

    const discountToggles = screen.getAllByLabelText(/tuition discount role/i);
    fireEvent.click(discountToggles[2]);

    expect(discountToggles[2]).toBeChecked();
    expect(screen.getByLabelText(/scholar discount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/scholar limit/i)).toBeInTheDocument();
  });
});

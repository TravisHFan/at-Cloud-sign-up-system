import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BasicEventFields from "../../components/EditEvent/BasicEventFields";
import { useForm, FormProvider } from "react-hook-form";
import type { EventFormData } from "../../schemas/eventSchema";
import { MemoryRouter } from "react-router-dom";

// Mock dependencies
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "u1",
      firstName: "Test",
      lastName: "User",
      role: "Administrator",
      gender: "male",
      avatar: null,
      email: "test@example.com",
    },
  }),
}));

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("../../services/api", () => ({
  eventService: {
    checkEventTimeConflict: vi.fn().mockResolvedValue({ conflict: false }),
  },
  fileService: {
    uploadImage: vi.fn(),
  },
}));

// Wrapper component to provide react-hook-form context
function TestWrapper({
  isEditMode = false,
  repeatFrequency = "never",
  onRepeatFrequencyChange = vi.fn(),
  occurrenceCount = "",
  onOccurrenceCountChange = vi.fn(),
  recurrenceMode = "same-date",
  onRecurrenceModeChange = vi.fn(),
  weekdayOrdinal = "",
  onWeekdayOrdinalChange = vi.fn(),
  weekday = "",
  onWeekdayChange = vi.fn(),
}: {
  isEditMode?: boolean;
  repeatFrequency?: string;
  onRepeatFrequencyChange?: (v: string) => void;
  occurrenceCount?: string;
  onOccurrenceCountChange?: (v: string) => void;
  recurrenceMode?: string;
  onRecurrenceModeChange?: (v: string) => void;
  weekdayOrdinal?: string;
  onWeekdayOrdinalChange?: (v: string) => void;
  weekday?: string;
  onWeekdayChange?: (v: string) => void;
}) {
  const methods = useForm<EventFormData>({
    defaultValues: {
      title: "",
      type: "",
      date: "",
      time: "",
      endTime: "",
      format: "Online",
      organizer: "",
      agenda: "",
    } as unknown as EventFormData,
  });

  return (
    <MemoryRouter>
      <FormProvider {...methods}>
        <BasicEventFields
          register={methods.register}
          errors={methods.formState.errors}
          watch={methods.watch}
          setValue={methods.setValue}
          validations={{
            title: { isValid: true, message: "", color: "" },
            type: { isValid: true, message: "", color: "" },
            date: { isValid: true, message: "", color: "" },
            time: { isValid: true, message: "", color: "" },
            endDate: { isValid: true, message: "", color: "" },
            endTime: { isValid: true, message: "", color: "" },
            agenda: { isValid: true, message: "", color: "" },
            format: { isValid: true, message: "", color: "" },
            location: { isValid: true, message: "", color: "" },
            zoomLink: { isValid: true, message: "", color: "" },
            startOverlap: { isValid: true, message: "", color: "" },
            endOverlap: { isValid: true, message: "", color: "" },
          }}
          currentUser={{
            id: "u1",
            firstName: "Test",
            lastName: "User",
            role: "Administrator",
            email: "test@example.com",
          }}
          programs={[]}
          programLoading={false}
          selectedOrganizers={[]}
          onOrganizersChange={vi.fn()}
          originalFlyerUrl={null}
          originalSecondaryFlyerUrl={null}
          isEditMode={isEditMode}
          repeatFrequency={repeatFrequency}
          onRepeatFrequencyChange={onRepeatFrequencyChange}
          occurrenceCount={occurrenceCount}
          onOccurrenceCountChange={onOccurrenceCountChange}
          recurrenceMode={recurrenceMode}
          onRecurrenceModeChange={onRecurrenceModeChange}
          weekdayOrdinal={weekdayOrdinal}
          onWeekdayOrdinalChange={onWeekdayOrdinalChange}
          weekday={weekday}
          onWeekdayChange={onWeekdayChange}
        />
      </FormProvider>
    </MemoryRouter>
  );
}

describe("Repeat field in BasicEventFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Repeat dropdown with Never as default", () => {
    render(<TestWrapper />);
    const repeatSelect = screen.getByLabelText(/repeat/i);
    expect(repeatSelect).toBeInTheDocument();
    expect((repeatSelect as HTMLSelectElement).value).toBe("never");
  });

  it("renders all frequency options", () => {
    render(<TestWrapper />);
    const repeatSelect = screen.getByLabelText(/repeat/i);
    const options = Array.from((repeatSelect as HTMLSelectElement).options);
    const values = options.map((o) => o.value);
    expect(values).toContain("never");
    expect(values).toContain("weekly");
    expect(values).toContain("biweekly");
    expect(values).toContain("monthly");
    expect(values).toContain("every-two-months");
    expect(values).toContain("every-three-months");
  });

  it("is disabled in edit mode and shows Never", () => {
    render(<TestWrapper isEditMode={true} />);
    const repeatSelect = screen.getByLabelText(/repeat/i);
    expect(repeatSelect).toBeDisabled();
    expect((repeatSelect as HTMLSelectElement).value).toBe("never");
  });

  it("calls onRepeatFrequencyChange when user selects a frequency", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper onRepeatFrequencyChange={onChange} />);
    const repeatSelect = screen.getByLabelText(/repeat/i);
    await user.selectOptions(repeatSelect, "weekly");
    expect(onChange).toHaveBeenCalledWith("weekly");
  });

  it("shows occurrence count for weekly frequency", () => {
    render(<TestWrapper repeatFrequency="weekly" />);
    expect(
      screen.getByText(/how many times should this event recur/i),
    ).toBeInTheDocument();
  });

  it("shows occurrence count for biweekly frequency", () => {
    render(<TestWrapper repeatFrequency="biweekly" />);
    expect(
      screen.getByText(/how many times should this event recur/i),
    ).toBeInTheDocument();
  });

  it("shows recurrence mode and occurrence count for monthly frequency", () => {
    render(<TestWrapper repeatFrequency="monthly" />);
    expect(
      screen.getByText(/how will this event recur\?/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/how many times should this event recur/i),
    ).toBeInTheDocument();
  });

  it("shows recurrence mode for every-two-months frequency", () => {
    render(<TestWrapper repeatFrequency="every-two-months" />);
    expect(
      screen.getByText(/how will this event recur\?/i),
    ).toBeInTheDocument();
  });

  it("shows recurrence mode for every-three-months frequency", () => {
    render(<TestWrapper repeatFrequency="every-three-months" />);
    expect(
      screen.getByText(/how will this event recur\?/i),
    ).toBeInTheDocument();
  });

  it("shows ordinal and weekday dropdowns when same-weekday is selected", () => {
    render(
      <TestWrapper repeatFrequency="monthly" recurrenceMode="same-weekday" />,
    );
    expect(screen.getByLabelText(/on every/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/day of the week/i)).toBeInTheDocument();
  });

  it("does not show ordinal/weekday dropdowns for same-date mode", () => {
    render(
      <TestWrapper repeatFrequency="monthly" recurrenceMode="same-date" />,
    );
    expect(screen.queryByLabelText(/on every/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/day of the week/i)).not.toBeInTheDocument();
  });

  it("does not show recurrence sub-fields when Never is selected", () => {
    render(<TestWrapper repeatFrequency="never" />);
    expect(
      screen.queryByText(/how many times should this event recur/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/how will this event recur\?/i),
    ).not.toBeInTheDocument();
  });
});

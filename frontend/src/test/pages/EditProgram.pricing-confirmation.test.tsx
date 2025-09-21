import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, beforeEach, expect } from "vitest";
import EditProgram from "../../pages/EditProgram";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

// Mock the API services
vi.mock("../../services/api", () => ({
  programService: {
    getById: vi.fn(),
    update: vi.fn(),
  },
  fileService: {
    uploadFile: vi.fn(),
  },
  userService: {
    getUsers: vi.fn().mockResolvedValue({
      users: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalUsers: 0,
        hasNext: false,
        hasPrev: false,
      },
    }),
  },
}));

// Mock useAuth hook
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "user1",
      firstName: "Test",
      lastName: "User",
      systemAuthorizationLevel: "Admin",
    },
  }),
}));

// Mock program validation hook
vi.mock("../../hooks/useProgramValidation", () => ({
  useProgramValidation: () => ({
    validations: {
      // Provide default validation objects for all fields that might be used
      title: { isValid: true, message: "", color: "text-green-600" },
      programType: { isValid: true, message: "", color: "text-green-600" },
      hostedBy: { isValid: true, message: "", color: "text-green-600" },
      introduction: { isValid: true, message: "", color: "text-green-600" },
      flyerUrl: { isValid: true, message: "", color: "text-green-600" },
      fullPriceTicket: { isValid: true, message: "", color: "text-green-600" },
      classRepDiscount: { isValid: true, message: "", color: "text-green-600" },
      earlyBirdDiscount: {
        isValid: true,
        message: "",
        color: "text-green-600",
      },
      earlyBirdDeadline: {
        isValid: true,
        message: "",
        color: "text-green-600",
      },
      period: { isValid: true, message: "", color: "text-green-600" },
      mentorsByCircle: { isValid: true, message: "", color: "text-green-600" },
      // Add the date-specific validations that the component uses
      startYear: { isValid: true, message: "", color: "text-green-600" },
      startMonth: { isValid: true, message: "", color: "text-green-600" },
      endYear: { isValid: true, message: "", color: "text-green-600" },
      endMonth: { isValid: true, message: "", color: "text-green-600" },
    },
    overallStatus: { isValid: true, errorCount: 0 },
  }),
}));

const mockProgram = {
  id: "program1",
  title: "Test Program",
  programType: "EMBA Mentor Circles",
  hostedBy: "@Cloud Marketplace Ministry",
  period: {
    startYear: "2025",
    startMonth: "01",
    endYear: "2025",
    endMonth: "12",
  },
  introduction: "Test introduction",
  flyerUrl: "",
  isFree: false,
  earlyBirdDeadline: "",
  fullPriceTicket: 100,
  classRepDiscount: 10,
  earlyBirdDiscount: 20,
  mentorsByCircle: {
    E: [],
    M: [],
    B: [],
    A: [],
  },
};

describe("EditProgram - Pricing Confirmation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock the program service to return test data
    const { programService } = await import("../../services/api");
    vi.mocked(programService.getById).mockResolvedValue(mockProgram);
    vi.mocked(programService.update).mockResolvedValue({ success: true });
  });

  const renderEditProgram = () => {
    return render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/program1/edit"]}>
          <Routes>
            <Route
              path="/dashboard/programs/:id/edit"
              element={<EditProgram />}
            />
            {/* Fallback route to avoid routing errors when component navigates after update */}
            <Route
              path="/dashboard/programs/:id"
              element={<div>Program Detail</div>}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );
  };

  it("shows confirmation modal when pricing changes are detected", async () => {
    renderEditProgram();

    // Wait for the program to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Program")).toBeInTheDocument();
    });

    // Change the full price ticket value (this should trigger pricing confirmation)
    const fullPriceInput = screen.getByLabelText(/full price ticket/i);
    fireEvent.change(fullPriceInput, { target: { value: "150" } });

    // Submit the form
    const updateButton = screen.getByRole("button", {
      name: /update program/i,
    });
    fireEvent.click(updateButton);

    // Should show the first step of confirmation modal
    expect(
      await screen.findByText("Pricing Changes Detected")
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /You have made changes to the program's pricing section/
      )
    ).toBeInTheDocument();

    // Should show the pricing change details
    expect(
      await screen.findByText(/Full price: \$100\.00 → \$150\.00/)
    ).toBeInTheDocument();
  });

  it("shows second confirmation step after clicking Continue", async () => {
    renderEditProgram();

    // Wait for the program to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Program")).toBeInTheDocument();
    });

    // Change the full price ticket value
    const fullPriceInput = screen.getByLabelText(/full price ticket/i);
    fireEvent.change(fullPriceInput, { target: { value: "150" } });

    // Submit the form
    const updateButton = screen.getByRole("button", {
      name: /update program/i,
    });
    fireEvent.click(updateButton);

    // Click Continue on first confirmation step (wait until it appears)
    const continueButton = await screen.findByRole("button", {
      name: /continue/i,
    });
    fireEvent.click(continueButton);

    // Should show the second step of confirmation
    expect(screen.getByText("Final Confirmation")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you absolutely sure you want to update the pricing/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /yes, update pricing/i })
    ).toBeInTheDocument();
  });

  it("submits form after final confirmation", async () => {
    const { programService } = await import("../../services/api");

    renderEditProgram();

    // Wait for the program to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Program")).toBeInTheDocument();
    });

    // Change the full price ticket value
    const fullPriceInput = screen.getByLabelText(/full price ticket/i);
    fireEvent.change(fullPriceInput, { target: { value: "150" } });

    // Submit the form
    const updateButton = screen.getByRole("button", {
      name: /update program/i,
    });
    fireEvent.click(updateButton);

    // Click Continue on first confirmation step
    const continueButton = await screen.findByRole("button", {
      name: /continue/i,
    });
    fireEvent.click(continueButton);

    // Click final confirmation
    const finalConfirmButton = screen.getByRole("button", {
      name: /yes, update pricing/i,
    });
    fireEvent.click(finalConfirmButton);

    // Should call the update API with new pricing
    await waitFor(() => {
      expect(programService.update).toHaveBeenCalledWith(
        "program1",
        expect.objectContaining({
          fullPriceTicket: 150,
        })
      );
    });
  });

  it("cancels confirmation and returns to form", async () => {
    renderEditProgram();

    // Wait for the program to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Program")).toBeInTheDocument();
    });

    // Change the full price ticket value
    const fullPriceInput = screen.getByLabelText(/full price ticket/i);
    fireEvent.change(fullPriceInput, { target: { value: "150" } });

    // Submit the form
    const updateButton = screen.getByRole("button", {
      name: /update program/i,
    });
    fireEvent.click(updateButton);

    // Cancel the confirmation (wait until it appears). There are two "Cancel" buttons in the DOM
    // (form-level and modal). Click the modal one by selecting the last match.
    // Find the dialog and click its Cancel
    const dialog = await screen.findByRole("dialog");
    const cancelInDialog = await within(dialog).findByRole("button", {
      name: /cancel/i,
    });
    fireEvent.click(cancelInDialog);

    // Should return to the form without modal
    await waitFor(() => {
      expect(
        screen.queryByText("Pricing Changes Detected")
      ).not.toBeInTheDocument();
    });
    expect(await screen.findByDisplayValue("Test Program")).toBeInTheDocument();
  });

  it("skips confirmation when no pricing changes are made", async () => {
    const { programService } = await import("../../services/api");

    renderEditProgram();

    // Wait for the program to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Program")).toBeInTheDocument();
    });

    // Change non-pricing field (title)
    const titleInput = screen.getByLabelText(/program title/i);
    fireEvent.change(titleInput, { target: { value: "Updated Test Program" } });

    // Submit the form
    const updateButton = screen.getByRole("button", {
      name: /update program/i,
    });
    fireEvent.click(updateButton);

    // Should not show confirmation modal and submit directly
    expect(
      screen.queryByText("Pricing Changes Detected")
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(programService.update).toHaveBeenCalledWith(
        "program1",
        expect.objectContaining({
          title: "Updated Test Program",
        })
      );
    });
  });
});

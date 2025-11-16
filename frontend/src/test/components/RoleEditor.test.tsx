import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoleEditor } from "../../components/RoleEditor";
import type { TemplateRole } from "../../types/rolesTemplate";

describe("RoleEditor", () => {
  const mockRoles: TemplateRole[] = [
    {
      name: "Speaker",
      description: "Present the main topic",
      maxParticipants: 2,
      openToPublic: true,
      agenda: "10:00 AM - 11:00 AM",
    },
    {
      name: "Participant",
      description: "Attend and engage",
      maxParticipants: 50,
      openToPublic: true,
    },
  ];

  describe("Initial Rendering", () => {
    it("renders roles list", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      expect(screen.getByDisplayValue("Speaker")).toBeDefined();
      expect(screen.getByDisplayValue("Participant")).toBeDefined();
    });

    it("renders empty state when no roles", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={[]} onChange={onChange} />);

      expect(screen.getByText("No roles defined yet")).toBeDefined();
      expect(screen.getByText("+ Add First Role")).toBeDefined();
    });

    it("shows role descriptions", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      expect(screen.getByDisplayValue("Present the main topic")).toBeDefined();
      expect(screen.getByDisplayValue("Attend and engage")).toBeDefined();
    });

    it("shows max participants for each role", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const inputs = screen.getAllByDisplayValue(/2|50/);
      expect(inputs.length).toBeGreaterThan(0);
    });

    it("shows agenda when provided", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      expect(screen.getByDisplayValue("10:00 AM - 11:00 AM")).toBeDefined();
    });

    it("shows public access checkboxes", () => {
      const onChange = vi.fn();
      const { container } = render(
        <RoleEditor roles={mockRoles} onChange={onChange} />
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
    });
  });

  describe("Adding Roles", () => {
    it("adds role at top position", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const addTopButton = screen.getAllByText("+ Add Role Here")[0];
      fireEvent.click(addTopButton);

      expect(onChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: "" }),
          mockRoles[0],
          mockRoles[1],
        ])
      );
    });

    it("adds role between existing roles", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const addButtons = screen.getAllByText("+ Add Role Here");
      fireEvent.click(addButtons[1]);

      expect(onChange).toHaveBeenCalled();
      const calledRoles = onChange.mock.calls[0][0];
      expect(calledRoles.length).toBe(3);
      expect(calledRoles[0]).toEqual(mockRoles[0]);
      expect(calledRoles[1].name).toBe("");
      expect(calledRoles[2]).toEqual(mockRoles[1]);
    });

    it("adds first role from empty state", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={[]} onChange={onChange} />);

      const addButton = screen.getByText("+ Add First Role");
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith([
        {
          name: "",
          description: "",
          maxParticipants: 1,
          openToPublic: false,
        },
      ]);
    });

    it("new role has default values", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={[]} onChange={onChange} />);

      const addButton = screen.getByText("+ Add First Role");
      fireEvent.click(addButton);

      const newRole = onChange.mock.calls[0][0][0];
      expect(newRole.name).toBe("");
      expect(newRole.description).toBe("");
      expect(newRole.maxParticipants).toBe(1);
      expect(newRole.openToPublic).toBe(false);
    });
  });

  describe("Removing Roles", () => {
    it("removes role when Remove button clicked", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const removeButtons = screen.getAllByText("Remove");
      fireEvent.click(removeButtons[0]);

      expect(onChange).toHaveBeenCalledWith([mockRoles[1]]);
    });

    it("removes correct role from middle", () => {
      const threeRoles = [...mockRoles, { ...mockRoles[0], name: "Moderator" }];
      const onChange = vi.fn();
      render(<RoleEditor roles={threeRoles} onChange={onChange} />);

      const removeButtons = screen.getAllByText("Remove");
      fireEvent.click(removeButtons[1]);

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result.length).toBe(2);
      expect(result[0].name).toBe("Speaker");
      expect(result[1].name).toBe("Moderator");
    });
  });

  describe("Moving Roles", () => {
    it("moves role up", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const moveUpButtons = screen.getAllByText("↑ Move Up");
      fireEvent.click(moveUpButtons[1]);

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0].name).toBe("Participant");
      expect(result[1].name).toBe("Speaker");
    });

    it("moves role down", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const moveDownButtons = screen.getAllByText("↓ Move Down");
      fireEvent.click(moveDownButtons[0]);

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0].name).toBe("Participant");
      expect(result[1].name).toBe("Speaker");
    });

    it("disables move up for first role", () => {
      const onChange = vi.fn();
      const { container } = render(
        <RoleEditor roles={mockRoles} onChange={onChange} />
      );

      const moveUpButtons = container.querySelectorAll("button");
      const firstMoveUp = Array.from(moveUpButtons).find(
        (btn) => btn.textContent === "↑ Move Up"
      );
      expect(firstMoveUp?.disabled).toBe(true);
    });

    it("disables move down for last role", () => {
      const onChange = vi.fn();
      const { container } = render(
        <RoleEditor roles={mockRoles} onChange={onChange} />
      );

      const allButtons = container.querySelectorAll("button");
      const moveDownButtons = Array.from(allButtons).filter(
        (btn) => btn.textContent === "↓ Move Down"
      );
      const lastMoveDown = moveDownButtons[moveDownButtons.length - 1];
      expect(lastMoveDown?.disabled).toBe(true);
    });

    it("does not move up when already at top", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const moveUpButtons = screen.getAllByText("↑ Move Up");
      fireEvent.click(moveUpButtons[0]);

      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not move down when already at bottom", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const moveDownButtons = screen.getAllByText("↓ Move Down");
      fireEvent.click(moveDownButtons[moveDownButtons.length - 1]);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Updating Role Fields", () => {
    it("updates role name", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const nameInput = screen.getByDisplayValue("Speaker");
      fireEvent.change(nameInput, { target: { value: "Keynote Speaker" } });

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0].name).toBe("Keynote Speaker");
    });

    it("updates role description", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const descInput = screen.getByDisplayValue("Present the main topic");
      fireEvent.change(descInput, { target: { value: "New description" } });

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0].description).toBe("New description");
    });

    it("updates max participants", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const capacityInputs = screen.getAllByRole("spinbutton");
      fireEvent.change(capacityInputs[0], { target: { value: "5" } });

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0].maxParticipants).toBe(5);
    });

    it("updates openToPublic checkbox", () => {
      const onChange = vi.fn();
      const rolesWithPrivate = [{ ...mockRoles[0], openToPublic: false }];
      const { container } = render(
        <RoleEditor roles={rolesWithPrivate} onChange={onChange} />
      );

      const checkbox = container.querySelector('input[type="checkbox"]');
      if (checkbox) {
        fireEvent.click(checkbox);
      }

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0].openToPublic).toBe(true);
    });

    it("updates agenda field", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const agendaInput = screen.getByDisplayValue("10:00 AM - 11:00 AM");
      fireEvent.change(agendaInput, {
        target: { value: "9:00 AM - 10:00 AM" },
      });

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0].agenda).toBe("9:00 AM - 10:00 AM");
    });

    it("sets agenda to undefined when cleared", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const agendaInput = screen.getByDisplayValue("10:00 AM - 11:00 AM");
      fireEvent.change(agendaInput, { target: { value: "" } });

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0].agenda).toBeUndefined();
    });

    it("handles invalid number input for maxParticipants", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      const capacityInputs = screen.getAllByRole("spinbutton");
      fireEvent.change(capacityInputs[0], { target: { value: "" } });

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0].maxParticipants).toBe(1);
    });
  });

  describe("Read-only Mode (canEdit=false)", () => {
    it("hides add role buttons when canEdit is false", () => {
      const onChange = vi.fn();
      render(
        <RoleEditor roles={mockRoles} onChange={onChange} canEdit={false} />
      );

      expect(screen.queryByText("+ Add Role Here")).toBeNull();
      expect(screen.queryByText("Remove")).toBeNull();
    });

    it("displays role name as text instead of input", () => {
      const onChange = vi.fn();
      render(
        <RoleEditor roles={mockRoles} onChange={onChange} canEdit={false} />
      );

      expect(screen.queryByDisplayValue("Speaker")).toBeNull();
      expect(screen.getByText("Speaker")).toBeDefined();
    });

    it("displays description as read-only text", () => {
      const onChange = vi.fn();
      const { container } = render(
        <RoleEditor roles={mockRoles} onChange={onChange} canEdit={false} />
      );

      const textarea = container.querySelector(
        'textarea[placeholder*="Describe"]'
      );
      expect(textarea).toBeNull();
      expect(screen.getByText("Present the main topic")).toBeDefined();
    });

    it("disables all input fields", () => {
      const onChange = vi.fn();
      const { container } = render(
        <RoleEditor roles={mockRoles} onChange={onChange} canEdit={false} />
      );

      const inputs = container.querySelectorAll("input, textarea");
      inputs.forEach((input) => {
        if (input.tagName.toLowerCase() !== "button") {
          expect(input.hasAttribute("disabled")).toBe(true);
        }
      });
    });

    it("hides move up/down buttons", () => {
      const onChange = vi.fn();
      render(
        <RoleEditor roles={mockRoles} onChange={onChange} canEdit={false} />
      );

      expect(screen.queryByText("↑ Move Up")).toBeNull();
      expect(screen.queryByText("↓ Move Down")).toBeNull();
    });

    it("shows add first role button in empty state when canEdit is false", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={[]} onChange={onChange} canEdit={false} />);

      expect(screen.getByText("No roles defined yet")).toBeDefined();
      expect(screen.queryByText("+ Add First Role")).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("handles role with undefined agenda", () => {
      const rolesWithoutAgenda = [{ ...mockRoles[0], agenda: undefined }];
      const onChange = vi.fn();
      render(<RoleEditor roles={rolesWithoutAgenda} onChange={onChange} />);

      const agendaTextarea = screen.getByPlaceholderText(
        /Add role timing for this role/
      );
      expect(agendaTextarea).toBeDefined();
    });

    it("handles role with false openToPublic", () => {
      const rolesPrivate = [{ ...mockRoles[0], openToPublic: false }];
      const onChange = vi.fn();
      const { container } = render(
        <RoleEditor roles={rolesPrivate} onChange={onChange} />
      );

      const checkbox = container.querySelector(
        'input[type="checkbox"]'
      ) as HTMLInputElement;
      expect(checkbox?.checked).toBe(false);
    });

    it("handles single role", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={[mockRoles[0]]} onChange={onChange} />);

      expect(screen.getByDisplayValue("Speaker")).toBeDefined();
      expect(screen.getAllByText("+ Add Role Here").length).toBeGreaterThan(0);
    });

    it("handles many roles", () => {
      const manyRoles = Array(10)
        .fill(null)
        .map((_, i) => ({
          ...mockRoles[0],
          name: `Role ${i + 1}`,
        }));
      const onChange = vi.fn();
      render(<RoleEditor roles={manyRoles} onChange={onChange} />);

      expect(screen.getByDisplayValue("Role 1")).toBeDefined();
      expect(screen.getByDisplayValue("Role 10")).toBeDefined();
    });
  });

  describe("UI Elements", () => {
    it("shows capacity label", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      expect(screen.getAllByText("Capacity").length).toBe(2);
    });

    it("shows public access explanation", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      expect(
        screen.getAllByText(/When enabled, this role will be available/)[0]
      ).toBeDefined();
    });

    it("renders agenda section", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      expect(screen.getAllByText("Agenda").length).toBe(2);
    });

    it("renders description section", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      expect(screen.getAllByText("Description").length).toBe(2);
    });

    it("renders public access section", () => {
      const onChange = vi.fn();
      render(<RoleEditor roles={mockRoles} onChange={onChange} />);

      expect(screen.getAllByText("Public Access").length).toBe(2);
    });
  });
});

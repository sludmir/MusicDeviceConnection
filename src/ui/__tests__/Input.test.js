import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, Textarea, Select } from "../Input";

describe("Input", () => {
  test("renders label and input", () => {
    render(<Input label="Display Name" name="displayName" />);
    expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
  });

  test("shows error text in danger color", () => {
    render(<Input label="Email" error="Invalid" />);
    expect(screen.getByText("Invalid")).toHaveClass("ui-input__error");
  });

  test("shows help text when no error", () => {
    render(<Input label="Email" help="We never share this" />);
    expect(screen.getByText("We never share this")).toHaveClass("ui-input__help");
  });

  test("typing fires onChange", async () => {
    const onChange = jest.fn();
    render(<Input label="X" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("X"), "abc");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Textarea", () => {
  test("renders multi-line input", () => {
    render(<Textarea label="Bio" name="bio" />);
    const el = screen.getByLabelText("Bio");
    expect(el.tagName).toBe("TEXTAREA");
  });
});

describe("Select", () => {
  test("renders options", () => {
    render(
      <Select label="Type" name="type">
        <option value="dj">DJ</option>
        <option value="prod">Producer</option>
      </Select>
    );
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "DJ" })).toBeInTheDocument();
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Chip from "../Chip";

describe("Chip", () => {
  test("renders as span when not clickable", () => {
    render(<Chip>BPM 128</Chip>);
    const node = screen.getByText("BPM 128");
    expect(node.tagName).toBe("SPAN");
  });

  test("renders as button when onClick provided", async () => {
    const onClick = jest.fn();
    render(<Chip onClick={onClick}>CDJ-3000</Chip>);
    const btn = screen.getByRole("button", { name: "CDJ-3000" });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });
});

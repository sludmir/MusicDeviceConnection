import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Tabs from "../Tabs";

describe("Tabs", () => {
  const items = [
    { value: "sets", label: "SETS" },
    { value: "setups", label: "SETUPS" },
    { value: "liked", label: "LIKED" },
  ];

  test("renders all tab labels", () => {
    render(<Tabs items={items} value="sets" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "SETS" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "SETUPS" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "LIKED" })).toBeInTheDocument();
  });

  test("marks active tab with aria-selected", () => {
    render(<Tabs items={items} value="setups" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "SETUPS" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "SETS" })).toHaveAttribute("aria-selected", "false");
  });

  test("clicking a tab fires onChange with its value", async () => {
    const onChange = jest.fn();
    render(<Tabs items={items} value="sets" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "LIKED" }));
    expect(onChange).toHaveBeenCalledWith("liked");
  });
});

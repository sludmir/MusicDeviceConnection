import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Card from "../Card";

describe("Card", () => {
  test("renders children inside card class", () => {
    render(<Card>hello</Card>);
    const node = screen.getByText("hello").closest(".ui-card");
    expect(node).toBeInTheDocument();
  });

  test("clickable variant calls onClick", async () => {
    const onClick = jest.fn();
    render(<Card onClick={onClick}>x</Card>);
    await userEvent.click(screen.getByText("x"));
    expect(onClick).toHaveBeenCalled();
  });
});

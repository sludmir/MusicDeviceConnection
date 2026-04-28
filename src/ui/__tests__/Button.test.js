import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "../Button";

describe("Button", () => {
  test("renders children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  test("applies variant class", () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-btn--danger");
  });

  test("applies size class", () => {
    render(<Button size="sm">x</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-btn--sm");
  });

  test("calls onClick when clicked", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("does not call onClick when disabled", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick} disabled>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  test("shows loading spinner and disables when loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass("ui-btn--loading");
  });
});

import IconButton from "../IconButton";

describe("IconButton", () => {
  test("renders with aria-label", () => {
    render(<IconButton aria-label="Close"><span>×</span></IconButton>);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  test("applies icon-only class by default", () => {
    render(<IconButton aria-label="x"><span>×</span></IconButton>);
    expect(screen.getByRole("button")).toHaveClass("ui-btn--icon-only");
  });

  test("defaults to ghost variant", () => {
    render(<IconButton aria-label="x"><span>×</span></IconButton>);
    expect(screen.getByRole("button")).toHaveClass("ui-btn--ghost");
  });
});

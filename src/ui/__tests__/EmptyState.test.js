import React from "react";
import { render, screen } from "@testing-library/react";
import EmptyState from "../EmptyState";

describe("EmptyState", () => {
  test("renders eyebrow, title, body, and action", () => {
    render(
      <EmptyState
        eyebrow="NO SETUPS"
        title="Build your first setup"
        body="Pick a setup type to begin."
        action={<button>New Setup</button>}
      />
    );
    expect(screen.getByText("NO SETUPS")).toBeInTheDocument();
    expect(screen.getByText("Build your first setup")).toBeInTheDocument();
    expect(screen.getByText("Pick a setup type to begin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Setup" })).toBeInTheDocument();
  });
});

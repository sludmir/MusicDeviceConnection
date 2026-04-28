import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sheet from "../Sheet";

describe("Sheet", () => {
  test("does not render when closed", () => {
    render(<Sheet open={false} onClose={() => {}} title="X">body</Sheet>);
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  test("renders title, body, and primary action", () => {
    render(
      <Sheet open onClose={() => {}} title="Post Set" primaryAction={<button>Save</button>}>
        body
      </Sheet>
    );
    expect(screen.getByText("Post Set")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  test("close button calls onClose", async () => {
    const onClose = jest.fn();
    render(<Sheet open onClose={onClose} title="X">body</Sheet>);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test("Escape key closes the sheet", async () => {
    const onClose = jest.fn();
    render(<Sheet open onClose={onClose} title="X">body</Sheet>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

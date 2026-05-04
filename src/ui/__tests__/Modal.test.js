import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "../Modal";

describe("Modal", () => {
  test("does not render when closed", () => {
    render(<Modal open={false} onClose={() => {}} title="X">body</Modal>);
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  test("renders title and body when open", () => {
    render(<Modal open onClose={() => {}} title="Confirm">body</Modal>);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  test("Escape key closes the modal", async () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="X">body</Modal>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  test("backdrop click closes the modal", async () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="X">body</Modal>);
    await userEvent.click(screen.getByTestId("ui-modal-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  test("close button calls onClose", async () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="X">body</Modal>);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

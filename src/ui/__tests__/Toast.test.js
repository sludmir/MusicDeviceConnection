import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "../Toast";

function Trigger({ kind = "success", message = "saved" }) {
  const toast = useToast();
  return <button onClick={() => toast[kind](message)}>fire</button>;
}

describe("Toast", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => { jest.runOnlyPendingTimers(); });
    jest.useRealTimers();
  });

  test("shows a success toast when fired", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    act(() => { fireEvent.click(screen.getByText("fire")); });
    expect(screen.getByText("saved")).toBeInTheDocument();
  });

  test("auto-dismisses after 3 seconds", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    act(() => { fireEvent.click(screen.getByText("fire")); });
    expect(screen.getByText("saved")).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(3100); });
    expect(screen.queryByText("saved")).not.toBeInTheDocument();
  });

  test("error toast applies error class", () => {
    render(
      <ToastProvider>
        <Trigger kind="error" message="oops" />
      </ToastProvider>
    );
    act(() => { fireEvent.click(screen.getByText("fire")); });
    expect(screen.getByText("oops").closest(".ui-toast")).toHaveClass("ui-toast--error");
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import Avatar from "../Avatar";

describe("Avatar", () => {
  test("renders image when src provided", () => {
    render(<Avatar src="https://x/y.jpg" name="Jane Doe" />);
    expect(screen.getByRole("img", { name: "Jane Doe" })).toHaveAttribute("src", "https://x/y.jpg");
  });

  test("renders initials when no src", () => {
    render(<Avatar name="Jane Doe" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  test("size class applied", () => {
    const { container } = render(<Avatar name="X Y" size={48} />);
    expect(container.firstChild).toHaveClass("ui-avatar--48");
  });
});

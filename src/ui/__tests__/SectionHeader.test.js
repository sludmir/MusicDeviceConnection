import React from "react";
import { render, screen } from "@testing-library/react";
import SectionHeader from "../SectionHeader";

describe("SectionHeader", () => {
  test("renders eyebrow + title + action", () => {
    render(
      <SectionHeader
        eyebrow="RECENT FROM YOUR FOLLOWS"
        title="What's new"
        action={<a href="#x">View all</a>}
      />
    );
    expect(screen.getByText("RECENT FROM YOUR FOLLOWS")).toBeInTheDocument();
    expect(screen.getByText("What's new")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all" })).toBeInTheDocument();
  });

  test("eyebrow alone renders without title", () => {
    render(<SectionHeader eyebrow="YOUR SETUPS" />);
    expect(screen.getByText("YOUR SETUPS")).toBeInTheDocument();
  });
});

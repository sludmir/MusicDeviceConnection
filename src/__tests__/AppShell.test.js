import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppShell from "../AppShell";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/hub" element={<div>HUB CONTENT</div>} />
          <Route path="/feed" element={<div>FEED CONTENT</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AppShell", () => {
  test("renders nested route content via outlet", () => {
    renderAt("/hub");
    expect(screen.getByText("HUB CONTENT")).toBeInTheDocument();
  });

  test("renders sidebar nav items", () => {
    renderAt("/hub");
    // Query within sidebar specifically
    const sidebar = document.querySelector(".app-sidebar");
    expect(sidebar.querySelector('[href="/hub"]')).toBeInTheDocument();
    expect(sidebar.querySelector('[href="/feed"]')).toBeInTheDocument();
  });

  test("marks active route in sidebar", () => {
    renderAt("/feed");
    // Query within sidebar for active link
    const sidebar = document.querySelector(".app-sidebar");
    const feedLink = sidebar.querySelector('[href="/feed"].app-sidebar__link--active');
    expect(feedLink).toHaveAttribute("aria-current", "page");
  });
});

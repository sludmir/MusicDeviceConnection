import React from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./NavConfig";
import "./BottomTabBar.css";

function BottomTabBar() {
  const items = NAV_ITEMS.filter((i) => !i.mobileHidden);
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {items.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === "/hub"}
          className={({ isActive }) =>
            `app-tabbar__tab ${isActive ? "app-tabbar__tab--active" : ""}`
          }
        >
          <Icon size={22} aria-hidden="true" />
          <span className="app-tabbar__label mono-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default BottomTabBar;

import React from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./NavConfig";
import "./BottomTabBar.css";

function BottomTabBar() {
  const items = NAV_ITEMS.filter((i) => !i.mobileHidden);
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {items.map(({ path, label, icon: Icon, accent }) => (
        <NavLink
          key={path}
          to={path}
          end={path === "/hub"}
          aria-label={label}
          className={({ isActive }) =>
            `app-tabbar__tab press ${accent ? "app-tabbar__tab--accent" : ""} ${isActive ? "app-tabbar__tab--active" : ""}`
          }
        >
          <span className="app-tabbar__icon">
            <Icon size={28} aria-hidden="true" />
          </span>
          <span className="sr-only">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default BottomTabBar;

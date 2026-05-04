import React from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./NavConfig";
import "./Sidebar.css";

function Sidebar({ collapsed = false, onToggleCollapse }) {
  return (
    <nav className={`app-sidebar ${collapsed ? "app-sidebar--collapsed" : ""}`} aria-label="Primary">
      <div className="app-sidebar__brand">
        {collapsed ? <span className="app-sidebar__brand-mark">L</span> : <span className="app-sidebar__brand-text">LiveSet</span>}
      </div>
      <ul className="app-sidebar__list">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <NavLink
              to={path}
              className={({ isActive }) =>
                `app-sidebar__link ${isActive ? "app-sidebar__link--active" : ""}`
              }
              end={path === "/hub"}
            >
              <Icon size={20} aria-hidden="true" />
              {!collapsed && <span className="app-sidebar__label">{label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
      {onToggleCollapse && (
        <button
          type="button"
          className="app-sidebar__collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      )}
    </nav>
  );
}

export default Sidebar;

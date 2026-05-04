import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./routes/Sidebar";
import BottomTabBar from "./routes/BottomTabBar";
import "./AppShell.css";

const COLLAPSE_KEY = "liveset-sidebar-collapsed";

function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <main className="app-shell__main">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}

export default AppShell;

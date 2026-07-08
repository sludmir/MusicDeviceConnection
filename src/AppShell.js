import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./routes/Sidebar";
import BottomTabBar from "./routes/BottomTabBar";
import "./AppShell.css";

const COLLAPSE_KEY = "liveset-sidebar-collapsed";

function AppShell() {
  // The builder needs an exact-height, non-scrolling shell (the 3D scene fills
  // it), and on mobile it brings its own bottom action bar instead of the tab
  // bar — both handled by the --builder modifier in AppShell.css.
  const { pathname } = useLocation();
  const isBuilder = pathname.startsWith("/builder");
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
    <div className={`app-shell ${isBuilder ? "app-shell--builder" : ""}`}>
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <main className="app-shell__main">
        <Outlet />
      </main>
      {!isBuilder && <BottomTabBar />}
    </div>
  );
}

export default AppShell;

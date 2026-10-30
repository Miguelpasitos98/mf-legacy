import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teamTheme, setTeamTheme] = useState({ primaryColor: "#003399", secondaryColor: "#FFFFFF" });
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const isTeamsPage = location.pathname.startsWith("/teams");
  useEffect(() => setSidebarOpen(false), [location.key]);
  return (
    <div className="mf-app-shell">
      <div className="mf-app-frame">
        {sidebarVisible && !isTeamsPage && (
          <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((open) => !open)} backgroundColor={isTeamsPage ? teamTheme.primaryColor : "#003399"} accentColor="#FFFFFF" secondaryColor={isTeamsPage ? teamTheme.secondaryColor : "#FFFFFF"} />
        )}
        <div className="mf-app-column">
          <TopNavbar />
          <main className="mf-main" id="main-content">
            <Outlet context={{ setTeamTheme, setSidebarVisible }} />
          </main>
        </div>
      </div>
    </div>
  );
}

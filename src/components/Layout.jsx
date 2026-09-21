import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [teamTheme, setTeamTheme] = useState({
    primaryColor: "#003399",
    secondaryColor: "#FFFFFF",
  });

  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{ backgroundColor: "#D1D3D9" }}
    >
      <div
        className="relative w-[96vw] h-[82vh] flex overflow-hidden rounded-[20px]"
        style={{
          backgroundColor: "#E8E9EC",
          boxShadow:
            "0 24px 70px -20px rgba(20,30,60,0.28), 0 8px 24px -12px rgba(20,30,60,0.18)",
        }}
      >
        {sidebarVisible && (
  <Sidebar
    open={sidebarOpen}
    onToggle={() => setSidebarOpen((o) => !o)}
    backgroundColor={teamTheme.primaryColor}
    accentColor="#FFFFFF"
    secondaryColor={teamTheme.secondaryColor}
  />
)}

        <div className="flex-1 flex flex-col min-w-0">
          <TopNavbar />

          <main className="flex-1 overflow-auto">
            <Outlet
              context={{
                setTeamTheme,
                setSidebarVisible,
              }}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
